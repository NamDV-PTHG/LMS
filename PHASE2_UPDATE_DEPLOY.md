# PHASE 2 — LMS Routine Update Deploy
# Chạy file này bằng: claude PHASE2_UPDATE_DEPLOY.md
# Dùng mỗi khi cần deploy code mới từ branch master lên production

## Mục tiêu
Pull code mới nhất từ GitHub, build, migrate (nếu có thay đổi schema),
reload PM2 với zero-downtime, và xác nhận hệ thống vẫn hoạt động.
Tự động rollback nếu có lỗi.

## Nguyên tắc
- KHÔNG overwrite file .env
- Backup database trước khi migrate
- Dùng pm2 reload (không phải restart) để zero-downtime
- Tự động rollback về commit trước nếu build/migrate thất bại

---

## BƯỚC 1: Thu thập thông tin kết nối

Hỏi người dùng:
```
1. IP production server?
2. SSH user và key path?
3. Project root? (gợi ý: D:\lms)
4. Có thay đổi database schema trong lần update này không? (yes/no)
   → Nếu yes sẽ chạy prisma migrate deploy + backup DB trước
```

---

## BƯỚC 2: Kiểm tra trạng thái hiện tại

```bash
# Commit hiện tại trên production (để rollback nếu cần)
ssh {SSH_USER}@{PROD_IP} "cd {PROJECT_ROOT} && git rev-parse HEAD"

# PM2 status
ssh {SSH_USER}@{PROD_IP} "pm2 list"

# Disk space (đảm bảo đủ chỗ cho build)
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"Get-PSDrive D | Select-Object Used,Free\""
```

Lưu lại CURRENT_COMMIT để dùng cho rollback.

---

## BƯỚC 3: Backup database (nếu có schema change)

Nếu người dùng xác nhận có schema change:

```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  \$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'; \
  \$backupFile = '{PROJECT_ROOT}\backups\backup_' + \$timestamp + '.sql'; \
  pg_dump -U {DB_USER} -h localhost {DB_NAME} > \$backupFile; \
  Write-Host 'Backup created:' \$backupFile\""
```

---

## BƯỚC 4: Pull code mới

```bash
# Đảm bảo .env an toàn trước
ssh {SSH_USER}@{PROD_IP} \
  "if exist {PROJECT_ROOT}\.env (echo ENV_SAFE) else (echo ENV_MISSING_WARNING)"

# Pull code
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  cd {PROJECT_ROOT}; \
  git fetch origin master; \
  git stash; \
  git reset --hard origin/master; \
  git stash pop; \
  Write-Host 'New commit:' (git rev-parse HEAD)\""

# Xác nhận .env vẫn còn
ssh {SSH_USER}@{PROD_IP} \
  "if exist {PROJECT_ROOT}\.env (echo ENV_PRESERVED) else (echo ENV_LOST_STOPPING)"
```

Nếu ENV_LOST → DỪNG NGAY, không tiếp tục.

---

## BƯỚC 5: Cài dependencies mới (nếu package.json thay đổi)

```bash
# Kiểm tra package.json có thay đổi không
ssh {SSH_USER}@{PROD_IP} "cd {PROJECT_ROOT} && git diff HEAD~1 HEAD -- package.json"
```

Nếu có thay đổi:
```bash
ssh {SSH_USER}@{PROD_IP} "cd {PROJECT_ROOT} && npm ci --production=false"
```

Tương tự với requirements.txt:
```bash
ssh {SSH_USER}@{PROD_IP} "cd {PROJECT_ROOT} && git diff HEAD~1 HEAD -- api/requirements.txt"
```
Nếu có thay đổi:
```bash
ssh {SSH_USER}@{PROD_IP} "cd {PROJECT_ROOT}\ai-service && pip install -r requirements.txt"
```

---

## BƯỚC 6: Build Next.js

```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  cd {PROJECT_ROOT}; \
  npm run build 2>&1 | Tee-Object -FilePath '{PROJECT_ROOT}\logs\build.log'; \
  if (\$LASTEXITCODE -ne 0) { Write-Host 'BUILD_FAILED'; exit 1 } \
  else { Write-Host 'BUILD_SUCCESS' }\""
```

**Nếu BUILD_FAILED → Rollback ngay:**
```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  cd {PROJECT_ROOT}; \
  git reset --hard {CURRENT_COMMIT}; \
  npm run build; \
  pm2 reload all; \
  Write-Host 'ROLLBACK_COMPLETE'\""
```

Báo người dùng: lỗi build cụ thể + đã rollback về commit nào.

---

## BƯỚC 7: Prisma migrate (nếu có schema change)

```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  cd {PROJECT_ROOT}; \
  npx prisma migrate deploy 2>&1 | Tee-Object '{PROJECT_ROOT}\logs\migrate.log'; \
  if (\$LASTEXITCODE -ne 0) { Write-Host 'MIGRATE_FAILED'; exit 1 } \
  else { Write-Host 'MIGRATE_SUCCESS' }\""
```

Nếu MIGRATE_FAILED → restore backup và rollback code:
```bash
ssh {SSH_USER}@{PROD_IP} "psql -U {DB_USER} {DB_NAME} < {BACKUP_FILE}"
ssh {SSH_USER}@{PROD_IP} "cd {PROJECT_ROOT} && git reset --hard {CURRENT_COMMIT} && npm run build"
ssh {SSH_USER}@{PROD_IP} "pm2 reload all"
```

---

## BƯỚC 8: Reload PM2 (zero-downtime)

```bash
# Reload từng service (không dùng restart để tránh downtime)
ssh {SSH_USER}@{PROD_IP} "pm2 reload lms-web"
ssh {SSH_USER}@{PROD_IP} "pm2 reload lms-api"

# Lưu trạng thái PM2
ssh {SSH_USER}@{PROD_IP} "pm2 save"
```

---

## BƯỚC 9: Health check sau deploy

Chờ 10 giây để services khởi động hoàn toàn, sau đó:

```bash
ssh {SSH_USER}@{PROD_IP} "Start-Sleep 10"

ssh {SSH_USER}@{PROD_IP} "pm2 list"

ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  try {
    \$r = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 15;
    Write-Host 'WEB_OK:' \$r.StatusCode
  } catch { Write-Host 'WEB_FAILED:' \$_.Exception.Message }

  try {
    \$r = Invoke-WebRequest -Uri 'http://localhost:8000/health' -TimeoutSec 15;
    Write-Host 'API_OK:' \$r.StatusCode
  } catch { Write-Host 'API_FAILED:' \$_.Exception.Message }
\""
```

Nếu WEB_FAILED hoặc API_FAILED sau reload → tự động rollback:
```bash
ssh {SSH_USER}@{PROD_IP} "cd {PROJECT_ROOT} && git reset --hard {CURRENT_COMMIT}"
ssh {SSH_USER}@{PROD_IP} "cd {PROJECT_ROOT} && npm run build && pm2 reload all"
```

---

## BƯỚC 10: Báo cáo

### Nếu thành công:
```
✅ Deploy thành công!
- Commit mới: {NEW_COMMIT}
- Commit cũ: {CURRENT_COMMIT}  
- Thời gian deploy: {DURATION}
- Services: tất cả online
```

### Nếu đã rollback:
```
⚠️ Deploy thất bại — đã rollback về {CURRENT_COMMIT}
- Lỗi: {ERROR_DETAILS}
- Hệ thống vẫn đang chạy bình thường với phiên bản cũ
- Anh cần xem xét lỗi và fix trên staging trước khi deploy lại
```

---

## BƯỚC BỔ SUNG: Scan lỗi sau deploy (tùy chọn)

Hỏi người dùng: "Anh có muốn tôi scan logs để phát hiện lỗi tiềm ẩn không?"

Nếu yes:
```bash
# Scan error logs 100 dòng cuối
ssh {SSH_USER}@{PROD_IP} "pm2 logs lms-web --nostream --lines 100 --err"
ssh {SSH_USER}@{PROD_IP} "pm2 logs lms-api --nostream --lines 100 --err"

# Tìm các pattern lỗi phổ biến
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  Get-Content '{PROJECT_ROOT}\logs\nextjs-error.log' -Tail 100 | \
  Where-Object { \$_ -match 'ERROR|FATAL|Exception|undefined|null' }\""
```

Phân tích và báo cáo:
- Tổng số lỗi tìm thấy
- Các lỗi nghiêm trọng cần xử lý ngay
- Các warning cần theo dõi
- Đề xuất cách fix cụ thể

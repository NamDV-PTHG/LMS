# PHASE 1 — LMS First Deploy
# Chạy file này bằng: claude PHASE1_FIRST_DEPLOY.md
# Yêu cầu: Đã chạy PHASE0_INFRA_SETUP.md thành công

## Mục tiêu
Clone repo từ GitHub, cài dependencies, build, migrate database,
khởi động tất cả services qua PM2, và xác nhận hệ thống hoạt động.

## Nguyên tắc
- KHÔNG overwrite file .env nếu đã tồn tại trên server
- Hỏi người dùng nếu cần thông tin trong quá trình xử lý
- Tự động rollback nếu bước nào thất bại
- Ghi log chi tiết vào {PROJECT_ROOT}\logs\deploy.log

---

## BƯỚC 1: Thu thập thông tin

Hỏi người dùng:
```
1. IP production server?
2. SSH user và key path?
3. GitHub repo URL: https://github.com/NamDV-PTHG/LMS
4. GitHub Personal Access Token (để clone private repo)?
   Tạo tại: https://github.com/settings/tokens → scope: repo
5. Project root trên production? (gợi ý: D:\lms)
6. Cấu trúc repo: Next.js ở root hay trong subfolder?
```

---

## BƯỚC 2: Kiểm tra .env trước khi làm bất cứ điều gì

```bash
# Kiểm tra .env đã tồn tại chưa — PHẢI làm trước khi clone/pull
ssh {SSH_USER}@{PROD_IP} \
  "if exist {PROJECT_ROOT}\.env (echo ENV_EXISTS) else (echo ENV_MISSING)"

ssh {SSH_USER}@{PROD_IP} \
  "if exist {PROJECT_ROOT}\api\.env (echo API_ENV_EXISTS) else (echo API_ENV_MISSING)"
```

Nếu ENV_MISSING → hỏi người dùng:
```
File .env chưa tồn tại trên production.
Anh có muốn tôi tạo file .env mẫu để anh điền thông tin không?
Hay anh sẽ tự upload file .env lên server trước?
```

Nếu ENV_EXISTS → ghi chú: "File .env đã có, sẽ được bảo toàn trong suốt quá trình deploy."

---

## BƯỚC 3: Clone hoặc Pull repo

```bash
# Kiểm tra repo đã được clone chưa
ssh {SSH_USER}@{PROD_IP} \
  "if exist {PROJECT_ROOT}\.git (echo REPO_EXISTS) else (echo REPO_MISSING)"
```

### Nếu REPO_MISSING — Clone lần đầu:
```bash
# Clone vào thư mục tạm để tránh overwrite .env
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  cd D:\; \
  git clone https://{GITHUB_TOKEN}@github.com/NamDV-PTHG/LMS.git lms_temp\""

# Copy code vào project root, BỎ QUA .env
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  \$exclude = @('.env', 'api\.env', 'node_modules', '__pycache__', '.git'); \
  Get-ChildItem 'D:\lms_temp' | Where-Object { \$_.Name -notin \$exclude } | \
  Copy-Item -Destination '{PROJECT_ROOT}' -Recurse -Force; \
  Remove-Item 'D:\lms_temp' -Recurse -Force; \
  Write-Host 'Clone completed, .env preserved'\""
```

### Nếu REPO_EXISTS — Pull update:
```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  cd {PROJECT_ROOT}; \
  git fetch origin master; \
  git stash; \
  git reset --hard origin/master; \
  git stash pop; \
  Write-Host 'Pull completed'\""
```

**Sau bước này, xác nhận .env vẫn còn:**
```bash
ssh {SSH_USER}@{PROD_IP} \
  "if exist {PROJECT_ROOT}\.env (echo ENV_SAFE) else (echo ENV_LOST_CRITICAL_ERROR)"
```

Nếu ENV_LOST → DỪNG NGAY, báo lỗi nghiêm trọng, không tiếp tục.

---

## BƯỚC 4: Tạo file .env mẫu (nếu chưa có)

Nếu bước 2 xác nhận ENV_MISSING, tạo file .env mẫu:

```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  \$envContent = @'
# Database
DATABASE_URL=postgresql://{DB_USER}:{DB_PASSWORD}@localhost:5432/{DB_NAME}

# NextAuth
NEXTAUTH_URL=http://{DOMAIN_OR_IP}
NEXTAUTH_SECRET=

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET_NAME=lms-assets

# Redis
REDIS_URL=redis://localhost:6379

# API
NEXT_PUBLIC_API_URL=http://{DOMAIN_OR_IP}/api
FASTAPI_SECRET_KEY=

# Environment
NODE_ENV=production
'@
  Set-Content -Path '{PROJECT_ROOT}\.env' -Value \$envContent -Encoding UTF8; \
  Write-Host 'ENV template created — please fill in the values'\""
```

Sau đó hỏi người dùng:
```
File .env mẫu đã được tạo tại {PROJECT_ROOT}\.env
Anh cần điền các giá trị vào file đó trước khi tiếp tục.
Hãy báo cho tôi khi đã điền xong để tiến hành bước tiếp theo.
```

**DỪNG và chờ xác nhận từ người dùng.**

---

## BƯỚC 5: Cài Node.js dependencies

```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  cd {PROJECT_ROOT}; \
  npm ci --production=false 2>&1 | Tee-Object -FilePath '{PROJECT_ROOT}\logs\npm_install.log'; \
  Write-Host 'npm install exit code:' \$LASTEXITCODE\""
```

Nếu thất bại → đọc log và báo lỗi cụ thể:
```bash
ssh {SSH_USER}@{PROD_IP} "Get-Content '{PROJECT_ROOT}\logs\npm_install.log' -Tail 30"
```

---

## BƯỚC 6: Cài Python dependencies (FastAPI)

```bash
# Xác định thư mục FastAPI
ssh {SSH_USER}@{PROD_IP} \
  "if exist {PROJECT_ROOT}\ai-service\requirements.txt (echo API_DIR_FOUND) else (echo API_DIR_MISSING)"
```

Nếu tìm thấy:
```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  cd {PROJECT_ROOT}\ai-service; \
  pip install -r requirements.txt 2>&1 | \
  Tee-Object -FilePath '{PROJECT_ROOT}\logs\pip_install.log'; \
  Write-Host 'pip install exit code:' \$LASTEXITCODE\""
```

---

## BƯỚC 7: Build Next.js

```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  cd {PROJECT_ROOT}; \
  npm run build 2>&1 | Tee-Object -FilePath '{PROJECT_ROOT}\logs\build.log'; \
  Write-Host 'Build exit code:' \$LASTEXITCODE\""
```

Build thường mất 2-5 phút. Nếu thất bại:
```bash
ssh {SSH_USER}@{PROD_IP} "Get-Content '{PROJECT_ROOT}\logs\build.log' -Tail 50"
```

Báo lỗi cụ thể cho người dùng và hỏi cách xử lý.

---

## BƯỚC 8: Prisma migrate

```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  cd {PROJECT_ROOT}; \
  npx prisma generate; \
  npx prisma migrate deploy 2>&1 | \
  Tee-Object -FilePath '{PROJECT_ROOT}\logs\migrate.log'; \
  Write-Host 'Migration exit code:' \$LASTEXITCODE\""
```

Nếu thất bại → đọc log, thường do DATABASE_URL sai hoặc DB chưa tạo.

---

## BƯỚC 9: Tạo PM2 ecosystem file

```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  \$ecosystem = @'
module.exports = {
  apps: [
    {
      name: 'lms-web',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '{PROJECT_ROOT}',
      instances: 1,
      env: { NODE_ENV: 'production', PORT: 3000 },
      error_file: '{PROJECT_ROOT}/logs/nextjs-error.log',
      out_file: '{PROJECT_ROOT}/logs/nextjs-out.log',
      merge_logs: true,
      restart_delay: 3000,
    },
    {
      name: 'lms-api',
      script: 'uvicorn',
      args: 'main:app --host 0.0.0.0 --port 8000 --workers 2',
      cwd: '{PROJECT_ROOT}\ai-service',
      interpreter: 'python',
      error_file: '{PROJECT_ROOT}/logs/fastapi-error.log',
      out_file: '{PROJECT_ROOT}/logs/fastapi-out.log',
      merge_logs: true,
      restart_delay: 3000,
    },
    {
      name: 'lms-minio',
      script: '{PROJECT_ROOT}\minio.exe',
      args: 'server {PROJECT_ROOT}\minio-data --console-address :9001',
      error_file: '{PROJECT_ROOT}/logs/minio-error.log',
      out_file: '{PROJECT_ROOT}/logs/minio-out.log',
    }
  ]
};
'@
  Set-Content -Path '{PROJECT_ROOT}\ecosystem.config.js' -Value \$ecosystem -Encoding UTF8; \
  Write-Host 'Ecosystem file created'\""
```

---

## BƯỚC 10: Khởi động services qua PM2

```bash
# Khởi động tất cả services
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  cd {PROJECT_ROOT}; \
  pm2 start ecosystem.config.js; \
  pm2 save; \
  Write-Host 'PM2 started'\""

# Khởi động Nginx
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  Start-Service nginx 2>nul; \
  nginx -t; \
  Write-Host 'Nginx status:' (Get-Service nginx).Status\""

# Khởi động Redis
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  Start-Service redis 2>nul; \
  redis-cli ping\""
```

---

## BƯỚC 11: Health check

```bash
# Kiểm tra PM2 processes
ssh {SSH_USER}@{PROD_IP} "pm2 list"

# Kiểm tra logs 50 dòng cuối
ssh {SSH_USER}@{PROD_IP} "pm2 logs --nostream --lines 50"

# Test HTTP response
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  try {
    \$r = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 10;
    Write-Host 'Next.js HTTP:' \$r.StatusCode
  } catch { Write-Host 'Next.js HTTP: FAILED -' \$_.Exception.Message }

  try {
    \$r = Invoke-WebRequest -Uri 'http://localhost:8000/health' -TimeoutSec 10;
    Write-Host 'FastAPI HTTP:' \$r.StatusCode
  } catch { Write-Host 'FastAPI HTTP: FAILED -' \$_.Exception.Message }
\""
```

---

## BƯỚC 12: Báo cáo kết quả

Hiển thị bảng tổng kết:

| Service | Status | Port | Ghi chú |
|---------|--------|------|---------|
| Next.js (lms-web) | ✅/❌ | 3000 | |
| FastAPI (lms-api) | ✅/❌ | 8000 | |
| MinIO (lms-minio) | ✅/❌ | 9000/9001 | |
| PostgreSQL | ✅/❌ | 5432 | |
| Redis | ✅/❌ | 6379 | |
| Nginx | ✅/❌ | 80 | |

Nếu tất cả ✅ → "Deploy thành công! Hệ thống LMS đang chạy tại http://{DOMAIN_OR_IP}"
Nếu có ❌ → đọc log tương ứng, phân tích lỗi, đề xuất cách fix.

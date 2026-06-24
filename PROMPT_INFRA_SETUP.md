# PROMPT_INFRA_SETUP.md — Cài đặt hạ tầng LMS trên Staging Server

> Chạy prompt này trên **staging server** (Windows Server đang chạy VIA CRM).
> Claude CLI cần quyền Administrator để thực hiện các lệnh hệ thống.
> Thực hiện tuần tự từng Task — KHÔNG bỏ qua bước nào.

---

## Thông tin môi trường hiện tại

- OS: Windows Server (đang chạy VIA CRM)
- CRM paths: `C:\apps\via-crm\`
- CRM ports: web=3000, api=4000
- PostgreSQL 16 đã cài, DB: `via_crm`
- Node.js 20 LTS đã cài
- Python 3.11 đã cài
- PM2 đã cài, file config: `C:\apps\ecosystem.config.js` (hoặc tìm file hiện tại)
- Nginx đã cài và đang chạy cho CRM

---

## Task 1 — Kiểm tra hạ tầng hiện tại (READ ONLY)

Chạy các lệnh sau để lấy thông tin baseline. **Không thay đổi bất kỳ thứ gì trong task này.**

```powershell
# 1.1 Kiểm tra disk space
Get-PSDrive | Where-Object { $_.Provider -like "*FileSystem*" } |
  Select-Object Name,
    @{N="Used(GB)";E={[math]::Round($_.Used/1GB,2)}},
    @{N="Free(GB)";E={[math]::Round($_.Free/1GB,2)}}

# 1.2 Kiểm tra port đang dùng
netstat -ano | findstr "LISTENING" | findstr ":3000\|:3001\|:4000\|:8000\|:5432\|:6379\|:11434"

# 1.3 Kiểm tra phiên bản các runtime
node --version
python --version
pip --version
pm2 --version
psql --version

# 1.4 Tìm file ecosystem.config.js hiện tại
Get-ChildItem C:\apps -Filter "ecosystem.config.js" -Recurse -ErrorAction SilentlyContinue
pm2 list

# 1.5 Kiểm tra Nginx config path
nginx -t 2>&1
Get-ChildItem "C:\nginx\conf\" -ErrorAction SilentlyContinue
Get-ChildItem "C:\tools\nginx\conf\" -ErrorAction SilentlyContinue

# 1.6 Kiểm tra Python packages đã cài
pip list | findstr "fastapi uvicorn httpx pymupdf python-docx python-pptx pydantic"

# 1.7 Kiểm tra Redis
redis-cli ping 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "Redis: NOT INSTALLED" } else { Write-Host "Redis: RUNNING" }
```

**Sau khi chạy xong Task 1, báo cáo kết quả:**
- Disk free trên ổ C (và D nếu có)
- Danh sách port đang LISTEN
- Phiên bản các runtime
- Path của ecosystem.config.js
- Path của nginx.conf
- Redis đã cài chưa
- Python packages nào đã có, cái nào thiếu

**Dừng lại và hiển thị báo cáo trước khi sang Task 2.**

---

## Task 2 — Tạo database PostgreSQL cho LMS

```powershell
# 2.1 Tạo DB và user mới — KHÔNG dùng chung với CRM
$pgPassword = Read-Host "Nhập password cho lms_user" -AsSecureString
$pgPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPassword)
)

psql -U postgres -c "CREATE DATABASE lms_db;"
psql -U postgres -c "CREATE USER lms_user WITH ENCRYPTED PASSWORD '$pgPasswordPlain';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE lms_db TO lms_user;"
psql -U postgres -c "ALTER DATABASE lms_db OWNER TO lms_user;"

# 2.2 Verify
psql -U postgres -c "\l" | findstr "lms_db"
psql -U lms_user -d lms_db -c "SELECT current_user, current_database();"
```

**Ghi lại password đã nhập** — cần điền vào `.env` của LMS sau:
```
DATABASE_URL="postgresql://lms_user:<PASSWORD>@localhost:5432/lms_db"
```

**Xác nhận:** `lms_db` xuất hiện trong danh sách `\l` → Task 2 DONE.

---

## Task 3 — Cài đặt Redis

```powershell
# 3.1 Cài Redis qua Chocolatey
choco install redis-64 -y

# 3.2 Cấu hình Redis service tự khởi động
$redisConf = "C:\ProgramData\chocolatey\lib\redis-64\tools\redis.windows-service.conf"
if (Test-Path $redisConf) {
    # Bind localhost only (bảo mật — không expose ra ngoài)
    (Get-Content $redisConf) -replace "^bind.*", "bind 127.0.0.1" |
      Set-Content $redisConf
}

# 3.3 Cài và start service
redis-server --service-install $redisConf --service-name "Redis"
Start-Service Redis
Set-Service -Name Redis -StartupType Automatic

# 3.4 Verify
redis-cli ping                          # phải trả về PONG
redis-cli info server | findstr "redis_version"
```

**Xác nhận:** `redis-cli ping` trả về `PONG` → Task 3 DONE.

---

## Task 4 — Cài Python packages cho AI Service

```powershell
# 4.1 Upgrade pip trước
python -m pip install --upgrade pip

# 4.2 Cài các packages cần thiết cho FastAPI AI Service
pip install `
  fastapi==0.111.0 `
  uvicorn[standard]==0.30.1 `
  httpx==0.27.0 `
  pymupdf==1.24.5 `
  python-docx==1.1.2 `
  python-pptx==0.6.23 `
  pydantic-settings==2.3.0 `
  python-multipart==0.0.9

# 4.3 Verify từng package quan trọng
python -c "
import fastapi; print(f'fastapi: {fastapi.__version__}')
import uvicorn; print(f'uvicorn: {uvicorn.__version__}')
import httpx; print(f'httpx: {httpx.__version__}')
import fitz; print(f'pymupdf: {fitz.__version__}')
import docx; print('python-docx: OK')
import pptx; print('python-pptx: OK')
import pydantic_settings; print('pydantic-settings: OK')
print('=== All AI Service packages installed successfully ===')
"
```

**Xác nhận:** Tất cả packages in ra version/OK → Task 4 DONE.

---

## Task 5 — Cập nhật PM2 ecosystem.config.js

```powershell
# 5.1 Tìm file ecosystem hiện tại
$ecoFile = (Get-ChildItem C:\apps -Filter "ecosystem.config.js" -Recurse |
  Select-Object -First 1).FullName

if (-not $ecoFile) {
    $ecoFile = "C:\apps\ecosystem.config.js"
    Write-Host "Không tìm thấy file hiện tại, sẽ tạo mới tại: $ecoFile"
}

Write-Host "Ecosystem file: $ecoFile"

# 5.2 Backup file hiện tại
$backupFile = "$ecoFile.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $ecoFile $backupFile
Write-Host "Đã backup: $backupFile"

# 5.3 Đọc nội dung hiện tại để xác nhận CRM apps
Get-Content $ecoFile
```

**DỪNG lại** — hiển thị nội dung file hiện tại để xác nhận `name` của CRM apps trước khi chỉnh sửa.

Sau khi xác nhận, **thêm 2 app LMS vào cuối mảng `apps`** (giữ nguyên CRM apps):

```javascript
// Thêm vào cuối mảng apps[] trong ecosystem.config.js
// KHÔNG xóa hoặc sửa các CRM apps hiện có

{
  name: 'lms-web',
  script: 'node_modules/.bin/next',
  args: 'start',
  cwd: 'C:/apps/lms/apps/web',
  instances: 1,
  autorestart: true,
  watch: false,
  env: {
    PORT: 3001,
    NODE_ENV: 'production'
  }
},
{
  name: 'lms-ai-service',
  script: 'uvicorn',
  args: 'main:app --host 127.0.0.1 --port 8000 --workers 2',
  cwd: 'C:/apps/lms/apps/ai-service',
  interpreter: 'python',
  autorestart: true,
  watch: false,
  env: {
    PYTHONPATH: 'C:/apps/lms/apps/ai-service',
    NODE_ENV: 'production'
  }
}
```

```powershell
# 5.4 Reload PM2 với config mới (không restart CRM)
pm2 reload $ecoFile --only lms-web 2>$null
pm2 reload $ecoFile --only lms-ai-service 2>$null

# 5.5 Verify config hợp lệ (apps chưa chạy được vì code chưa có — bình thường)
pm2 list
```

**Xác nhận:** `pm2 list` hiển thị `lms-web` và `lms-ai-service` (có thể status errored vì code chưa deploy — bình thường) → Task 5 DONE.

---

## Task 6 — Cấu hình Nginx cho LMS

```powershell
# 6.1 Tìm nginx config directory
$nginxConf = $null
$candidates = @(
    "C:\nginx\conf\nginx.conf",
    "C:\tools\nginx\conf\nginx.conf",
    "C:\Program Files\nginx\conf\nginx.conf"
)
foreach ($c in $candidates) {
    if (Test-Path $c) { $nginxConf = $c; break }
}

if (-not $nginxConf) {
    Write-Host "Không tìm thấy nginx.conf tự động"
    Write-Host "Chạy: nginx -t để xác định path"
    nginx -t
} else {
    Write-Host "Nginx config: $nginxConf"
    $nginxDir = Split-Path $nginxConf
}

# 6.2 Backup nginx config
Copy-Item $nginxConf "$nginxConf.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# 6.3 Tạo file config riêng cho LMS (include vào nginx.conf chính)
$lmsConf = "$nginxDir\lms-staging.conf"

@"
# LMS Staging - thêm vào http block của nginx.conf
server {
    listen 80;
    server_name lms-staging.yourdomain.com;  # Đổi thành domain/IP thực tế

    # Upload size cho video khóa học
    client_max_body_size 500M;

    # LMS Web (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_cache_bypass `$http_upgrade;
        proxy_read_timeout 300s;
    }

    # Static files / uploads
    location /uploads/ {
        alias C:/apps/lms/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}

# AI Service KHÔNG expose public — chỉ gọi nội bộ từ LMS web
# Internal: http://127.0.0.1:8000
"@ | Set-Content $lmsConf -Encoding UTF8

Write-Host "Đã tạo: $lmsConf"
```

Sau khi tạo file, **thêm dòng include vào `nginx.conf`** trong http block:

```nginx
# Thêm vào http { } block trong nginx.conf
include conf/lms-staging.conf;
```

```powershell
# 6.4 Test và reload Nginx
nginx -t
if ($LASTEXITCODE -eq 0) {
    nginx -s reload
    Write-Host "Nginx reloaded successfully"
} else {
    Write-Host "ERROR: nginx config invalid — kiểm tra lại"
}
```

**Xác nhận:** `nginx -t` báo `syntax is ok` → Task 6 DONE.

---

## Task 7 — Firewall rule cho kết nối đến LLM Server

```powershell
# 7.1 Nhập IP của LLM server (server cài RTX 2080 Ti + Ollama)
$llmIP = Read-Host "Nhập IP của LLM server (server RTX 2080 Ti)"

# 7.2 Tạo firewall rule outbound
New-NetFirewallRule `
  -DisplayName "LMS - Allow Ollama LLM Server" `
  -Description "Allow LMS staging to connect to self-hosted Ollama LLM" `
  -Direction Outbound `
  -Protocol TCP `
  -RemoteAddress $llmIP `
  -RemotePort 11434 `
  -Action Allow `
  -Profile Any

# 7.3 Test connectivity
Write-Host "Testing connection to LLM server..."
$testResult = Test-NetConnection -ComputerName $llmIP -Port 11434 -WarningAction SilentlyContinue

if ($testResult.TcpTestSucceeded) {
    Write-Host "SUCCESS: Kết nối đến LLM server OK ($llmIP:11434)"

    # Test Ollama API
    try {
        $ollamaResponse = Invoke-RestMethod -Uri "http://${llmIP}:11434/api/tags" -Method GET
        Write-Host "Ollama đang chạy. Models available:"
        $ollamaResponse.models | ForEach-Object { Write-Host "  - $($_.name)" }
    } catch {
        Write-Host "WARNING: Port mở nhưng Ollama chưa chạy hoặc chưa cài trên LLM server"
        Write-Host "Cần cài Ollama và pull model qwen2.5:14b trên server đó"
    }
} else {
    Write-Host "FAILED: Không kết nối được đến $llmIP:11434"
    Write-Host "Kiểm tra:"
    Write-Host "  1. Ollama đã cài và đang chạy trên LLM server chưa?"
    Write-Host "  2. Firewall của LLM server đã mở port 11434 chưa?"
    Write-Host "  3. IP $llmIP có đúng không?"
}
```

**Xác nhận:** `TcpTestSucceeded: True` → Task 7 DONE.

---

## Task 8 — Tạo thư mục và file .env mẫu cho LMS

```powershell
# 8.1 Tạo cấu trúc thư mục
New-Item -ItemType Directory -Force -Path "C:\apps\lms"
New-Item -ItemType Directory -Force -Path "C:\apps\lms\uploads"
New-Item -ItemType Directory -Force -Path "C:\apps\lms\logs"
New-Item -ItemType Directory -Force -Path "C:\apps\lms\apps\web"
New-Item -ItemType Directory -Force -Path "C:\apps\lms\apps\ai-service"

# 8.2 Lấy thông tin đã cài để điền .env
$llmIP = Read-Host "Nhập lại IP LLM server (để điền .env)"

# 8.3 Tạo file .env staging
@"
# =========================================
# LMS STAGING - Environment Variables
# Tạo bởi PROMPT_INFRA_SETUP.md
# =========================================

# Database (lms_user tạo ở Task 2)
DATABASE_URL="postgresql://lms_user:CHANGE_ME@localhost:5432/lms_db"

# Auth
NEXTAUTH_SECRET="$(New-Guid)-$(New-Guid)"
NEXTAUTH_URL="http://lms-staging.yourdomain.com"
JWT_SECRET="$(New-Guid)"
JWT_EXPIRES_IN="7d"

# Redis (cài ở Task 3)
REDIS_URL="redis://127.0.0.1:6379"

# AI Service (FastAPI chạy local)
AI_SERVICE_URL="http://127.0.0.1:8000"
AI_SERVICE_INTERNAL_KEY="$(New-Guid)"

# LLM Server (Ollama trên RTX 2080 Ti)
OLLAMA_BASE_URL="http://${llmIP}:11434"
OLLAMA_DEFAULT_MODEL="qwen2.5:14b"
OLLAMA_FAST_MODEL="qwen2.5:7b"
OLLAMA_TIMEOUT_SECONDS=120

# Storage
STORAGE_PROVIDER="local"
STORAGE_LOCAL_PATH="C:/apps/lms/uploads"
STORAGE_BASE_URL="http://lms-staging.yourdomain.com/uploads"

# App
NODE_ENV="production"
PORT=3001
AI_SERVICE_PORT=8000

# Internal service key (FastAPI gọi lại Next.js)
NEXTJS_INTERNAL_API_KEY="$(New-Guid)"
"@ | Set-Content "C:\apps\lms\.env.staging" -Encoding UTF8

Write-Host "Đã tạo: C:\apps\lms\.env.staging"
Write-Host "QUAN TRỌNG: Cập nhật DATABASE_URL với password đã tạo ở Task 2"
```

---

## Task 9 — Kiểm tra tổng thể (Health Check)

```powershell
Write-Host "=========================================="
Write-Host "    LMS INFRASTRUCTURE HEALTH CHECK"
Write-Host "=========================================="

# PostgreSQL
try {
    psql -U lms_user -d lms_db -c "SELECT 1;" 2>$null
    Write-Host "[OK] PostgreSQL: lms_db accessible"
} catch {
    Write-Host "[FAIL] PostgreSQL: Cannot connect to lms_db"
}

# Redis
$redisPing = redis-cli ping 2>$null
if ($redisPing -eq "PONG") {
    Write-Host "[OK] Redis: Running"
} else {
    Write-Host "[FAIL] Redis: Not responding"
}

# Python packages
python -c "import fastapi, uvicorn, fitz, docx, pptx, httpx; print('[OK] Python AI packages: All installed')" 2>&1

# Port availability
$portsToCheck = @(3001, 8000)
foreach ($port in $portsToCheck) {
    $inUse = netstat -ano | findstr ":$port "
    if ($inUse) {
        Write-Host "[INFO] Port $port : In use (expected if LMS already running)"
    } else {
        Write-Host "[OK] Port $port : Available for LMS"
    }
}

# Nginx
nginx -t 2>&1 | findstr "successful"
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Nginx: Config valid"
} else {
    Write-Host "[FAIL] Nginx: Config has errors"
}

# PM2 LMS entries
$pm2Apps = pm2 jlist 2>$null | ConvertFrom-Json
$lmsApps = $pm2Apps | Where-Object { $_.name -like "lms-*" }
if ($lmsApps.Count -ge 2) {
    Write-Host "[OK] PM2: $($lmsApps.Count) LMS apps registered"
} else {
    Write-Host "[WARN] PM2: LMS apps not yet registered (normal before first deploy)"
}

# Disk space cảnh báo
$disk = Get-PSDrive C | Select-Object @{N="Free(GB)";E={[math]::Round($_.Free/1GB,0)}}
if ($disk.'Free(GB)' -lt 100) {
    Write-Host "[WARN] Disk C: Only $($disk.'Free(GB)')GB free — consider external storage for LMS videos"
} else {
    Write-Host "[OK] Disk C: $($disk.'Free(GB)')GB free"
}

Write-Host "=========================================="
Write-Host "Infrastructure setup complete!"
Write-Host "Next step: Deploy LMS code via GitHub Actions"
Write-Host "=========================================="
```

---

## Tóm tắt sau khi hoàn thành

Sau khi tất cả Tasks DONE, staging server sẽ có:

```
✓ PostgreSQL: DB lms_db + user lms_user
✓ Redis: service running, auto-start
✓ Python: fastapi, uvicorn, pymupdf, python-docx, python-pptx
✓ PM2: ecosystem.config.js đã có lms-web + lms-ai-service
✓ Nginx: server block cho LMS port 3001
✓ Firewall: outbound rule đến LLM server:11434
✓ Thư mục: C:\apps\lms\ với .env.staging
```

**Bước tiếp theo sau infra setup:**
1. Cập nhật `DATABASE_URL` trong `.env.staging` với password thực
2. Setup GitHub Actions workflow cho LMS repo (tương tự CRM)
3. First deploy: `git push origin main` → pipeline tự chạy
4. Chạy `prisma migrate deploy` lần đầu để tạo tables
5. Chạy `prisma db seed` để tạo dữ liệu mẫu

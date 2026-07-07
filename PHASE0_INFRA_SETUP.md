# PHASE 0 — LMS Infrastructure Setup
# Chạy file này bằng: claude PHASE0_INFRA_SETUP.md

## Mục tiêu
Kết nối SSH vào production server, quét toàn bộ phần mềm hiện có,
cài đặt những gì còn thiếu, và xác nhận mọi thứ sẵn sàng để deploy LMS.

## Nguyên tắc hoạt động
- Tự động quét trước, hỏi người dùng khi cần thông tin nhạy cảm (password, path, IP)
- KHÔNG tự đặt password — luôn hỏi người dùng
- KHÔNG overwrite file .env nếu đã tồn tại
- Báo cáo rõ ràng sau mỗi bước: SUCCESS / FAILED / SKIPPED

---

## BƯỚC 1: Thu thập thông tin kết nối

Hỏi người dùng các thông tin sau (nếu chưa có):

```
1. IP của production server là gì?
2. Username SSH (thường là "administrator")?
3. Đường dẫn SSH private key (ví dụ: C:\Users\Administrator\.ssh\prod_deploy)?
   Nếu chưa có key, sẽ dùng password — hỏi password khi cần.
4. Project sẽ cài vào thư mục nào trên production? (gợi ý: D:\lms)
```

Lưu các giá trị này vào biến để dùng xuyên suốt quá trình.

---

## BƯỚC 2: Test kết nối SSH

```bash
ssh -i {SSH_KEY_PATH} -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
  {SSH_USER}@{PROD_IP} "echo SSH_CONNECTION_OK"
```

Nếu kết nối thất bại:
- Kiểm tra lại IP, username, key path
- Thử dùng password thay key: `ssh {SSH_USER}@{PROD_IP}`
- Báo lỗi cụ thể và hỏi người dùng cách xử lý

---

## BƯỚC 3: Quét phần mềm hiện có trên production

Chạy lần lượt các lệnh sau qua SSH, ghi lại kết quả:

```bash
# Node.js
ssh {SSH_USER}@{PROD_IP} "node --version 2>nul || echo NOT_INSTALLED"

# npm
ssh {SSH_USER}@{PROD_IP} "npm --version 2>nul || echo NOT_INSTALLED"

# Python
ssh {SSH_USER}@{PROD_IP} "python --version 2>nul || echo NOT_INSTALLED"

# Git
ssh {SSH_USER}@{PROD_IP} "git --version 2>nul || echo NOT_INSTALLED"

# PM2
ssh {SSH_USER}@{PROD_IP} "pm2 --version 2>nul || echo NOT_INSTALLED"

# PostgreSQL
ssh {SSH_USER}@{PROD_IP} "psql --version 2>nul || echo NOT_INSTALLED"

# Redis
ssh {SSH_USER}@{PROD_IP} "redis-cli --version 2>nul || echo NOT_INSTALLED"

# MinIO
ssh {SSH_USER}@{PROD_IP} "if exist D:\lms\minio.exe (echo INSTALLED) else (echo NOT_INSTALLED)"

# Nginx
ssh {SSH_USER}@{PROD_IP} "nginx -version 2>nul || echo NOT_INSTALLED"

# Chocolatey
ssh {SSH_USER}@{PROD_IP} "choco --version 2>nul || echo NOT_INSTALLED"
```

Tổng hợp thành bảng trạng thái:

| Service | Version hiện có | Yêu cầu | Trạng thái |
|---------|----------------|---------|-----------|
| Node.js | ? | >= 20 LTS | ? |
| npm | ? | >= 10 | ? |
| Python | ? | >= 3.11 | ? |
| Git | ? | latest | ? |
| PM2 | ? | latest | ? |
| PostgreSQL | ? | 15 | ? |
| Redis | ? | latest | ? |
| MinIO | ? | latest | ? |
| Nginx | ? | latest | ? |
| Chocolatey | ? | latest | ? |

---

## BƯỚC 4: Cài đặt Chocolatey (nếu chưa có)

```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
  Set-ExecutionPolicy Bypass -Scope Process -Force; \
  iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))\""
```

Xác nhận: `ssh {SSH_USER}@{PROD_IP} "choco --version"`

---

## BƯỚC 5: Cài các phần mềm còn thiếu

### 5.1 Node.js 20 LTS (nếu chưa có hoặc version < 20)
```bash
ssh {SSH_USER}@{PROD_IP} "choco install nodejs-lts -y"
```

### 5.2 Git (nếu chưa có)
```bash
ssh {SSH_USER}@{PROD_IP} "choco install git -y"
```

### 5.3 Python 3.11 (nếu chưa có)
```bash
ssh {SSH_USER}@{PROD_IP} "choco install python311 -y"
```

### 5.4 PostgreSQL 15 (nếu chưa có — song song với SQL Server)
Hỏi người dùng:
```
PostgreSQL 15 chưa được cài. Tôi sẽ cài vào port 5432 (không ảnh hưởng SQL Server).
Anh muốn đặt password cho PostgreSQL superuser (postgres) là gì?
```
Sau khi có password:
```bash
ssh {SSH_USER}@{PROD_IP} \
  "choco install postgresql15 --params '/Password:{PG_PASSWORD} /Port:5432' -y"
```

### 5.5 Redis (nếu chưa có)
```bash
ssh {SSH_USER}@{PROD_IP} "choco install redis-64 -y"
ssh {SSH_USER}@{PROD_IP} "redis-server --service-install"
ssh {SSH_USER}@{PROD_IP} "redis-server --service-start"
```

### 5.6 PM2 (nếu chưa có)
```bash
ssh {SSH_USER}@{PROD_IP} "npm install -g pm2 pm2-windows-startup"
ssh {SSH_USER}@{PROD_IP} "pm2-startup install"
```

### 5.7 Nginx (nếu chưa có)
```bash
ssh {SSH_USER}@{PROD_IP} "choco install nginx -y"
```

### 5.8 MinIO (nếu chưa có)
Hỏi người dùng:
```
MinIO chưa được cài. Anh muốn đặt:
1. MINIO_ROOT_USER (access key) là gì?
2. MINIO_ROOT_PASSWORD (secret key, tối thiểu 8 ký tự) là gì?
3. Data directory: gợi ý D:\lms\minio-data
```
Sau khi có thông tin:
```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
  (New-Object System.Net.WebClient).DownloadFile(\
    'https://dl.min.io/server/minio/release/windows-amd64/minio.exe', \
    'D:\lms\minio.exe')\""
```

---

## BƯỚC 6: Tạo cấu trúc thư mục project

```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  New-Item -ItemType Directory -Force -Path '{PROJECT_ROOT}'; \
  New-Item -ItemType Directory -Force -Path '{PROJECT_ROOT}\logs'; \
  New-Item -ItemType Directory -Force -Path '{PROJECT_ROOT}\minio-data'; \
  New-Item -ItemType Directory -Force -Path '{PROJECT_ROOT}\backups'; \
  Write-Host 'Directories created OK'\""
```

---

## BƯỚC 7: Tạo PostgreSQL database cho LMS

Hỏi người dùng:
```
Tôi sẽ tạo database PostgreSQL cho LMS. Anh muốn:
1. Tên database: (gợi ý: lms_production)
2. Tên user: (gợi ý: lms_user)
3. Password cho lms_user là gì?
```

```bash
ssh {SSH_USER}@{PROD_IP} "psql -U postgres -c \"CREATE DATABASE {DB_NAME};\""
ssh {SSH_USER}@{PROD_IP} "psql -U postgres -c \"CREATE USER {DB_USER} WITH PASSWORD '{DB_PASSWORD}';\""
ssh {SSH_USER}@{PROD_IP} "psql -U postgres -c \"GRANT ALL PRIVILEGES ON DATABASE {DB_NAME} TO {DB_USER};\""
```

---

## BƯỚC 8: Cấu hình Nginx

Hỏi người dùng:
```
Domain hoặc IP public của production server để cấu hình Nginx là gì?
(Ví dụ: lms.company.com hoặc 10.191.36.72)
Next.js sẽ chạy trên port nào? (gợi ý: 3000)
FastAPI sẽ chạy trên port nào? (gợi ý: 8000)
```

Tạo file nginx config:
```bash
ssh {SSH_USER}@{PROD_IP} "powershell -Command \"\
  \$config = @'
server {
    listen 80;
    server_name {DOMAIN_OR_IP};

    # Next.js
    location / {
        proxy_pass http://localhost:{NEXTJS_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # FastAPI
    location /api/ {
        proxy_pass http://localhost:{FASTAPI_PORT}/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # MinIO Console
    location /minio/ {
        proxy_pass http://localhost:9001/;
    }
}
'@
  Set-Content -Path 'C:\tools\nginx-1.25.3\conf\nginx.conf' -Value \$config\""
```

---

## BƯỚC 9: Báo cáo tổng kết

Sau khi hoàn tất, quét lại toàn bộ và báo cáo:

```bash
ssh {SSH_USER}@{PROD_IP} "node --version"
ssh {SSH_USER}@{PROD_IP} "python --version"
ssh {SSH_USER}@{PROD_IP} "git --version"
ssh {SSH_USER}@{PROD_IP} "pm2 --version"
ssh {SSH_USER}@{PROD_IP} "psql --version"
ssh {SSH_USER}@{PROD_IP} "redis-cli ping"
ssh {SSH_USER}@{PROD_IP} "if exist D:\lms\minio.exe (echo MinIO: OK) else (echo MinIO: MISSING)"
ssh {SSH_USER}@{PROD_IP} "nginx -version"
```

Hiển thị bảng tổng kết:
| Service | Trạng thái | Ghi chú |
|---------|-----------|---------|
| Node.js | ✅/❌ | version |
| Python | ✅/❌ | version |
| Git | ✅/❌ | version |
| PM2 | ✅/❌ | version |
| PostgreSQL | ✅/❌ | port 5432 |
| Redis | ✅/❌ | |
| MinIO | ✅/❌ | |
| Nginx | ✅/❌ | |

Nếu có service nào ❌, báo lỗi cụ thể và hỏi người dùng muốn xử lý thế nào.
Khi tất cả ✅ → Thông báo: "Infrastructure sẵn sàng. Chạy PHASE1_FIRST_DEPLOY.md để tiếp tục."

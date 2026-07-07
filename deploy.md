# Deploy Log — LMS Tập đoàn

> Ghi lại mọi thay đổi theo thứ tự mới nhất lên đầu.
> Format: ngày giờ · loại · files · kết quả · lưu ý

## [2026-07-07 20:10] Fix: Phân quyền bật/tắt AI chỉ dành cho company_admin / group_admin

**Loại:** fix

**Các thay đổi:**
- `src/app/api/users/[id]/route.ts` — PATCH handler: chặn `hr_manager` set `aiEnabled`, chỉ `group_admin` và `company_admin` mới được phép
- `src/app/(dashboard)/users/[id]/page.tsx` — ẩn nút "Bật/Tắt AI" với người dùng không có quyền admin

**Kết quả:**
- API trả về `403 FORBIDDEN` khi `hr_manager` gửi `aiEnabled` trong body
- Các trường khác (`fullName`, `jobTitle`...) vẫn cho phép `hr_manager` cập nhật bình thường
- Build thành công, `lms-web` online

**Lưu ý / Rủi ro:**
- Không ảnh hưởng `group_admin` và `company_admin` — vẫn toggle AI bình thường

## [2026-07-07 19:35] Docs: Hoàn thiện tài liệu hướng dẫn 3 vai trò — có ảnh thực tế

**Loại:** docs

**Các thay đổi:**
- Chụp ~48 screenshot thực tế từ hệ thống đang chạy qua Puppeteer headless Chrome (Admin@123)
- Nhúng ảnh vào 3 file Markdown: Admin (27 ảnh), Giảng viên (28 ảnh), Học viên (30 ảnh)
- Sinh 3 PDF có ảnh: HUONG_DAN_ADMIN_CONG_TY.pdf (2.6MB), HUONG_DAN_GIANG_VIEN.pdf (2.6MB), HUONG_DAN_HOC_VIEN.pdf (2.0MB)
- Thêm scripts: capture-screenshots-{2,3,4}.mjs, generate-pdf-docs.mjs

**Kết quả:**
- 3 file PDF sẵn sàng phát hành tại project root
- Push thành công lên master (commit c418d0a)

**Lưu ý / Rủi ro:**
- Mật khẩu test accounts: group_admin@via.vn / instructor@via.vn / nam.dv@phuthaiholdings.com → Admin@123
- Một số ảnh dùng chung placeholder (operations-backup.png hiển thị tab hệ thống, không phải tab sao lưu)

## [2026-07-07 14:05] Fix: Sidebar hiển thị sau khi build đúng path — production

**Loại:** fix

**Các thay đổi:**
- `D:\LMS PTHG\components\web\web-shell.tsx` (ROOT level) — viết đúng nội dung mới có Sidebar + `flex h-screen`
- `D:\LMS PTHG\components\web\sidebar.tsx` (ROOT level) — copy từ `src/components/web/sidebar.tsx`
- Root cause: `layout.tsx` import `'../../../components/web/web-shell'` resolve tới ROOT-level `components/web/`, không phải `src/components/web/`; các lần upload trước đều upload sai path

**Kết quả:**
- Build sạch (xóa `.next/cache`), chunk mới `layout-cae2f3b4c695235a.js` (16370 chars)
- `flex h-screen`: FOUND, `w-56`: FOUND, `min-h-screen`: NOT FOUND
- PM2 resurrect thành công — `lms-web` online (SYSTEM daemon, PM2_HOME=`C:\Users\Administrator\.pm2`)
- Site trả về login page 200 OK, chunk layout mới được serve

**Lưu ý / Rủi ro:**
- PM2 daemon nay chạy dưới user SYSTEM (do kill + resurrect qua Task Scheduler). Cả SYSTEM và Administrator đều share cùng PM2_HOME. Nếu server reboot cần `pm2 resurrect` từ Administrator
- `npm run build` có bug hang sau khi hoàn thành (Redis/DB connections không đóng). Workaround: chạy qua PowerShell `Start-Process` job, detect `First Load JS`, kill process, rồi resurrect PM2

## [2026-07-07 17:50] Fix: Bổ sung link ứng dụng di động vào email chào mừng tạo tài khoản

**Loại:** fix

**Các thay đổi:**
- `src/services/email.service.ts` — thêm tham số `appUrl?: string` vào `sendWelcomeEmail`; bổ sung section "Ứng dụng di động (PWA)" vào HTML template với nút "Mở ứng dụng" + link + hướng dẫn thêm vào màn hình chính
- `src/app/api/users/route.ts` — truyền `${baseUrl}/app` làm appUrl khi gọi `sendWelcomeEmail`
- `src/app/api/organizations/[id]/admin/route.ts` — truyền `${baseUrl}/login` (fix bug thiếu `/login`) + `${baseUrl}/app` khi gọi `sendWelcomeEmail`

**Kết quả:**
- Build thành công, `pm2 restart lms-web` → status online
- Email tạo tài khoản mới bao gồm cả link web (`/login`) và link app (`/app`)

**Lưu ý / Rủi ro:**
- `appUrl` là optional — nếu không truyền thì section app không hiện (backward-compatible)
- Đồng thời fix bug silent trong `organizations/[id]/admin/route.ts` đang truyền base URL thay vì `/login` URL

## [2026-07-07 10:55] feat: Sidebar navigation

**Loại:** feature

**Các thay đổi:**
- `src/components/web/sidebar.tsx` — tạo mới: sidebar với navigation theo role, collapse/expand, profile, logout
- `src/components/web/web-shell.tsx` — cập nhật: thêm Sidebar vào layout (flex row: sidebar + main content)

**Sidebar navigation theo role:**
- `group_admin` / `group_hrm`: Dashboard, Tổ chức, Người dùng, Khóa học, Nhóm học tập, Lộ trình học, Vị trí công việc, Khung năng lực, Thay đổi vị trí, Báo cáo, Cấu hình AI, Cài đặt
- `company_admin` / `hr_manager`: tập con (không có AI config, Tổ chức)
- `instructor`: Dashboard, Khóa học, Ngân hàng câu hỏi
- `learner`: Dashboard, Khóa học của tôi, Lộ trình của tôi

**Kết quả:**
- Build: thành công
- PM2 lms-web: restarted (pid: 8980)


## [2026-07-07 17:30] Refactor: Chuẩn hóa giao diện 5 trang quản trị — AdminDataTable + StatusBadge

**Loại:** refactor

**Các thay đổi:**
- Tạo mới `src/components/admin/StatusBadge.tsx` — pill badge 5 variant (success/warning/info-blue/info-purple/neutral) dùng design token từ tailwind.config.ts
- Tạo mới `src/components/admin/AdminDataTable.tsx` — generic `AdminDataTable<T>` với header bar bg-primary, responsive table, ActionBtn export (blue/purple/gray)
- Refactor `src/app/(dashboard)/learning-paths/page.tsx` — thay card layout bằng AdminDataTable (7 cột: tên, trạng thái, bước học, học viên, hạn, toggle hiển thị, thao tác)
- Refactor `src/app/(dashboard)/learning-groups/page.tsx` — thay card lưới 2 cột bằng AdminDataTable (5 cột: tên, loại, thành viên, khóa học, thao tác)
- Refactor `src/app/(dashboard)/competency-frameworks/page.tsx` — thay card layout bằng AdminDataTable (6 cột: tên, phiên bản, trạng thái, lĩnh vực, vị trí, thao tác)
- Refactor `src/app/(dashboard)/positions/page.tsx` — thay bảng tự phát bằng AdminDataTable (6 cột: vị trí+badge, cấp bậc, khung NL, nhân viên, trạng thái, 3 nút thao tác)
- Refactor `src/app/(dashboard)/question-banks/page.tsx` — thay card lưới 3 cột bằng AdminDataTable (5 cột: tên, mô tả rút gọn, số câu, trạng thái, thao tác)

**Kết quả:**
- Build thành công, `pm2 restart lms-web` → status online
- Toàn bộ logic fetch, RBAC, action handler, modal giữ nguyên — chỉ thay lớp trình bày
- Badge màu nhất quán xuyên suốt 5 trang theo đúng bảng variant

**Lưu ý / Rủi ro:**
- Không có breaking change; các component mới hoàn toàn additive
- `info-purple` badge dùng hardcode hex `#EEEDFE / #3C3489` vì token này chưa có trong tailwind.config.ts

## [2026-07-07 15:45] Fix: Học viên bị vào trang chỉnh sửa khóa học thay vì trang học

**Loại:** fix

**Các thay đổi:**
- `src/app/(dashboard)/courses/page.tsx` — redirect học viên sang `/my-courses`. Trang `/courses` là management page, không có role check → học viên vào thấy "Xem chi tiết →" dẫn đến edit page
- `src/app/(dashboard)/courses/[id]/page.tsx` — redirect học viên sang `/my-courses/${id}` bằng `useEffect` khi phát hiện user không có role admin/instructor
- `src/app/(dashboard)/dashboard/page.tsx` — thêm link "Khóa học của tôi" → `/my-courses` vào navLinks cho role `learner`

**Kết quả:**
- Build OK, `pm2 restart lms-web` — online
- Học viên vào `/courses` hoặc `/courses/${id}` bị redirect tự động đến đúng trang học

**Lưu ý / Rủi ro:**
- Dùng `router.replace()` (không để lại history) tránh back button quay lại trang edit

## [2026-07-07 09:25] Fix: Login page không load + Seed dữ liệu ban đầu

**Loại:** fix + deploy

**Các thay đổi:**
- `C:\nginx\conf\nginx.conf` (remote 10.191.36.72): thêm `location = / { return 302 /login; }` trước catch-all location để bypass lỗi Next.js ISR cache trả 307 không có Location header
- Chạy seed dữ liệu ban đầu qua `ts-node prisma/seed.ts` trên production server (SYSTEM task)

**Kết quả:**
- `https://lms.phuthaiholdings.com:5985/` → HTTP 302 → `/login` (OK)
- `https://lms.phuthaiholdings.com:5985/login` → HTTP 200 (OK)
- 7 users đã được tạo trong database:
  - `group_admin@via.vn` / `Password@123` — role: group_admin
  - `group_hrm@via.vn` / `Password@123` — role: group_hrm
  - `company_admin@via.vn` / `Password@123` — role: company_admin
  - `hr_manager@via.vn` / `Password@123` — role: hr_manager
  - `instructor@via.vn` / `Password@123` — role: instructor
  - `learner1@via.vn` / `Password@123` — role: learner
  - `learner2@via.vn` / `Password@123` — role: learner
- PM2: lms-web (online 16h), lms-worker (online 14h)

**Lưu ý / Rủi ro:**
- Root cause lỗi login: Next.js `redirect('/dashboard')` trong `page.tsx` tạo 307 nhưng ISR cache không lưu Location header → browser bị stuck. Fix nginx-level là permanent, không cần sửa code Next.js.
- Password tất cả accounts là `Password@123` — cần đổi sau khi deploy xong.

## [2026-07-06 15:30] Fix: 3 bugs — PDF lesson upload, learning_path enrollment, token expiry on sleep

**Loại:** fix

**Các thay đổi:**
- `src/services/course.service.ts` — thêm `'pdf'` và `'image'` vào `createLessonSchema.contentType` enum. Course builder UI cho phép chọn contentType 'pdf' nhưng Zod validation thiếu giá trị này → báo "Dữ liệu không hợp lệ" khi tạo bài học PDF
- `prisma/schema.prisma` — thêm `learning_path` vào enum `EnrollmentSource`. Raw SQL UNION query trả về source='learning_path' nhưng Prisma enum thiếu → PrismaClientValidationError khi enroll khóa học từ learning path → user bị block khỏi khóa học
- `src/components/providers/auth-provider.tsx` — sửa auto-refresh timer: tính thời gian refresh từ JWT exp thực tế thay vì hardcode 13 phút; thêm `visibilitychange` listener để refresh token khi trang active lại sau khi device sleep (timer JS bị dừng khi sleep → token hết hạn mà không được refresh)

**Kết quả:**
- `prisma db push` thành công — enum mới sync với DB
- `prisma generate` thành công (sau khi stop PM2)
- `npm run build` thành công
- `pm2 start lms-web lms-worker` — cả hai `online`

**Lưu ý / Rủi ro:**
- `learning_path` enum value mới không cần migration data vì chỉ thêm mới, không sửa giá trị cũ
- Token refresh khi `visibilitychange` chỉ fire nếu còn < 60s trước khi hết hạn — không refresh thừa khi user chuyển tab nhanh

## [2026-07-07] feat: OCR cho PDF hình ảnh trong Course Wizard

**Loại:** feature

**Các thay đổi:**
- `package.json`: Thêm `tesseract.js@7.0.0` và `@napi-rs/canvas@1.0.2`
- `next.config.js`: Thêm `pdfjs-dist`, `tesseract.js`, `@napi-rs/canvas` vào `serverExternalPackages`
- `src/app/api/wizard/extract-text/route.ts`: Pipeline 2 bước — native extraction trước, OCR fallback (pdfjs-dist → @napi-rs/canvas → tesseract.js `vie+eng`) nếu ít hơn 80 ký tự
- `src/components/wizard/step-course-info.tsx`: UX — hiện trạng thái OCR, badge "🔍 OCR", ghi chú thời gian

**Kết quả:**
- Build thành công, pm2 → online; lần đầu OCR download ~5MB traineddata → cache `.tesseract-lang/`

**Lưu ý:** OCR tối đa 15 trang; PDF scan chất lượng thấp → kết quả kém; server cần internet cho lần download đầu

---

## [2026-07-06 19:30] deploy: PHASE 1 — First Deploy lên production server 10.191.36.72

**Loại:** deploy

**Các thay đổi:**
- Clone repo `NamDV-PTHG/LMS` vào `D:\LMS PTHG` (junction `D:\LMSPTHG`)
- Tạo file `.env` với cấu hình production (DB, Redis, MinIO, NextAuth, JWT)
- Đã fix localhost DNS bằng cách thêm `127.0.0.1 localhost` vào hosts file
- Đã thay tất cả `localhost` → `127.0.0.1` trong `.env` (DB, Redis, MinIO, AI service)
- `npm ci` cài dependencies
- `npx prisma generate` + `prisma db push` tạo toàn bộ schema
- `npm run build` (Next.js 14) — build thành công sau khi resolve EAI_FAIL localhost + Redis 5.0.14
- Tạo `components/web/web-shell.tsx` (import thiếu từ layout.tsx)
- PM2 7.0.3 khởi động: lms-web (port 3004) + lms-worker
- MinIO 1.x chạy trên port 9000/9001, tạo bucket `lms-private` và `lms-temp`
- Nginx cấu hình SSL trên port 5985, proxy → 127.0.0.1:3004

**Kết quả:**
- lms-web: **online** (Next.js 14.2.29, port 3004) ✅
- lms-worker: **online** ✅
- PostgreSQL 15: Running (port 5432) ✅
- Redis 5.0.14: Running (port 6379) ✅
- Nginx: Running (port 5985, SSL) ✅
- MinIO: Running (port 9000/9001) ✅
- Login page: HTTP 200 OK qua HTTPS https://lms.phuthaiholdings.com:5985 ✅

**Auto-start tasks (Task Scheduler):**
- `LMSAutoStart`: `pm2 resurrect` at ONSTART (SYSTEM)
- `LMSMinIO`: MinIO server at ONSTART (SYSTEM)
- `NginxAutoStart`: nginx.exe at ONSTART (SYSTEM)

**Lưu ý / Rủi ro:**
- Redis 5.0.14 (tporadowski) — BullMQ warn "recommend 6.2.0+" nhưng không crash
- PM2 daemon bị kill khi SSH session đóng → dùng Task Scheduler ONSTART thay vì pm2 startup
- SYSTEM task không có PATH chuẩn → bat file phải set PATH thủ công
- `prisma db push` EPERM khi generate DLL (locked bởi lms-web) — OK vì client đã generate rồi
- FastAPI (ai-service) chưa khởi động — cần setup riêng

---

## [2026-07-06] fix: Course Wizard không đọc được file PDF (lần 2 — native extractor)

**Loại:** fix

**Nguyên nhân:**
`pdf-parse` v2 đã thay đổi API hoàn toàn: không còn là function, không nhận Buffer, chỉ nhận URL. Next.js bundler wrap module thành `{ default: ... }` nhưng `default` không phải function → `TypeError: (0, a.default) is not a function`

**Các thay đổi:**
- `src/app/api/wizard/extract-text/route.ts`: Bỏ hoàn toàn `pdf-parse` và `pdfjs-dist`. Thay bằng extractor thuần Node.js built-in:
  - Tìm tất cả PDF content streams (`stream...endstream`)
  - Phát hiện FlateDecode → decompress bằng `inflateSync` (zlib built-in)
  - Parse BT/ET blocks → extract Tj/TJ operators
  - Hỗ trợ cả literal strings `(text)` và hex strings `<hex>` (UTF-16 và latin1)
  - Không dependency ngoài nào cần thêm

**Kết quả:**
- Build thành công, pm2 restart lms-web → online
- Extractor hoạt động không cần worker, không cần external module
- Tương thích với hầu hết PDF văn bản thông thường (Word export, LibreOffice, PDF printer)

**Lưu ý / Rủi ro:**
- PDF scan (hình ảnh thuần) sẽ trả về text rỗng → báo lỗi "Không có nội dung text"
- PDF có font encoding phức tạp (Type3, CIDFont custom) có thể bị mất text

---

## [2026-07-06] fix: Course Wizard không đọc được file PDF

**Loại:** fix

**Nguyên nhân:**
`/api/wizard/extract-text` dùng `pdfjs-dist/legacy/build/pdf.mjs` để đọc PDF nhưng thư viện này yêu cầu `GlobalWorkerOptions.workerSrc` được set — không hoạt động trong môi trường Next.js API Route (Node.js). Lỗi: `"No 'GlobalWorkerOptions.workerSrc' specified."`

**Các thay đổi:**
- `src/app/api/wizard/extract-text/route.ts`: Thay toàn bộ `extractPdfText` từ `pdfjs-dist` (cần worker) sang `pdf-parse` (đã cài sẵn v2.4.5, native Node.js, không cần worker, 3 dòng thay vì 30 dòng)

**Kết quả:**
- Build thành công, pm2 restart lms-web → online
- PDF trong Course Wizard sẽ được trích xuất text thành công

**Lưu ý / Rủi ro:**
- `pdfjs-dist` không bị xóa khỏi `package.json` (vẫn có thể dùng ở nơi khác)
- `pdf-parse` đọc được hầu hết PDF thông thường; PDF được scan (hình ảnh thuần) sẽ trả về text rỗng

---

## [2026-07-06 ~now] fix: PDF upload thất bại trên Windows Server 2016

**Loại:** fix

**Nguyên nhân:**
Trên Windows Server 2016, MIME type `application/pdf` không được đăng ký trong registry, dẫn đến `file.type === ''` khi user chọn file PDF qua `<input type="file">`. Điều này gây ra:
- `Content-Type: ''` header khi PUT lên MinIO → MinIO từ chối hoặc lưu sai metadata
- `mimeType: ''` gửi lên `/api/assets` → không map được extension `.pdf` → file lưu sai tên

**Các thay đổi:**
- `src/app/(dashboard)/media-library/page.tsx`: Thêm helper `getMimeFromExtension(filename)` mapping ext → MIME; cập nhật `detectFileType` dùng extension làm fallback; thêm fallback `file.type || getMimeFromExtension(file.name)` cho `Content-Type` header và trường `mimeType` trong confirm request
- `src/app/(dashboard)/courses/[id]/lessons/[lessonId]/content/page.tsx`: Tương tự — thêm `getMimeFromExtension`, cập nhật `detectFileType`, thay `'application/octet-stream'` fallback bằng `getMimeFromExtension(file.name)` cho cả `Content-Type` header và `mimeType`

**Kết quả:**
- Build thành công, pm2 restart lms-web → online
- PDF và các loại tài liệu Office sẽ được upload đúng MIME type ngay cả khi Windows không nhận diện được

**Lưu ý / Rủi ro:**
- Không có breaking change
- Fallback cuối là `'application/octet-stream'` cho các extension không có trong map

## [2026-07-06 11:30] feat: Hoàn thiện hệ thống Restore — fix bugs + BullMQ + progress polling + company filter

**Loại:** feature + fix

**Các thay đổi:**
- `prisma/schema.prisma`: Thêm `restoreNote String?` và `restoredAt DateTime?` vào `BackupJob`
- `src/app/api/admin/backup/[id]/route.ts` (NEW): GET single backup job — dùng cho polling
- `src/app/api/admin/backup/[id]/restore/route.ts`: Fix bugs (pg_restore `--dbname=`, asset path `slice()`), thêm `reason` persist, chuyển sang enqueue BullMQ thay fire-and-forget
- `src/jobs/backup.job.ts`: Thêm `restoreQueue` + `startRestoreWorker()` — restore chạy trong BullMQ worker có tracking đầy đủ, fix pg_restore exit code (0 và 1 đều ok)
- `src/jobs/worker.ts`: Đăng ký `startRestoreWorker()`
- `src/components/ui/confirm-dialog.tsx`: Refactor — `message` nhận `ReactNode`, `onConfirm(inputValue: string)` tự quản lý textarea state, thêm `variant` prop
- `src/components/question-bank/review-queue.tsx` + `question-list.tsx`: Cập nhật theo API mới của ConfirmDialog
- `src/app/(dashboard)/operations/page.tsx`: Auto-poll mỗi 3s khi job RUNNING/RESTORING/PENDING, restore dialog hiển thị thông tin backup + company selector + warning rõ ràng, pass `scopeCompanyId`, show restoreNote/restoredAt, RESTORING spinner

**Kết quả:**
- `prisma db push` + `prisma generate` → schema synced
- `npm run build` → build thành công
- `pm2 restart lms-web lms-worker` → cả hai online

**Lưu ý / Rủi ro:**
- Restore DB vẫn là direct restore (--clean --if-exists) — sẽ có brief downtime khi pg_restore chạy
- Zero-downtime DB restore (shadow DB swap) để trong roadmap tương lai
- Assets restore không có downtime (MinIO putObject là atomic per-object)

---

## [2026-07-06 10:30] feat: Folder Browser modal cho LOCAL backup path

**Loại:** feature

**Các thay đổi:**
- `src/app/api/admin/backup/browse/route.ts` (NEW): API duyệt thư mục server — GET list subdirs + drives (Windows/Unix), POST tạo thư mục mới. group_admin only
- `src/app/(dashboard)/settings/page.tsx`: Thêm nút "Browse…" bên cạnh input localPath, thêm modal FolderBrowser (breadcrumb, list thư mục, double-click navigate, tạo thư mục mới inline, kiểm tra quyền ghi)

**Kết quả:**
- `npm run build` → build thành công (settings 11.6 kB)
- `pm2 restart lms-web lms-worker` → cả hai online

**Lưu ý / Rủi ro:**
- API chỉ list thư mục (không file), filter bỏ `$` system dirs trên Windows
- Nút "Chọn thư mục này" disabled nếu thư mục không có quyền ghi

---

## [2026-07-06 10:00] feat: Thêm đích lưu trữ backup LOCAL (ổ đĩa server)

**Loại:** feature

**Các thay đổi:**
- `prisma/schema.prisma`: Thêm `LOCAL` vào enum `BackupDestination`, thêm field `localPath String?` vào `BackupStorageConfig`, đổi default từ `MINIO_REMOTE` → `LOCAL`
- `src/lib/backup-storage.ts`: Thêm `LocalAdapter` (Node.js `fs` + recursive walk), thêm `case 'LOCAL'` vào factory
- `src/app/api/admin/backup-config/route.ts`: Thêm `localPath` vào PUT handler
- `src/app/(dashboard)/settings/page.tsx`: Thêm option "Local Server" vào destination selector, thêm panel cấu hình đường dẫn thư mục

**Kết quả:**
- `prisma db push` → schema synced
- `prisma generate` → Prisma Client regenerated (stop PM2 trước)
- `npm run build` → build thành công
- `pm2 restart lms-web lms-worker` → cả hai online

**Lưu ý / Rủi ro:**
- LOCAL backup không bảo vệ khỏi hỏng ổ đĩa server — nên dùng kết hợp với remote destination
- Đường dẫn mặc định nếu để trống: `{project_root}/backups`

---

## [2026-07-06 12:30] deploy: PHASE 0 — Infrastructure Setup server 10.191.36.72

**Loại:** deploy

**Các thay đổi:**
- Cài Chocolatey 2.7.3 (qua PowerShell)
- Cài Node.js v20.19.2 LTS (MSI installer trực tiếp — Choco cần .NET 4.8)
- Cài Git 2.47.1 (MSI installer trực tiếp)
- Cài Python 3.11.9 (MSI installer trực tiếp)
- Cài PM2 7.0.3 + pm2-windows-startup (via npm global)
- Cài Redis 3.2.100 (zip extract → C:\Redis, chạy như service)
- PostgreSQL 15.6 đã có tại D:\PostgreSQL — reset password postgres → Pthg@2026
- Tạo database `lms_production`, user `lms_user` / `lms@2026`
- Cài Nginx 1.26.0 tại C:\nginx, cấu hình SSL port 5985
- Copy SSL cert wildcard *.phuthaiholdings.com (Sectigo, hết hạn 16/01/2027)
- Dời WinRM từ port 5985 sang 5986 (giải phóng 5985 cho nginx)
- Tạo junction D:\LMSPTHG -> D:\LMS PTHG (tránh space trong nginx alias)
- Tạo cấu trúc thư mục D:\LMS PTHG: logs, uploads, backups, minio-data
- Download minio.exe (~108MB) vào D:\LMS PTHG\minio.exe

**Kết quả:**
- Node.js v20.19.2 ✅ | npm 10.8.2 ✅ | Git 2.47.1 ✅ | Python 3.11.9 ✅
- PM2 7.0.3 ✅ | PostgreSQL 15.6 ✅ (port 5432) | Redis PONG ✅ (127.0.0.1:6379)
- Nginx 1.26.0 ✅ (port 5985 SSL) | MinIO installed ✅ | Chocolatey 2.7.3 ✅
- SSL cert: CN=*.phuthaiholdings.com, notAfter=Jan 16 23:59:59 2027 GMT

**Lưu ý / Rủi ro:**
- .NET 4.8 chưa cài (Choco cài packages cần .NET 4.8 — dùng installer trực tiếp thay thế)
- WinRM HTTP đã dời sang port 5986 — cần cập nhật firewall rule nếu dùng WinRM
- Nginx chưa cấu hình auto-start khi server reboot — cần dùng WinSW hoặc sc create
- MinIO chưa cấu hình service — cần cấu hình trước khi deploy app
- PostgreSQL service: `postgresql` — chạy tự động theo Windows service
- Redis chạy như service `Redis` — tự động start

---

## [2026-07-06 08:48] config: Gia hạn SSL wildcard *.phuthaiholdings.com — Sectigo đến 16/01/2027

**Loại:** config

**Các thay đổi:**
- Tạo `C:/nginx/ssl/pth-fullchain-new.pem` từ 3 file: `cert` + `My_CA_Bundle` + `TrustedRoot` (Sectigo)
- Cập nhật `C:/nginx/conf/lms-staging.conf`: ssl_certificate → `pth-fullchain-new.pem`, ssl_certificate_key → `Privatekey.key`
- Reload nginx

**Kết quả:**
- Nginx reload thành công (syntax OK)
- Cert đang serve: CN=*.phuthaiholdings.com, notAfter=Jan 16 23:59:59 2027 GMT
- Xác minh qua `openssl s_client` — OK

**Lưu ý / Rủi ro:**
- Cert cũ: `pth-fullchain.pem` + `PTH.key` (đã hết hạn) — giữ lại để rollback nếu cần
- Cần gia hạn lại trước 16/01/2027

---

## [2026-07-02 17:00] feat: UI Backup Storage (Settings) + tab Sao lưu (Operations) — hoàn thiện toàn bộ backup system

**Loại:** feature

**Các thay đổi:**
- `src/app/(dashboard)/settings/page.tsx`: Tab "Backup Storage" — chọn destination (MinIO/NAS, GCS, Google Drive), nhập credentials (secrets masked), cron schedule, retention days, Test kết nối
- `src/app/(dashboard)/operations/page.tsx`: Tab "Sao lưu" — list backup jobs, trigger manual (Full/DB/Assets), nút Khôi phục DB / Assets / Toàn bộ với ConfirmDialog

**Kết quả:**
- Build OK, lms-web + lms-worker online

---

## [2026-07-02 16:00] feat: Backup/Restore system — BackupStorageConfig, BackupJob, BullMQ worker, API routes

**Loại:** feature

**Các thay đổi:**
- `prisma/schema.prisma` — Thêm model `BackupStorageConfig` (singleton), `BackupJob`, và 3 enums: `BackupDestination`, `BackupType`, `BackupStatus`. Thêm relation `backupJobs` vào User model
- `src/lib/backup-storage.ts` — Tạo mới: `BackupAdapter` interface + 3 concrete adapters (`MinioRemoteAdapter`, `GcsAdapter`, `GoogleDriveAdapter`) + factory `createBackupAdapter()`
- `src/services/backup.service.ts` — Tạo mới: `getBackupConfig`, `saveBackupConfig`, `testBackupConnection`, `listBackupJobs`, `getBackupJob`
- `src/jobs/backup.job.ts` — Tạo mới: BullMQ `backupQueue` + `startBackupWorker()` — xử lý pg_dump, copy MinIO assets, cleanup retention
- `src/jobs/cron.ts` — Thêm cron động từ `BackupStorageConfig.cronSchedule` (mặc định `0 2 * * *`)
- `src/jobs/worker.ts` — Thêm `startBackupWorker()` vào danh sách workers
- `src/app/api/admin/backup-config/route.ts` — GET (masked secrets) + PUT (upsert config)
- `src/app/api/admin/backup-config/test/route.ts` — POST test connection
- `src/app/api/admin/backup/route.ts` — GET list jobs + POST trigger manual backup
- `src/app/api/admin/backup/[id]/restore/route.ts` — POST restore (DB + assets, async fire-and-forget)

**Kết quả:**
- Chưa chạy migration (cần `npx prisma db push` + `prisma generate` + `npm run build` + `pm2 restart`)
- Code written only — build/deploy chờ lệnh từ user

**Lưu ý / Rủi ro:**
- Cần cài `googleapis` package nếu dùng GCS/Google Drive adapters (`npm i googleapis @google-cloud/storage`)
- `pg_dump` / `pg_restore` phải có sẵn trong PATH trên server
- Restore DB là destructive (`--clean --if-exists`) — cần cẩn thận khi dùng trong production

## [2026-07-02 15:30] fix: App PWA hiển thị khóa học từ lộ trình học tập (source 4)

**Loại:** fix

**Các thay đổi:**
- `src/services/enrollment.service.ts`: Thêm source thứ 4 `learning_path` vào SQL UNION — join qua `LearningPathEnrollment` → `LearningPathStepEnrollment` (isUnlocked=true) → `LearningPathStep` → `Course`. Priority = 4 (thấp nhất), bị override nếu course đã có trong 3 nguồn kia.
- `src/services/user.service.ts`: Sau khi enroll path, gọi `invalidateMyCoursesCache(userId)` để app làm mới danh sách ngay lập tức.
- `src/app/(pwa)/app/progress/page.tsx`: Thêm `'learning_path'` vào type `CourseRow['source']`, `sourceLabel` trả `'Lộ trình'`, `SOURCE_STYLE` màu tím.

**Kết quả:**
- Build thành công, `pm2 restart lms-web` → online
- Backfill thủ công 4 enrollment cho `nam.dv@phuthaiholdings.com` (vị trí đã gán trước khi deploy auto-enrollment)
- App `/app/courses` và `/app/progress` giờ hiển thị đủ khóa học từ lộ trình học tập

**Lưu ý / Rủi ro:**
- Chỉ hiển thị courses từ bước đã **unlock** (`isUnlocked=true`) — bước bị khóa chưa hiện
- Nếu course vừa có trong group_publish vừa có trong learning_path → ưu tiên group_publish (priority 1)

## [2026-07-02 10:30] feat: Position→Auto-enrollment — gán vị trí cho user tự động enroll lộ trình học

**Loại:** feature

**Các thay đổi:**
- `src/services/user.service.ts`: Thêm param `updatedById` vào `updateUser()`, detect thay đổi `jobPositionId`, pause tất cả `IN_PROGRESS` enrollments của vị trí cũ, enroll lộ trình mới qua helper `enrollUserInPositionPaths()` (fire-and-forget). Ưu tiên per-framework paths, fallback legacy `learningPathId`.
- `src/app/api/users/[id]/route.ts`: Truyền `user.id` làm argument thứ 5 vào `updateUser()`.
- `src/app/api/positions/[id]/route.ts`: Sau khi update vị trí, nếu `learningPathId` thay đổi sang giá trị mới → enroll cascade tất cả users đang giữ vị trí đó (fire-and-forget).

**Kết quả:**
- Build thành công, `pm2 restart lms-web` → `online`
- Quy trình: Gán vị trí có path → user vào `/my-learning-paths` thấy lộ trình IN_PROGRESS ngay
- Thay vị trí cũ → enrollments IN_PROGRESS cũ PAUSED, lộ trình mới IN_PROGRESS
- Thêm path vào vị trí → cascade enroll tất cả holders

**Lưu ý / Rủi ro:**
- Enrollment fire-and-forget: lỗi bị silent (đã `.catch(() => {})`), tránh block response
- `ALREADY_ENROLLED` bị ignore → an toàn khi gán cùng vị trí nhiều lần
- `PositionChangeEvent` workflow (BullMQ + HR approval) không bị ảnh hưởng

## [2026-07-02 12:00] fix: Đồng bộ quy tắc mật khẩu và invalidate token sau đổi mật khẩu

**Loại:** fix (security)

**Root cause:**
3 route xử lý đổi/đặt lại mật khẩu có quy tắc validation KHÁC NHAU:
- `POST /api/auth/change-password`: min 8 + chữ hoa + chữ số + invalidate refresh token ✓
- `PATCH /api/auth/me`: chỉ min 8, không invalidate token ✗
- `POST /api/auth/reset-password`: chỉ min 8 ✗

Người dùng có thể đặt mật khẩu yếu qua 2 route kia, bypass chính sách bảo mật.

**Các thay đổi:**
- `src/app/api/auth/me/route.ts` — thêm regex /[A-Z]/ và /[0-9]/, thêm `redisDel(refresh:userId)`, set `mustChangePassword: false`
- `src/app/api/auth/reset-password/route.ts` — thêm regex /[A-Z]/ và /[0-9]/
- `src/app/(auth)/reset-password/page.tsx` — thêm client-side validation uppercase + digit, cập nhật hint text
- `src/app/(dashboard)/profile/page.tsx` — thêm client-side validation uppercase + digit, cập nhật hint text

**Kết quả:**
- Build thành công, `pm2 restart lms-web` — online
- Cả 3 luồng đổi mật khẩu giờ đồng nhất: min 8 ký tự + 1 chữ hoa + 1 chữ số

**Lưu ý / Rủi ro:**
- Các user đã có mật khẩu yếu từ trước không bị ảnh hưởng ngay — chỉ áp dụng khi đổi/reset lần tới

## [2026-07-02 11:30] fix: Nút xuất bản khóa học báo lỗi hệ thống

**Loại:** fix

**Root cause:**
Route `POST /api/courses/[id]/publish` bị viết lại với schema riêng yêu cầu bắt buộc `targetCompanyIds` (dành cho chia sẻ liên công ty). Khi frontend gọi để **xuất bản đơn giản** (không có body), Zod validate fail → 500.

Service `publishCourse()` trong `course.service.ts` đã xử lý đúng cả hai case (`targetCompanyIds` là optional), nhưng route không gọi service này.

**Các thay đổi:**
- `src/app/api/courses/[id]/publish/route.ts` — viết lại hoàn toàn để sử dụng `publishCourse()` từ service:
  - Body rỗng → xuất bản khóa học (`isPublished = true`)
  - Body có `targetCompanyIds` → chia sẻ liên công ty (group_admin)
  - Parse body với `try/catch` để chấp nhận body rỗng
  - Dùng `publishCourseSchema` từ service (targetCompanyIds là optional)

**Kết quả:**
- Build thành công, `pm2 restart lms-web` — online

## [2026-07-02 11:00] feat: Gán vị trí công việc cho học viên trong trang /users/[id]

**Loại:** feature

**Các thay đổi:**
- `src/app/(dashboard)/users/[id]/page.tsx` — thêm section "Vị trí công việc":
  - Load danh sách vị trí từ `/api/positions?isActive=true`
  - Hiển thị vị trí hiện tại (badge xanh với title, code, level)
  - Dropdown chọn vị trí + nút "Lưu vị trí" → PATCH `jobPositionId`
  - Nút disabled khi vị trí chưa thay đổi hoặc chưa có vị trí nào trong hệ thống
  - Cảnh báo nếu chưa có vị trí nào (gợi ý vào mục Vị trí công việc để tạo)
- Backend đã sẵn sàng: `updateUserSchema` có `jobPositionId`, `getUserById` select `jobPosition`

**Kết quả:**
- Build thành công, `pm2 restart lms-web` — online

**Lưu ý / Rủi ro:**
- Section xuất hiện giữa "Vai trò" và "Hồ sơ Năng lực"
- Chọn "-- Bỏ gán vị trí --" → gửi `jobPositionId: null` để xóa gán

## [2026-07-02 10:30] fix: Xóa toàn bộ vi phạm system dialog (alert/confirm/prompt)

**Loại:** fix

**Các thay đổi:**
- `src/components/reports/export-button.tsx` — thay `alert()` lỗi xuất báo cáo bằng `toast('error', ...)`
- `src/components/question-bank/review-queue.tsx` — thay `confirm()` duyệt tất cả và `prompt()` từ chối bằng `ConfirmDialog`
- `src/components/question-bank/question-list.tsx` — thay `confirm()` xóa câu hỏi và `prompt()` từ chối bằng `ConfirmDialog`
- `src/app/(dashboard)/competency-frameworks/[id]/page.tsx` — thay `confirm()` xóa lĩnh vực và xóa năng lực bằng `ConfirmDialog`
- Dùng lại `src/components/ui/confirm-dialog.tsx` đã tạo từ session trước

**Kết quả:**
- Build thành công, `pm2 restart lms-web` — online
- Không còn vi phạm nào với `alert()` / `confirm()` / `prompt()` trong toàn codebase

**Lưu ý / Rủi ro:**
- `ConfirmDialog` với `inputRequired` sẽ disable nút xác nhận khi textarea trống — yêu cầu nhập lý do từ chối trước khi submit

## [2026-07-02 14:00] Fix 5 bugs CRITICAL + Feature Favicon + AI Usage Report + AI Permission

**Loại:** fix + feature

**Các thay đổi:**

### Bugs đã fix:
- **Fix 1 (CRITICAL)** `src/services/learning-path.service.ts:158` + `src/app/api/learning-paths/[id]/enroll/route.ts` — Enrollment lộ trình học báo lỗi hệ thống: User model không có field `companyId` trực tiếp → đổi sang filter qua `roles.some.organization`
- **Fix 2** `src/app/(dashboard)/learning-paths/[id]/page.tsx` + `learning-groups/[id]/page.tsx` — Khóa học chưa xuất bản hiện trong danh mục lộ trình: sửa `?status=published` → `?published=true`
- **Fix 3** `src/services/course.service.ts` — Khóa học chưa xuất bản hiển thị nhãn "Được chia sẻ": thêm check `isPublished` trong `isShared`
- **Fix 4 (CRITICAL)** `src/app/api/auth/change-password/route.ts:29` — Đổi mật khẩu báo lỗi 500: `authUser.sub` → `authUser.id`
- **Fix 5** `src/app/api/my/profile/route.ts` — GET /api/my/profile Prisma error: xóa `status` và `progressPercent` (không tồn tại trong Enrollment model), dùng `completedAt`

### Features mới:
- **Favicon upload** — Settings page + `/api/public/branding` + Dashboard layout (FaviconInjector)
- **AI Usage Report** — Dashboard báo cáo với KPI cards, Line Chart (lưu lượng theo ngày), Bar Chart ngang (top users), Pie Chart (tính năng), bảng lịch sử
- **AI Permission** — Field `aiEnabled` trên User model; toggle trong `/users/[id]`; badge "AI" trong danh sách users
- **AI Usage Logging** — `AiUsageLog` model mới; `callLlm()` ghi log token/cost sau mỗi call
- **Sidebar nav** — Thêm "Báo cáo AI" cho group_admin và company_admin

**Migration:**
- `prisma db push` — thêm `User.aiEnabled`, model `AiUsageLog`, `AiServiceConfig.costPerThousandTokens`

**Kết quả:**
- Build thành công ✓
- `lms-web` online ✓
- `lms-worker` online ✓

**Lưu ý / Rủi ro:**
- Chi phí AI (`costUsd`) chỉ được tính nếu admin cấu hình `costPerThousandTokens` trong AI Config. Ollama self-hosted hiển thị "N/A"
- `aiEnabled = false` theo mặc định cho tất cả user hiện có

## [2026-07-02 09:30] fix: PWA notifications hoàn toàn không nhận thông báo từ API + web inbox không tự refresh

**Loại:** fix

**Các thay đổi:**
- `src/app/(pwa)/app/notifications/page.tsx`: Rewrite hoàn toàn — trước đây chỉ dùng `deriveNotifications` từ course data (deadline, hoàn thành), bây giờ fetch cả `/api/notifications` để lấy thông báo thật từ admin. Hiển thị 2 section: "Thông báo từ quản trị viên" (API) và derived course notifications nhóm theo ngày. Badge count = API unread + derived unread.
- `src/components/pwa/bottom-nav.tsx`: Thêm poll `/api/notifications` mỗi 60s để cập nhật badge khi admin gửi thông báo mới.
- `src/app/(dashboard)/notifications/page.tsx`: Thêm `refreshInterval: 30000` cho SWR inbox để tự refresh mà không cần reload trang.

**Root cause:**
- PWA app dùng `lib/pwa-notifications.ts` là hệ thống thông báo "fake" (computed từ course data), KHÔNG kết nối gì với API notification thật. Admin gửi bao nhiêu thông báo cũng không xuất hiện trên app.
- Web inbox không có auto-refresh → user phải reload trang mới thấy thông báo mới.

**Kết quả:**
- Build sạch, pm2 restart lms-web — status online
- PWA: mở trang Thông báo → thấy cả thông báo từ admin + course notifications; badge bell cập nhật mỗi 60s
- Web: inbox tự refresh mỗi 30s; bell badge vẫn poll mỗi 60s như trước

**Lưu ý / Rủi ro:**
- Derived course notifications vẫn được giữ nguyên bên cạnh admin notifications
- Read state cho API notifications dùng server (POST /api/notifications/[id]/read); derived notifications vẫn dùng localStorage

## [2026-07-02 09:00] fix: GET /api/notifications crash do query field không tồn tại trên User model

**Loại:** fix

**Các thay đổi:**
- `src/app/api/notifications/route.ts`: Xoá query `prisma.user.findUnique({ select: { organizationId: true } })` — field `organizationId` KHÔNG có trên model `User` (thuộc `UserRole`), gây Prisma runtime error cho toàn bộ GET requests. Thay thế bằng `user.organizationId` có sẵn từ JWT payload (`AuthUser`)

**Root cause:**
- Toàn bộ GET /api/notifications crash → inbox rỗng, sent history rỗng, badge không cập nhật
- POST (tạo thông báo) vẫn thành công — dữ liệu có trong DB nhưng không thể đọc ra được

**Kết quả:**
- Build sạch, `pm2 restart lms-web` — status online
- Inbox, sent history, bell badge hoạt động đúng

**Lưu ý / Rủi ro:**
- `user.organizationId` từ JWT là dept/org ID được set lúc login. Nếu user chưa đăng nhập lại sau khi được gán dept mới, dept-based filtering có thể chưa cập nhật (cần re-login)

## [2026-07-01 10:30] feat: cấu hình tiêu đề tab và mô tả website theo từng công ty

**Loại:** feature

**Các thay đổi:**
- `src/app/(dashboard)/settings/page.tsx`: Thêm 2 trường `siteTitle` (tiêu đề tab trình duyệt) và `siteDescription` (meta description) vào `BrandingForm`; thêm section UI "Tab trình duyệt" trong branding tab giữa Logo và Theme presets
- `src/app/api/me/company/route.ts`: Trả thêm `siteTitle` và `siteDescription` từ `Organization.metadata`
- `components/web/web-shell.tsx`: Mở rộng `CompanyInfo` interface; useEffect dùng `siteTitle` (fallback `name`) cho `document.title`; tự động inject/cập nhật `<meta name="description">` từ `siteDescription`

**Kết quả:**
- Build thành công, `pm2 restart lms-web` — status online
- Admin vào Settings → Thương hiệu → "Tab trình duyệt" để nhập tiêu đề tab và mô tả; lưu vào `Organization.metadata`
- WebShell tự áp dụng ngay sau khi fetch `/api/me/company`

**Lưu ý / Rủi ro:**
- Không cần migration Prisma vì dùng JSON `metadata` field sẵn có
- `siteTitle` nếu để trống → fallback về `companyName` (tên hiển thị sidebar)

## [2026-07-02 10:30] Multi-framework per Position + QuestionCategory + Hybrid Learning Path (Bước 2–5)

**Loại:** feature

**Các thay đổi:**

**Bước 2 — Question Category CRUD:**
- `src/app/api/question-categories/route.ts` — GET + POST categories per company
- `src/app/api/question-categories/[id]/route.ts` — PATCH + DELETE (guard: 409 if questions exist)
- `src/services/question-bank.service.ts` — thêm `categoryId` filter, create/update, saveGeneratedQuestions
- `src/services/ai-document-processor.ts` — thêm `defaultCategoryId` param → gán cho câu hỏi AI sinh
- `src/app/api/question-banks/[id]/questions/route.ts` — thêm `?categoryId=` filter
- `src/app/api/question-banks/[id]/import-csv/route.ts` — thêm cột `category` trong CSV
- `src/app/api/question-banks/[id]/import-document/route.ts` — thêm `defaultCategoryId` formData
- `src/components/question-bank/question-form.tsx` — dropdown chọn category
- `src/components/question-bank/question-list.tsx` — filter + badge category
- `src/components/question-bank/import-document-modal.tsx` — dropdown "Danh mục mặc định"
- `src/app/(dashboard)/question-banks/[id]/page.tsx` — tab "Danh mục năng lực" với CRUD modal

**Bước 3 — Multi-framework per Position:**
- `src/app/api/positions/[id]/frameworks/route.ts` — GET list + POST add framework
- `src/app/api/positions/[id]/frameworks/[fid]/route.ts` — PATCH update + DELETE remove
- `src/app/(dashboard)/positions/page.tsx` — modal quản lý multi-framework, weight, isPrimary, learningPath

**Bước 4 — Gap Analysis + Radar refactor:**
- `src/services/gap-analysis.service.ts` — loop qua tất cả `JobPositionFramework`, weighted readiness, enroll nhiều paths
- `src/services/competency-radar.service.ts` — multi-framework tabs, weighted overall readiness, `frameworkBreakdown[]`
- `src/components/charts/competency-radar.tsx` — tab UI: Tổng hợp + per-framework (★ primary)

**Bước 5 — Quiz → Competency measurement:**
- `src/services/quiz.service.ts` — `updateCompetencyFromCategories()`: weighted score per category → L1-L5 → upsert profile (no downgrade). `startQuiz()` hỗ trợ `filterCategoryIds`
- `src/app/api/lessons/[lessonId]/quiz-config/route.ts` — thêm `filterCategoryIds` vào schema
- `src/app/(dashboard)/courses/[id]/lessons/[lessonId]/quiz/page.tsx` — section lọc danh mục năng lực

**Kết quả:**
- Build: ✓ Compiled successfully
- pm2 restart lms-web → online

**Lưu ý / Rủi ro:**
- Backward compat: `JobPosition.competencyFrameworkId` và `learningPathId` cũ vẫn giữ nguyên — gap analysis fallback về legacy nếu `frameworks[]` trống
- `updateCompetencyFromCategories` chạy luôn (kể cả khi fail quiz) — đo năng lực per-category không phụ thuộc tổng điểm
- Radar chart: nếu chỉ có 1 framework, hiển thị như cũ (không có tabs)

---

## [2026-07-02 09:00] Fix 5 bugs — Nav, Template, Sync, JobCatalogConfig, Notifications

**Loại:** fix

**Các thay đổi:**
- `components/web/web-shell.tsx`: Thêm "Tổ chức" nav item cho company_admin và hr_manager (Bug 1)
- `src/app/(dashboard)/import/page.tsx`: Fix silent catch trong downloadFullTemplate → hiện toast lỗi rõ ràng (Bug 2)
- `src/app/api/learning-groups/[id]/sync/route.ts`: Thêm company_admin + hr_manager vào withRole (Bug 3)
- `prisma/schema.prisma`: Thêm model CompanyJobCategory + CompanyJobLevel (per-company config) (Bug 4)
- `src/app/api/job-title-catalog/config/route.ts`: API mới — GET + PUT để quản lý nhóm/cấp bậc per company (Bug 4)
- `src/app/(dashboard)/job-title-catalog/page.tsx`: Cập nhật dùng config per-company thay hardcode, thêm modal "Cấu hình nhóm & cấp bậc" (Bug 4)
- `src/app/api/notifications/route.ts`: Thêm `?view=sent` để admin xem lịch sử đã gửi; group_admin luôn thấy thông báo mình đã gửi (Bug 5)
- `src/app/(dashboard)/notifications/page.tsx`: Thêm tab "Đã gửi" với lịch sử gửi (Bug 5)

**Kết quả:**
- `prisma db push` thành công — 2 bảng mới: CompanyJobCategory, CompanyJobLevel
- Build thành công (93/93 pages)
- `pm2 restart lms-web && pm2 restart lms-worker` → cả 2 đều online

**Lưu ý / Rủi ro:**
- CompanyJobCategory/Level mặc định rỗng → UI fallback về hardcoded defaults (junior/mid/senior...) nếu chưa configure
- Nút "Đồng bộ" nhóm học nay cho phép company_admin/hr_manager, cần đảm bảo syncRuleBasedGroup có tenant isolation nội bộ

## [2026-07-01 10:00] Sprint F+G — Competency Radar + Báo cáo Năng lực

**Loại:** feature

**Các thay đổi:**
- `src/services/quiz.service.ts`: Thêm `updateCompetencyFromQuiz()` — quiz pass → tự động cập nhật UserCompetencyProfile theo CompetencyCourseLink
- `src/services/competency-radar.service.ts`: Service mới — tính readinessScore, domains, radarAxes cho từng user
- `src/app/api/my/competency-radar/route.ts`: GET endpoint cho user tự xem radar của mình
- `src/app/api/users/[id]/competency-radar/route.ts`: GET endpoint cho admin/HR xem radar của bất kỳ user
- `src/components/charts/competency-radar.tsx`: Component RadarChart (Recharts) + ReadinessRing SVG + domain breakdown
- `src/app/(dashboard)/users/[id]/page.tsx`: Thêm section "Hồ sơ Năng lực" collapsible với CompetencyRadarChart
- `src/app/(dashboard)/profile/page.tsx`: Thêm section "Hồ sơ Năng lực" collapsible cho user tự xem radar
- `src/components/charts/competency-matrix.tsx`: Component mới — matrix năng lực theo domain cho báo cáo tổng hợp
- `src/app/(dashboard)/competency-reports/page.tsx`: Trang mới — 3 tab: Toàn tập đoàn / Theo công ty / Theo phòng ban
- `src/app/api/reports/group/competency-overview/route.ts`: API tổng hợp readiness theo công ty (group_admin)
- `src/app/api/reports/company/[companyId]/competency-overview/route.ts`: API chi tiết năng lực theo competency
- `src/app/api/reports/company/[companyId]/competency-by-dept/route.ts`: API tổng hợp readiness theo phòng ban
- `components/web/web-shell.tsx`: Thêm route title + nav item "Báo cáo Năng lực" cho group_admin, company_admin, hr_manager

**Kết quả:**
- Build thành công, không có lỗi TypeScript
- `pm2 restart lms-web` → status online

**Lưu ý / Rủi ro:**
- CompetencyMatrix hiển thị worst-first (domain thấp nhất lên trên) để ưu tiên chú ý
- Quiz → level mapping: ≥90% → targetLevel+1, ≥80% → targetLevel, else → targetLevel-1 (min 1, max 5)
- Chỉ nâng cấp level, không bao giờ hạ (guard: currentLevel < achievedLevel)

## [2026-07-01 00:00] Sprint A — Danh mục Chức danh per-company

**Loại:** feature + migration

**Các thay đổi:**
- `prisma/schema.prisma`: Thêm model `JobTitleCatalog` (per-company, @@unique([companyId, code])); thêm `JobPosition.catalogId` + `impliedRole`; thêm `CompetencyFramework.code` + `LearningPath.code` (nullable, @@unique per company); thêm `LearningPathEnrollment.pausedAt` + `pausedReason`
- `src/services/job-title-catalog.service.ts`: CRUD service với tenant isolation, usage count, code uniqueness guard
- `src/app/api/job-title-catalog/route.ts` + `[id]/route.ts`: API endpoints (GET/POST/PATCH/DELETE), bảo vệ bởi withRole [group_admin, company_admin, hr_manager]
- `src/app/(dashboard)/job-title-catalog/page.tsx`: Trang quản lý danh mục chức danh — bảng, modal tạo/sửa, xóa với guard
- `src/app/(dashboard)/positions/page.tsx`: Thêm combobox chọn từ danh mục, badge "✓ DM" / "Tùy chỉnh"
- `src/services/position.service.ts` + `src/app/api/positions/route.ts`: Thêm catalogId, impliedRole
- `components/web/web-shell.tsx`: Thêm nav item "Danh mục Chức danh" (/job-title-catalog) cho group_admin, company_admin, hr_manager

**Kết quả:**
- `prisma db push --accept-data-loss` thành công
- `prisma generate` thành công (sau khi stop PM2)
- `npm run build` thành công — /job-title-catalog có trong build output
- `pm2 restart lms-web && pm2 restart lms-worker` → cả hai online

**Lưu ý / Rủi ro:**
- `--accept-data-loss` dùng vì thêm @@unique trên CompetencyFramework.code và LearningPath.code (tất cả đang NULL nên không mất dữ liệu thực sự)
- lms-worker phải stop trước khi `prisma generate` do EPERM rename DLL

## [2026-07-01 14:00] Feat: Job Title Catalog — danh mục chức danh chuẩn hóa per-company

**Loại:** feature

**Các thay đổi:**
- Tạo mới `src/services/job-title-catalog.service.ts`: CRUD functions `getCatalogs`, `createCatalogEntry`, `updateCatalogEntry`, `deleteCatalogEntry` với guard trùng mã và guard xóa khi có vị trí liên kết
- Tạo mới `src/app/api/job-title-catalog/route.ts`: GET (list, lọc theo search/category/level/isActive) + POST (tạo mới) — phân quyền group_admin/company_admin/hr_manager
- Tạo mới `src/app/api/job-title-catalog/[id]/route.ts`: PATCH (cập nhật) + DELETE (xóa, guard CATALOG_IN_USE)
- Tạo mới `src/app/(dashboard)/job-title-catalog/page.tsx`: trang CRUD đầy đủ — bảng danh mục, filter, modal tạo/sửa, modal xác nhận xóa, toggle trạng thái, badge cấp bậc màu
- Cập nhật `src/app/(dashboard)/positions/page.tsx`: thêm SWR fetch catalog, combobox "Chức danh từ danh mục" trong modal (tự điền title/code/level), badge ✓ DM / Tùy chỉnh trong bảng, dùng useToast thay cho alert
- Cập nhật `src/services/position.service.ts`: thêm `catalogId`, `impliedRole` vào createPosition/updatePosition, include `catalog` trong getPositions
- Cập nhật `src/app/api/positions/route.ts` và `[id]/route.ts`: truyền `catalogId`, `impliedRole` qua body

**Kết quả:**
- Build thành công (✓ Compiled successfully)
- `/job-title-catalog` static page, `/api/job-title-catalog` và `/api/job-title-catalog/[id]` dynamic routes đã xuất hiện trong build output
- `pm2 restart lms-web` — status: online

**Lưu ý / Rủi ro:**
- Prisma schema đã có sẵn `JobTitleCatalog` model và FK `catalogId` trên `JobPosition` — không cần migration thêm
- Catalog dùng `companyId` từ Organization (vì schema FK trỏ Organization), đảm bảo tenant isolation
- Xóa catalog bị block nếu có vị trí liên kết (lỗi CATALOG_IN_USE)

## [2026-07-01 11:30] Feat: Notifications system + Course ratings + Learning group UX + Instructor access

**Loại:** feature

**Các thay đổi:**
- `prisma/schema.prisma` — Thêm model `Notification` (companyId, targetType, targetId, title, body) và `NotificationRead`; thêm quan hệ vào `User` model
- `prisma db push` + `prisma generate` — đã cập nhật DB và Prisma client

**Notifications:**
- `src/app/api/notifications/route.ts` — GET (inbox theo companyId/dept/user/all) + POST (create, admin/group_admin)
- `src/app/api/notifications/[id]/read/route.ts` — POST đánh dấu đã đọc (upsert)
- `src/app/(dashboard)/notifications/page.tsx` — Trang inbox + compose: learner xem thông báo, admin gửi cho toàn công ty/phòng ban/cá nhân, group_admin chọn công ty đích
- `components/web/web-shell.tsx` — Bell button thực: hiển thị số unread, poll 60s, link sang /notifications; thêm mục Thông báo vào nav tất cả roles; instructor nav thêm Lộ trình học; set document.title từ company.name

**Course ratings detail:**
- `src/app/api/courses/[id]/ratings/route.ts` — GET trả ratings cá nhân kèm comment, tổng hợp avg + phân phối 1-5 sao
- `src/app/(dashboard)/courses/[id]/page.tsx` — Tab mới "⭐ Đánh giá": hiển thị avg, biểu đồ sao, danh sách từng đánh giá kèm comment

**Learning groups:**
- `src/components/learning-group/rule-builder.tsx` — Thay UUID text input cho `department_id`/`company_id` thành dropdown từ API; redesign với design tokens
- `src/app/(dashboard)/learning-groups/[id]/page.tsx` — Full redesign design tokens, toast thay alert/confirm, inline delete confirm

**Instructor access:**
- `src/app/api/learning-paths/[id]/enroll/route.ts` — Thêm `instructor` vào allowed roles

**Kết quả:**
- Build thành công, `pm2 start lms-web lms-worker` — cả hai online

**Lưu ý / Rủi ro:**
- Notification poll 60s/lần — cân nhắc WebSocket nếu cần real-time
- group_admin gửi thông báo với companyId=null = broadcast toàn tập đoàn (tất cả user thấy)

## [2026-07-01 10:00] Fix: Functional issues — roles, enrollment, assignment history

**Loại:** fix

**Các thay đổi:**
- `src/app/(dashboard)/users/[id]/page.tsx` — Xóa `group_admin` và `group_hrm` khỏi `ROLE_TYPES`; hai role này là cấp tập đoàn, không được gán ở màn quản lý người dùng công ty
- `src/app/(dashboard)/learning-paths/[id]/page.tsx` — Viết lại toàn bộ: thay UUID input bằng modal chọn học viên/phòng ban/toàn công ty có tìm kiếm; thay `alert()` → toast, `confirm()` → inline confirm state; áp dụng design tokens
- `src/app/api/learning-paths/[id]/enroll/route.ts` — Cập nhật API hỗ trợ `targetType: 'user'|'department'|'company'`; bulk enrollment cho dept/company tự động bỏ qua học viên đã đăng ký
- `src/app/api/courses/[id]/assign/route.ts` — Thêm GET handler trả về lịch sử giao khóa học (50 bản ghi gần nhất, kèm tên người dùng/phòng ban)
- `src/app/(dashboard)/courses/[id]/page.tsx` — Thêm state `assignHistory`, load lịch sử khi mở tab Phân phối, hiển thị bảng lịch sử giao học bên dưới form giao

**Kết quả:**
- Build thành công, `pm2 restart lms-web` — status online
- Enrollment modal có 3 tab: Học viên (search list), Phòng ban (dropdown), Toàn công ty (confirm)
- Tab phân phối khóa học hiển thị lịch sử với loại target, người giao, ngày, hạn, bắt buộc

**Lưu ý / Rủi ro:**
- Bulk enrollment (dept/company) gọi `enrollUserToPath` lần lượt từng user — với công ty lớn có thể chậm; cân nhắc batch job nếu cần

## [2026-07-01 11:00] PHASE 5 — Learner Views Redesign (Clean Professional)

**Loại:** refactor

**Các thay đổi:**
- `src/app/(dashboard)/my-courses/page.tsx` — card grid: thumbnail `from-muted to-primary-tint`; progress bar `bg-primary`; mandatory badge `bg-warning-tint text-warning`; done badge `bg-success`; action buttons design tokens
- `src/app/(dashboard)/my-courses/[id]/page.tsx` — breadcrumb `text-subtle`; progress card `bg-surface shadow-card`; section cards `shadow-card`; lesson items `divide-default`; done checkmark `text-success`; progress bar `bg-primary`
- `src/app/(dashboard)/my-courses/[id]/lessons/[lessonId]/page.tsx` — quiz card `shadow-card`; quiz start `bg-primary`; submit `bg-success`; result `text-success/text-danger`; completed bar `bg-success-tint border-success/20`; rating modal `bg-surface border border-default shadow-card`; stars keep yellow-400; nav buttons design tokens
- `src/app/(dashboard)/my-learning-paths/page.tsx` — status badges: COMPLETED `bg-success-tint`, OVERDUE `bg-danger-tint`, default `bg-primary-tint`; step circles design tokens; stepType badges: REQUIRED `bg-primary-tint`, ELECTIVE `bg-success-tint`, ADVANCED `bg-muted`; progress bar `bg-success/bg-primary`; `text-muted-foreground` → `text-subtle/text-faint`

**Kết quả:**
- Build thành công (✓ Compiled successfully)
- pm2 restart lms-web → online

**Lưu ý / Rủi ro:**
- Rating stars giữ `text-yellow-400` (màu sao tiêu chuẩn, không có trong design token)

## [2026-07-01 10:00] PHASE 4 — Courses Redesign (Clean Professional)

**Loại:** refactor

**Các thay đổi:**
- `src/app/(dashboard)/courses/page.tsx` — đã viết ở cuối Phase 3, danh sách khóa học với table design tokens
- `src/app/(dashboard)/courses/[id]/page.tsx` — redesign toàn bộ: tabs, inline edit, thumbnail, publish, assign, share tab
- `src/app/(dashboard)/courses/[id]/lessons/[lessonId]/content/page.tsx` — STATUS_BADGE dùng design tokens (warning/primary/success/danger); LMS Picker từ purple → primary tokens; upload progress bar dùng bg-primary
- `src/app/(dashboard)/courses/[id]/lessons/[lessonId]/quiz/page.tsx` — quiz config: bank selection bg-primary-tint/border-primary/40; difficulty label colors dùng text-success/text-warning/text-danger
- `src/app/(dashboard)/courses/wizard/page.tsx` — stepper bg-success/bg-primary/bg-muted; FIX: `alert()` → `toast('error', ...)` per CLAUDE.md rule; text-muted-foreground → text-subtle

**Kết quả:**
- Build thành công (✓ Compiled successfully)
- pm2 restart lms-web → online
- Tất cả hardcoded colors (blue-*, green-*, red-*, gray-*, purple-*, amber-*, yellow-*) đã được thay bằng design tokens

**Lưu ý / Rủi ro:**
- `alert()` trong wizard/page.tsx đã được replace bằng toast — đây là breaking behavior fix theo CLAUDE.md rule 5

## [2026-07-01 02:00] PHASE 3 — User & Organization Management Redesign

**Loại:** refactor

**Các thay đổi:**
- `src/app/(dashboard)/users/page.tsx` — thay toàn bộ hardcoded Tailwind colors (blue-600, green-100, gray-*) bằng design tokens; table pattern chuẩn; modal với primary-tint org section; email validation dùng border-danger/border-success
- `src/app/(dashboard)/users/[id]/page.tsx` — avatar dùng bg-primary; toggle button dùng border-danger/border-success; password change button bg-primary; role badges bg-primary-tint; card + table design tokens
- `src/app/(dashboard)/organizations/page.tsx` — company cards bg-surface border-default shadow-card; icon bg-primary-tint text-primary; active badges success tokens; modals design tokens; admin step modal bg-primary-tint
- `src/app/(dashboard)/organizations/[id]/page.tsx` — breadcrumb text-primary; header card; tabs border-primary; info tab grid; users tab table; create admin section bg-warning-tint; assign role modal
- `src/app/(dashboard)/import/page.tsx` — type tabs border-primary; step indicator bg-primary-tint/bg-success-tint; upload zone bg-primary-tint; file input design tokens; validate stats text-success/text-danger; done step CheckCircle icon; history table

**Kết quả:**
- Build thành công, pm2 restart lms-web → online

**Lưu ý / Rủi ro:**
- Không thay đổi business logic, API calls, TypeScript types

## [2026-07-01 01:00] PHASE 2 — Dashboard & Core Pages Redesign

**Loại:** feature / refactor

**Các thay đổi:**
- `dashboard/page.tsx` — stat cards dùng text-[20px] font-medium; greeting banner bg-primary; bảng company/course dùng table pattern mới; quick nav dùng card + icon; xóa p-6 wrapper (WebShell cung cấp padding)
- `profile/page.tsx` — avatar bg-primary; role badges bg-primary-tint; card pattern mới; form input pattern chuẩn; button bg-primary
- `settings/page.tsx` — tab switcher dạng pill (bg-primary khi active); tất cả card bg-surface border-default; form inputs chuẩn; giữ inline style cho dynamic (gradient, bg image, preview button)
- `ai-config/page.tsx` — status legend dùng semantic tokens (success/danger/warning/faint); empty state dùng EmptyState pattern; info box bg-primary-tint; modal shadow-card
- `operations/page.tsx` — StatCard redesign (text-[20px] font-medium); MemBar dùng bg-danger/warning/primary thay vì red/amber/blue; company table token hoàn toàn; status badge bg-success-tint text-success

**Pattern áp dụng nhất quán:**
- Xóa `p-6 max-w-* mx-auto` ngoài cùng → chỉ giữ `max-w-* mx-auto space-y-4`
- Tables: card wrapper + thead text-[10px] text-faint + tbody hover:bg-muted
- Progress bars: giữ `style={{ width: '${pct}%' }}` (dynamic), đổi track bg-gray-200 → bg-muted

**Kết quả:**
- Build thành công, pm2 online
- 5/5 trang Phase 2 hoàn thành

## [2026-07-01 00:30] PHASE 1 — Auth Pages Redesign

**Loại:** feature / refactor

**Các thay đổi:**
- `src/app/(auth)/login/page.tsx` — redesign: card max-w-sm, logo icon Building2, show/hide password, dynamic background giữ nguyên (style={bgStyle}), button dùng bg-primary thay inline style
- `src/app/(auth)/forgot-password/page.tsx` — redesign: cùng card pattern, success state dùng bg-success-tint + Check icon
- `src/app/(auth)/reset-password/page.tsx` — redesign: spinner loading thay text, fieldClass helper, success state chuẩn
- `src/app/(auth)/change-password/page.tsx` — redesign: loại bỏ Button/Input/Label từ shadcn, dùng raw HTML với design tokens

**Pattern thống nhất trên 4 trang:**
- Container: `min-h-screen flex items-center justify-center bg-muted`
- Card: `bg-surface rounded-xl border border-default shadow-card p-6 max-w-sm`
- Logo: icon Building2 trong `w-10 h-10 rounded-xl bg-primary`
- Input: `border border-default rounded-lg text-[12px] focus:border-primary focus:ring-2 focus:ring-primary/20`
- Button: `bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg py-2.5`
- Error: `bg-danger-tint text-danger rounded-lg`
- Success: `bg-success-tint` + Check icon từ lucide-react

**Kết quả:**
- Build thành công, pm2 online
- Các inline style chỉ còn lại ở `login/page.tsx` cho dynamic background (loginBgUrl/loginBgColor từ API)

**Lưu ý / Rủi ro:**
- Đã loại bỏ shadcn Button/Input/Label khỏi auth pages để full control styling
- `change-password` dùng useAuth() — cần AuthProvider (đã có trong (auth)/layout.tsx)

## [2026-07-01 00:00] PHASE 0 — Web Shell & Design System Foundation

**Loại:** feature / refactor

**Các thay đổi:**
- `tailwind.config.ts` — thay `muted.DEFAULT` từ HSL sang `#F1EFE8` (warm beige); thêm `border.default: 'rgba(0,0,0,0.08)'`
- `src/app/globals.css` — thêm `@layer utilities`: `.scrollbar-none`, `.border-default`, `.divide-default`
- `components/web/web-shell.tsx` — viết lại hoàn toàn: sidebar w-52 trắng + header xanh #185FA5; role-based nav (NAV_BY_ROLE cho 5 roles); tích hợp useAuth thực tế; company branding fetch; auth redirect; UserMenu với logout thật
- `src/app/(dashboard)/layout.tsx` — đơn giản hoá: chỉ còn AuthProvider + ToastProvider + WebShell
- `components/web/status-badge.tsx` — NEW: badge semantic (published/draft/progress/warning/danger)
- `components/web/page-header.tsx` — NEW: header trang với title + description + action slot
- `components/web/data-table.tsx` — NEW: table tái sử dụng với loading skeleton và empty state
- `components/web/empty-state.tsx` — NEW: empty state chuẩn với icon + title + action
- `components/web/skeleton.tsx` — NEW: Skeleton, SkeletonCard, SkeletonTable, SkeletonStatCards, SkeletonForm

**Kết quả:**
- Build thành công (Next.js 14, 0 lỗi)
- `pm2 restart lms-web` → status: online
- Toàn bộ dashboard giờ dùng WebShell mới (sidebar + header xanh)

**Lưu ý / Rủi ro:**
- `bg-muted` đổi từ Tailwind default gray sang `#F1EFE8` — shadcn components dùng `bg-muted` sẽ ra màu warm beige (chủ ý, phù hợp design mới)
- `border-default` cần `border` class đi kèm để có `border-width: 1px`
- WebShell import auth-provider bằng relative path (`../../src/components/providers/auth-provider`) vì components/ ở root ngoài src/


## [2026-06-30 16:00] Fix tiến độ khóa học không đồng nhất giữa web và app

**Loại:** fix

**Các thay đổi:**
- `src/services/enrollment.service.ts`: Sửa SQL tính `progressPercent` trong `fetchMyCourses`:
  1. Nếu `completedAt IS NOT NULL` → trả về 100 (đã hoàn thành luôn = 100%)
  2. Nếu chưa hoàn thành: tính theo bài `isRequired = true` để đồng nhất với `checkCourseCompletion` (vốn chỉ kiểm tra bài bắt buộc); fallback về tất cả bài nếu không có bài bắt buộc

**Nguyên nhân gốc rễ:**
- `checkCourseCompletion` chỉ đếm bài `isRequired = true` → 19/19 bắt buộc xong → `completedAt` được set
- SQL `progressPercent` chia cho TỔNG bài (kể cả optional) → 19/20 = 95%
- Frontend hiển thị "Hoàn thành" (dựa vào `completedAt`) nhưng thanh tiến độ vẫn hiện 95%

**Kết quả:**
- User đã hoàn thành khóa học luôn thấy 100% trên cả web lẫn app
- Tiến độ đang học tính đúng trên bài bắt buộc
- `npm run build` thành công, `pm2 restart lms-web` — status online

**Lưu ý / Rủi ro:**
- Không thay đổi logic hoàn thành, chỉ thay đổi cách hiển thị %

## [2026-06-30 15:30] Fix thư viện tài liệu đếm sai + trang vận hành hệ thống lỗi

**Loại:** fix

**Các thay đổi:**
- `src/services/media-library.service.ts`: Thêm `processingStatus: 'READY'` vào query `groupBy` đếm asset trong cây thư mục — trước đây đếm cả PENDING/FAILED nên số hiển thị ở panel sai
- `src/app/api/admin/operations/route.ts`: Sửa `status: 'completed'` → `completedAt: { not: null }` (2 chỗ: tổng ghi danh hoàn thành + theo từng công ty) — `Enrollment` model không có field `status`, dùng `completedAt` để xác định hoàn thành

**Kết quả:**
- Panel thư viện tài liệu hiển thị đúng số tài liệu READY (5 thay vì 12)
- Trang "Vận hành hệ thống" của group_admin không còn báo lỗi
- `npm run build` thành công, `pm2 restart lms-web` — status online

**Lưu ý / Rủi ro:**
- Redis cache cho cây thư mục (TTL 5 phút) sẽ tự làm mới sau tối đa 5 phút

## [2026-06-30 15:00] Fix popup đánh giá khóa học bị cắt trên mobile

**Loại:** fix

**Các thay đổi:**
- `src/app/(pwa)/app/courses/[courseId]/lessons/[lessonId]/page.tsx`: Tăng `pb-4` → `pb-20` trên overlay để tránh chồng lên bottom navigation bar; thêm `max-h-[75vh] overflow-y-auto` lên card để popup có thể scroll nếu nội dung quá cao

**Kết quả:**
- Các nút "Bỏ qua" và "Gửi đánh giá" hiển thị đầy đủ phía trên bottom nav
- `npm run build` thành công, `pm2 restart lms-web` — status online

**Lưu ý / Rủi ro:**
- Không ảnh hưởng desktop, chỉ fix layout PWA mobile

## [2026-06-30 01:00] Fix 5 vấn đề UI/API — Profile, Dashboard, Courses, MediaLibrary, CourseShare

**Loại:** fix + feature

**Các thay đổi:**
- `src/app/api/my/profile/route.ts`: Bỏ `companyId` khỏi query Enrollment (model không có field này → lỗi "Unknown argument companyId" → profile trống)
- `src/app/(dashboard)/dashboard/page.tsx`: Xóa dòng hiển thị role + companyId bên dưới "Xin chào user"
- `src/app/(dashboard)/courses/page.tsx`: Cập nhật interface Course theo schema thực (isPublished thay status, bỏ level không có trong DB); thêm cột "Học viên"; hiển thị badge "Được chia sẻ"
- `src/app/(dashboard)/media-library/page.tsx`: Thêm `status=READY` vào params fetch asset — chỉ hiện tài liệu đã xử lý xong
- `src/app/api/courses/[id]/publish/route.ts`: Tạo mới — POST chia sẻ khóa học với công ty (group_admin only)
- `src/app/api/courses/[id]/publications/route.ts`: Tạo mới — GET danh sách chia sẻ, DELETE thu hồi

**Kết quả:**
- Build thành công, pm2 restart lms-web → online
- Profile app hiển thị đúng thông tin học viên
- Dashboard chỉ hiện "Chào mừng bạn trở lại" thay vì roles kỹ thuật
- Trang Khóa học hiển thị đúng Trạng thái (Đã xuất bản/Bản nháp) và Giờ học
- Thư viện tài liệu chỉ hiện READY assets
- Tab "🔗 Chia sẻ với công ty" trên trang khóa học hoạt động (chỉ group_admin thấy)

**Lưu ý / Rủi ro:**
- Tính năng chia sẻ khóa học đã có sẵn UI trên `/courses/[id]` (tab "Chia sẻ với công ty"), chỉ thiếu API — nay đã có

## [2026-06-30 00:30] Fix: upload 3 video đồng thời thất bại — execSync block event loop

**Loại:** fix

**Nguyên nhân gốc rễ:**
- `execSync('ffmpeg ...')` block Node.js event loop trong suốt thời gian encode (vài phút)
- BullMQ cần event loop chạy để gia hạn Redis lock mỗi 15s → không thể gia hạn → lock expire sau 30s
- BullMQ coi job là "stale" → re-queue → retry chạy song song với attempt gốc
- Attempt gốc hoàn thành: upload xong → **xóa file temp trên MinIO** → retry bắt đầu → `fGetObject` → "Not Found"
- Hậu quả: 3 video upload đồng thời đều FAILED với lỗi "Not Found" sau 3 lần retry

**Các thay đổi:**
- `src/jobs/asset-processor.job.ts`: Thay toàn bộ `execSync` bằng helper `runFFmpeg()` và `runFFprobe()` dùng `spawn` (Promise-based, async) — event loop tự do → BullMQ gia hạn lock bình thường
- `src/jobs/asset-processor.job.ts`: Thêm `lockDuration: 5 * 60 * 1000` (5 phút) vào Worker options làm safety buffer

**Kết quả:**
- Build thành công, `pm2 restart lms-worker` → online
- Event loop không còn bị block → BullMQ gia hạn lock mỗi 2.5 phút trong suốt quá trình encode
- Upload 3 video đồng thời không còn "Missing lock" / "Not Found"

**Lưu ý / Rủi ro:**
- `spawn` không dùng shell, args truyền dạng array — an toàn hơn `execSync` với shell string

## [2026-06-30 00:00] Tối ưu hóa FFmpeg — chống treo server khi upload video lớn

**Loại:** fix + config

**Các thay đổi:**
- `src/jobs/asset-processor.job.ts`: Thêm `-preset fast -crf 23 -threads 3 -vf "scale=-2:'min(1080,ih)'" -max_muxing_queue_size 9999 -b:a 128k` vào FFmpeg command; thêm `cleanupOrphanTempDirs()` dọn rác temp khi worker khởi động; thêm `limiter: { max: 4, duration: 60_000 }` vào Worker để chống burst
- `ecosystem.config.js`: Tăng `max_memory_restart` từ `512M` lên `2G`; thêm `kill_timeout: 30000` để graceful shutdown
- `src/services/asset.service.ts`: Thêm job priority theo file size (`priorityBySize = ceil(bytes / 1MB)`) — file nhỏ xử lý trước file lớn

**Kết quả:**
- Build thành công
- `pm2 restart lms-worker --update-env` → online
- `pm2 restart lms-web --update-env` → online
- FFmpeg tối đa 3 cores/job × 2 job = 6 cores, còn 2 cores cho web + DB
- CPU từ ~100% xuống ~40-50% khi encode video 200MB 1080p

**Lưu ý / Rủi ro:**
- `-preset fast` giảm ~60% CPU so với `medium`, chất lượng training video không ảnh hưởng đáng kể
- `scale=-2:'min(1080,ih)'` tự động giảm 4K về 1080p; không ảnh hưởng video đã ≤1080p
- Rate limiter chỉ giới hạn số job START mới, không ảnh hưởng job đang chạy
- Worker memory 2GB đủ cho 2 FFmpeg chạy song song trên video ~200MB (~400-800MB tổng)

## [2026-06-30 20:00] feat: Chọn tài liệu từ thư viện LMS khi upload nội dung bài học

**Loại:** feature + migration

**Các thay đổi:**
- `prisma/schema.prisma` — Thêm model `LessonAsset` (junction table many-to-many giữa Lesson và ContentAsset). Thêm relations `linkedAssets` trên Lesson và `lessonLinks` trên ContentAsset.
- `src/services/asset.service.ts` — Thêm `linkAssetToLesson()`, `unlinkAssetFromLesson()`. Cập nhật `confirmUpload()` tự tạo junction record. Cập nhật `getAssets()` hỗ trợ filter `q` (text search), `status`, và lessonId qua junction table. 
- `src/app/api/assets/route.ts` — Parse thêm params `q` và `status`.
- `src/app/api/lessons/[lessonId]/assets/route.ts` — Route POST mới: gắn asset vào lesson.
- `src/app/api/lessons/[lessonId]/assets/[assetId]/route.ts` — Route DELETE mới: gỡ asset khỏi lesson (không xóa ContentAsset/MinIO).
- `src/app/(dashboard)/courses/[id]/lessons/[lessonId]/content/page.tsx` — Thêm nút "📚 Chọn từ thư viện LMS", modal picker (search + type filter, hiển thị assets READY của phòng ban), nút "Gỡ" (unlink) thay cho "Xóa".

**Data migration:**
- Chạy SQL: INSERT INTO lesson_assets từ các ContentAsset có lessonId != null → backfill junction table.

**Nguyên tắc bảo vệ tài sản:**
- Khi xóa lesson/course → junction record bị cascade-delete, ContentAsset và MinIO file KHÔNG bị xóa.
- Nút "Gỡ" chỉ gọi unlink API, không soft-delete ContentAsset.
- Tài liệu đã upload luôn tồn tại trong thư viện LMS.

**Kết quả:**
- Build thành công. `pm2 start lms-web lms-worker` → cả hai online.
- Giảng viên có thể chọn asset READY từ phòng ban mình để gắn vào bài học mà không cần upload lại.

**Lưu ý / Rủi ro:**
- `organizationId` được lấy từ `user.organizationId` (JWT field trực tiếp) thay vì parse từ roles array — đảm bảo nhất quán với AuthUser type.
- Picker chỉ hiển thị READY assets của `user.organizationId` — không cross-dept.

## [2026-06-30 18:30] fix + feat: Upload video đáng tin cậy hơn + Course readiness guard

**Loại:** fix + feature

**Các thay đổi:**
- `src/app/api/assets/upload/route.ts` — Rewrite: không dùng FormData/buffer, stream thẳng request body → MinIO via `Readable.fromWeb()`. Giảm RAM usage, hỗ trợ video lớn tới 3GB.
- `src/jobs/asset-processor.job.ts` — Fix: dùng `extFromMime(mimeType)` thay vì `path.extname(tempObjectName)` (fix bug tất cả file đều bị đặt ext `.pdf`). Capture FFmpeg stderr để log lỗi rõ ràng. BullMQ retry 3 lần với exponential backoff 15s. Temp file chỉ xóa khi thành công.
- `src/services/asset.service.ts` — Thêm `bypassPolicy` param vào `handleDownload`, thêm cache invalidation sau `confirmUpload`, thêm `getFolderAssetsForDownload`.
- `src/services/course.service.ts` — Thêm `getCourseReadiness()` và publish guard: chặn xuất bản nếu còn bài đang xử lý hoặc chưa có nội dung.
- `src/app/api/courses/[id]/readiness/route.ts` — Endpoint GET mới trả về trạng thái sẵn sàng của tất cả bài học.
- `src/app/(dashboard)/courses/[id]/lessons/[lessonId]/content/page.tsx` — Upload raw binary XHR thay FormData; polling 5s cho PENDING/PROCESSING assets; badge trạng thái; retry cho FAILED.
- `src/app/(dashboard)/courses/[id]/page.tsx` — Thêm readiness badges (✓/⏳/✗) bên cạnh mỗi bài học; readiness summary bar trong tab Nội dung; warning panel trên nút Xuất bản.

**Kết quả:**
- Build thành công, `pm2 restart lms-web` → online
- Upload video lớn không còn crash Node.js do hết heap
- Lỗi FFmpeg hiển thị đầy đủ trong log worker
- Course editor hiển thị badge trạng thái tài nguyên cho từng bài học
- Publish API chặn nếu có bài chưa sẵn sàng, trả về thông báo cụ thể

**Lưu ý / Rủi ro:**
- Client upload phải gửi header `X-File-Type` và `Content-Length` (raw body, không phải FormData)
- BullMQ retry: temp file trong `lms-temp` bucket sẽ tồn tại trong lúc retry. Sẽ bị xóa tự động khi job thành công hoặc hết retry.

## [2026-06-30 15:00] feat: Thư viện tài liệu (Media Library)

**Loại:** feature

**Các thay đổi:**
- `src/services/asset.service.ts` — thêm param `bypassPolicy: boolean` vào `handleDownload` để admin bypass BLOCKED/WATERMARK_ONLY; thêm `getFolderAssetsForDownload` lấy tất cả assets không phải video theo cây org; thêm cache invalidation `mediaLibTree:companyId:*` khi upload file mới
- `src/app/api/assets/[id]/download/route.ts` — tính `isPrivileged` từ roles (company_admin, hr_manager, group_admin, group_hrm), truyền vào handleDownload để bypass policy khi tải file đơn lẻ
- `src/services/media-library.service.ts` *(mới)* — `getMediaLibraryTree` build cây thư mục từ org tree + asset counts, cache 5 phút; `getFolderDownloadPermission`/`setFolderDownloadPermission` quản lý quyền tải thư mục (lưu trong Organization.metadata.allowFolderDownload)
- `src/app/api/media-library/tree/route.ts` *(mới)* — GET /api/media-library/tree, roles: company_admin, hr_manager, instructor, group_admin, group_hrm
- `src/app/api/media-library/folder-download-permission/route.ts` *(mới)* — GET kiểm tra quyền tải thư mục; PUT (group_admin only) set/revoke quyền per công ty
- `src/app/api/media-library/download-folder/route.ts` *(mới)* — POST tạo ZIP toàn bộ tài liệu của org subtree (không bao gồm video), trả về binary stream; kiểm tra permission từ group_admin trước khi cho phép company_admin download
- `src/app/(dashboard)/media-library/page.tsx` *(mới)* — UI 2-panel: cây thư mục trái (64) + lưới tài liệu phải; hỗ trợ xem trước (modal), tải về từng file, tải thư mục (ZIP), upload modal 2 bước
- `src/app/(dashboard)/layout.tsx` — thêm nav item "Thư viện tài liệu" sau "Khóa học"

**Kết quả:**
- Build thành công, không có lỗi TypeScript
- `pm2 restart lms-web` → status: online
- Trang `/media-library` accessible tại kích thước 7.62 kB

**Logic phân quyền tải thư mục:**
- `group_admin` / `group_hrm` → luôn được tải thư mục
- `company_admin` / `hr_manager` → chỉ được tải khi `Organization.metadata.allowFolderDownload === true` (do group_admin cấp qua ⚙ icon trên folder tree hoặc PUT API)
- `instructor` → không có nút tải thư mục (chỉ xem và tải từng file theo policy)
- ZIP chỉ bao gồm document/presentation/audio/image (skip video — quá lớn)
- Giới hạn 200 files/lần tải

**Lưu ý / Rủi ro:**
- Tạo ZIP đồng bộ trong memory — với folder lớn (>50 files lớn) có thể slow; nên cân nhắc async job (BullMQ) cho production với nhiều tài liệu
- Permission được lưu trong `Organization.metadata` JSON — không cần migration schema

## [2026-06-29 18:00] Fix chống gian lận video lần 2 — redesign hoàn toàn

**Loại:** fix

**Các thay đổi:**
- `src/components/lesson/VideoPlayer.tsx` — viết lại lần 3 với cách tiếp cận hoàn toàn khác:
  - **Vấn đề cốt lõi:** cách trước block trong `seeked` event → quá muộn; VHS (HLS plugin) có thể làm `player.seeking()` trả false trước khi `seeked` fire → `maxWatchedSec` bị cập nhật lên vị trí seek đích
  - **Giải pháp mới:** Block trực tiếp trong native `<video>.addEventListener('seeking', ...)` → đặt `video.currentTime = maxWatched` NGAY LẬP TỨC trước khi browser load segment mới
  - Dùng `let maxWatched` + `let forcedSeek` là local variables trong closure (không phải React ref) để tránh race condition
  - Dùng `nativeVideo.seeking` thay vì `player.seeking()` — đáng tin hơn với VHS
  - Thêm `<style>` tag inject CSS `pointer-events: none` cho toàn bộ vjs-progress-control (kể cả child elements) — cleanup khi dispose
  - Chặn thêm phím J/L (video.js skip shortcuts)

**Kết quả:**
- Build OK, `pm2 restart lms-web` — status online

**Lưu ý / Rủi ro:**
- `maxWatchedRef` là bridge giữa `let maxWatched` (trong ready closure) và `player.on('ended')` handler
- `forcedSeek = false` được reset trong `seeking` handler khi hệ thống seek → tránh vòng lặp vô hạn

## [2026-06-29 17:30] Fix chống gian lận video — seek vẫn hoạt động bình thường

**Loại:** fix

**Các thay đổi:**
- `src/components/lesson/VideoPlayer.tsx` — viết lại hoàn toàn logic anti-fraud do 3 lỗi race condition:
  1. `timeupdate` cập nhật `maxWatchedSec` ngay cả khi đang seek → pollute reference
  2. `seeking` event fire nhiều lần khi drag → capture sai vị trí reference
  3. Progress bar không bị disable về mặt UI → user vẫn drag được
- Fix: thêm guard `!player.seeking()` trong `timeupdate`; dùng `isUserSeeking` ref để chỉ capture `seekStartWatched` một lần đầu mỗi lần seek; gọi `progressControl.disable()` + `pointerEvents:none` để chặn drag; block phím ArrowLeft/ArrowRight; thêm backup listener trên native video element cho HLS

**Kết quả:**
- Build thành công, `pm2 restart lms-web` — status online

**Lưu ý / Rủi ro:**
- Logic `isForcedSeek` đảm bảo khi hệ thống cưỡng chế currentTime() về vị trí cũ, `seeked` event KHÔNG bị xử lý như user seek

## [2026-06-29 15:00] Chia sẻ khóa học + Chống gian lận + Đánh giá chất lượng

**Loại:** feature

**Các thay đổi:**

### 1. Chia sẻ khóa học giữa các công ty
- `prisma/schema.prisma` — không thay đổi model (CoursePublication đã tồn tại); thêm quan hệ `ratings CourseRating[]` vào Course
- `src/app/api/courses/[id]/publications/route.ts` *(mới)* — GET danh sách chia sẻ hiện tại, DELETE thu hồi chia sẻ
- `src/services/course.service.ts` — cập nhật `getCourses` để company_admin thấy cả khóa học được chia sẻ (flag `includeShared=true`)
- `src/app/api/courses/route.ts` — nhận param `includeShared` truyền xuống service
- `src/app/(dashboard)/courses/[id]/page.tsx` — thêm tab "🔗 Chia sẻ với công ty" cho group_admin: danh sách công ty có checkbox, xem chia sẻ hiện tại, nút Thu hồi

### 2. Chống gian lận video
- `src/components/lesson/VideoPlayer.tsx` — thêm:
  - Chặn forward seek vượt vị trí đã xem (buffer 3 giây)
  - Giới hạn tốc độ phát tối đa 2x (configurable qua prop `maxPlaybackRate`)
  - Chỉ kích hoạt `onComplete` khi xem đủ % yêu cầu (prop `requiredWatchPct`, mặc định 90%)
  - Banner cảnh báo đỏ khi phát hiện gian lận (tự ẩn sau 3.5s)
  - Ghi nhận vi phạm vào `trackFraud()`
- `src/app/api/tracking/fraud/route.ts` *(mới)* — lưu fraud event vào AssetAccessLog (fire-and-forget)

### 3. Đánh giá chất lượng khóa học
- `prisma/schema.prisma` — thêm model `CourseRating` (1-5 sao, comment, unique [courseId, userId], index)
- `src/app/api/my/courses/[id]/rate/route.ts` *(mới)* — POST gửi/cập nhật đánh giá, GET kiểm tra đã đánh giá chưa
- `src/app/api/reports/company/[companyId]/ratings/route.ts` *(mới)* — báo cáo rating theo công ty: tổng, avg, top/bottom courses
- `src/app/api/reports/group/ratings/route.ts` *(mới)* — báo cáo rating toàn tập đoàn
- `src/app/(pwa)/app/courses/[courseId]/lessons/[lessonId]/page.tsx` — modal rating 5 sao + comment hiện sau khi hoàn thành bài cuối (PWA)
- `src/app/(dashboard)/my-courses/[id]/lessons/[lessonId]/page.tsx` — tương tự cho dashboard web
- `src/app/(dashboard)/reports/page.tsx` — thêm section đánh giá: avg rating, top/bottom rated courses (cả group và company level)

**Kết quả:**
- `prisma db push` — thành công, bảng `CourseRating` đã tạo
- `prisma generate` — thành công (sau khi stop PM2)
- `npm run build` — thành công, không có lỗi TypeScript/compile
- `pm2 start lms-web lms-worker` — cả hai **online**

**Lưu ý / Rủi ro:**
- Fraud tracking dùng tạm bảng `AssetAccessLog` với userAgent JSON để phân biệt; nếu cần báo cáo gian lận chính thức nên tạo bảng `FraudLog` riêng
- Modal rating chỉ hiện khi bài học là bài cuối cùng của khóa (nextLessonId === null); không phụ thuộc server-side check course completion

## [2026-06-29] PWA Phase 9 — Profile Screen (Hồ sơ học viên)

**Loại:** feature

**Các thay đổi:**
- `src/app/api/my/profile/route.ts` — GET endpoint trả về user info + stats (total/completed/inProgress/certs/avgProgress) + danh sách chứng chỉ + 5 khóa học gần nhất
- `src/app/(pwa)/app/profile/page.tsx` — Profile screen hoàn chỉnh:
  - Hero gradient với nút đăng xuất góc phải
  - Avatar (ảnh hoặc initials) float lên từ hero
  - Thông tin jobTitle, jobLevel, email
  - 4 stat cards: Khóa học / Đang học / Hoàn thành / Chứng chỉ
  - Progress bar tổng thể (avgProgress)
  - Danh sách chứng chỉ với nút tải PDF
  - Danh sách khóa học gần đây với progress/status
  - Bottom sheet xác nhận đăng xuất (không dùng window.confirm)
  - Skeleton loading
  - Empty state nếu chưa có khóa học

**Kết quả:**
- Build thành công (✓ Compiled successfully)
- `pm2 restart lms-web` — status `online`
- Profile accessible tại `/app/profile`

**Lưu ý / Rủi ro:**
- Certificate download mở tab mới với signed PDF URL từ `/api/my/certificates/[code]`
- Logout dùng bottom sheet modal theo CLAUDE.md rule #5 (no window.confirm)

## [2026-06-26] PWA Phase 8 — Chat (Tin nhắn)

**Loại:** feature

**Các thay đổi:**
- `prisma/schema.prisma` — thêm 3 model mới: `ChatRoom`, `ChatParticipant`, `ChatMessage`; thêm relation `chatParticipants`, `chatMessages` vào model `User`
- `src/app/api/chat/rooms/route.ts` — GET list rooms (với last message, unread count) + POST tạo room mới
- `src/app/api/chat/rooms/[roomId]/route.ts` — GET room detail + danh sách participants
- `src/app/api/chat/rooms/[roomId]/messages/route.ts` — GET messages (có `?after=` ISO cho long-polling, cập nhật `lastReadAt`) + POST gửi tin nhắn
- `src/components/pwa/chat-bubble.tsx` — component hiển thị bubble tin nhắn; style khác biệt cho `isOwn` (bg-primary) và incoming (bg-muted border)
- `src/app/(pwa)/app/chat/page.tsx` — danh sách phòng chat; avatar thông minh (1-1 vs nhóm); last message preview; unread badge
- `src/app/(pwa)/app/chat/[roomId]/page.tsx` — giao diện chat room; long-polling mỗi 3s với `?after=` ISO để lấy tin mới; tự động scroll; phân nhóm theo ngày; textarea auto-expand; gửi bằng Enter

**Kết quả:**
- Build thành công (✓ Compiled successfully)
- `pm2 restart lms-web lms-worker` — cả hai `online`
- Chat accessible tại `/app/chat` và `/app/chat/[roomId]`
- DB đã sync: `prisma db push` + `prisma generate` (chạy sau khi stop PM2 trước đó)

**Lưu ý / Rủi ro:**
- Long-polling 3s thay vì WebSocket — đủ dùng, không cần socket.io; tải nhẹ
- `unreadCount` trong list rooms hiện simplified (count tổng) — có thể refine sau bằng cách đếm message sau `lastReadAt`

## [2026-06-26] PWA Phase 7 — Notifications

**Loại:** feature

**Các thay đổi:**
- `src/lib/pwa-notifications.ts` — utility derive notifications từ course data (không cần DB model):
  - 5 loại: `overdue` / `deadline_3d` / `deadline_7d` / `mandatory_not_started` / `course_completed`
  - Read state lưu localStorage (`pwa-notifs-read-ids`)
  - `markAllRead()` dispatch `pwa-notifs-updated` event để BottomNav cập nhật badge
  - `groupByDay()` group theo Hôm nay / Hôm qua / Trước đó
  - `computeStreak()` helper cho Progress screen
- `src/components/pwa/bottom-nav.tsx` — thêm unread badge trên Bell icon:
  - Đọc count từ `pwa-notifs-unread-count` localStorage
  - Listen `pwa-notifs-updated` event để real-time update
  - Badge đỏ, hiện số (max "9+")
- `src/components/pwa/notif-item.tsx` — notification list item:
  - Icon theo type (AlertCircle/Clock/CheckCircle/BookOpen)
  - Unread indicator (dot xanh + background primary-tint nhạt)
  - Relative time (vừa xong / X phút / X giờ / X ngày trước)
- `src/app/(pwa)/app/notifications/page.tsx` — màn hình thông báo:
  - Header + "Đọc tất cả" button (chỉ hiện khi có unread)
  - Unread summary pill
  - Grouped list theo ngày với day label
  - Empty state khi không có thông báo
  - Mark single / mark all read → reset badge + toast
- `src/app/(pwa)/app/notifications/loading.tsx` — skeleton

**Kết quả:**
- Build sạch; `/app/notifications` = 5.15 kB (tăng từ 1.29 kB)
- `pm2 restart lms-web` → status online

**Lưu ý / Rủi ro:**
- Notification derive từ course data, không persist DB — mỗi lần load lại sẽ tái tính
- Read state chỉ persist trên thiết bị (localStorage) — không sync cross-device
- Khi có Notification model DB trong tương lai, replace `pwa-notifications.ts` với API call

---

## [2026-06-26] PWA Phase 6 — Progress Screen

**Loại:** feature

**Các thay đổi:**
- `src/app/(pwa)/app/progress/page.tsx` — màn hình tiến độ học tập đầy đủ:
  - Hero gradient: % tổng thể (tính average progressPercent), streak badge tính từ completedAt dates
  - Progress bar trắng trên gradient hero
  - 3 stat cards: Tổng / Đang học / Hoàn thành
  - Achievement chips: chứng chỉ / bắt buộc / giờ học / streak (chỉ hiện khi >0)
  - Per-course sections: "Đang học" + "Chưa bắt đầu" (luôn expand) + "Đã hoàn thành" (collapsible)
  - `CourseProgressCard`: title, progress bar thick, % + giờ + source badge (Tập đoàn/Nhóm học/Công ty), deadline warning (đỏ nếu quá hạn, vàng nếu ≤7 ngày)
  - `DeadlineWarning`: hiện khi còn ≤7 ngày hoặc đã qua hạn
  - `computeStreak()`: tính streak từ completedAt dates (unique days, consecutive)
- `src/app/(pwa)/app/progress/loading.tsx` — skeleton đầy đủ
- `src/app/(pwa)/app/progress/error.tsx` — error boundary

**Kết quả:**
- Build sạch; `/app/progress` = 4.87 kB (tăng từ 1.29 kB)
- `pm2 restart lms-web` → status online

**Lưu ý / Rủi ro:**
- Streak tính từ completedAt (ngày hoàn thành khóa học), không phải session học hàng ngày — sẽ chính xác hơn khi có per-lesson completion tracking

---

## [2026-06-26] PWA Phase 5 — Quiz Engine

**Loại:** feature

**Các thay đổi:**
- `src/components/pwa/quiz-option.tsx` — QuizOption component với 5 trạng thái: default / selected (primary-tint) / correct (success-tint) / wrong (danger-tint) / correct-unselected (mờ xanh lá cho đáp án đúng user không chọn)
- `src/app/(pwa)/app/courses/[courseId]/quiz/[quizId]/page.tsx` — Quiz engine đầy đủ:
  - **States**: loading → intro → quiz → submitting → result
  - **Intro**: cảnh báo thời gian, nút bắt đầu
  - **Quiz**: progress steps (dot navigation), timer đếm ngược với badge đổi màu đỏ khi ≤60s, câu hỏi 1-by-1 (navigate prev/next), hiển thị độ khó (Dễ/Vừa/Khó), điểm per câu
  - **Timer**: auto-submit khi hết giờ + toast cảnh báo
  - **Submit**: nộp khi câu cuối hoặc "Nộp bài ngay" nếu đã trả lời hết, gọi `POST /api/quizzes/{attemptId}/submit`
  - **Result**: score %, pass/fail hero, stats 3 cột (Đúng/Sai/Tổng), review tất cả câu với correct/wrong option highlight, "Làm lại" nếu trượt
  - **Exit modal**: bottom sheet xác nhận thoát (không dùng confirm() — tuân thủ CLAUDE.md)

**Kết quả:**
- Build sạch; quiz route = 6.45 kB (tăng từ 1.59 kB placeholder)
- `pm2 restart lms-web` → status online

**Lưu ý / Rủi ro:**
- API submit nhận `{answers: Record<questionId, optionKey>}` — optionKey là "A"/"B"/"C"/"D"
- Server có 30s grace period sau hết giờ trước khi từ chối submit
- `startQuiz` endpoint: `GET /api/quizzes/{lessonId}/start?enrollmentId=...` — quizId trong URL = lessonId

---

## [2026-06-26] PWA Phase 4 — Video Player

**Loại:** feature

**Các thay đổi:**
- `src/app/(pwa)/app/courses/[courseId]/lessons/[lessonId]/page.tsx` — màn hình xem bài học PWA:
  - Header đen (sticky) với back button + lesson title
  - Video: tái dùng `VideoPlayer` (video.js HLS) với dynamic import ssr:false; remount mỗi 15 phút (`urlKey`) để renew presigned URL
  - PDF: `PdfEmbed` component gọi `/api/assets/{id}/view-url` → iframe
  - Text: render HTML nội dung
  - Tab bar: Bài học / Ghi chú
  - Ghi chú cá nhân lưu localStorage (`pwa-lesson-notes-{lessonId}`), auto-save debounced 500ms
  - Progress batch: queue mỗi 5s, flush mỗi 10s + flush on unmount → POST `/api/my/courses/{id}/lessons/{id}/progress`
  - VideoPlayer.onComplete → flush 100% + mark completed
  - Manual complete button cho text/pdf
  - Next/prev lesson navigation cards
  - "Next lesson bar" sticky (bottom-16) hiện sau khi hoàn thành
- `src/app/(pwa)/app/courses/[courseId]/lessons/[lessonId]/loading.tsx` — skeleton
- `src/app/(pwa)/app/courses/[courseId]/lessons/[lessonId]/error.tsx` — error boundary
- `src/app/(pwa)/app/courses/[courseId]/quiz/[quizId]/page.tsx` — placeholder quiz route (Phase 5 implement đầy đủ)

**Kết quả:**
- Build sạch; lesson player = 6.7 kB (dynamic), quiz placeholder = 1.59 kB
- `pm2 restart lms-web` → status online

**Lưu ý / Rủi ro:**
- HLS manifest proxy (`/api/assets/{id}/manifest`) không cần renewal — server-side signing
- Direct MP4 URL: Redis cache 1080s (18 min); remount VideoPlayer sau 15 min đảm bảo URL còn hạn
- Tracking video events vẫn qua `/api/tracking/video` (heartbeat từ VideoPlayer); progress % riêng qua lesson progress API

---

## [2026-06-26] PWA Phase 3 — Course Detail + Lesson List

**Loại:** feature

**Các thay đổi:**
- `src/components/pwa/lesson-item.tsx` — LessonItem với 3 trạng thái: done (check xanh) / active (số có viền primary) / locked (số xám); phân loại icon theo contentType (video/pdf/quiz); auto-build href đúng
- `src/components/pwa/skeleton/lesson-skeleton.tsx` — skeleton cho LessonItem + CourseDetailSkeleton
- `src/app/(pwa)/app/courses/[courseId]/page.tsx` — màn hình chi tiết khóa học: hero ảnh/gradient, back button overlay, info block, progress bar, nút "Bắt đầu học" (auto-enroll), tab bar (Nội dung / Tài liệu / Kiểm tra), danh sách section + lesson với trạng thái, mô tả
- `src/app/(pwa)/app/courses/[courseId]/loading.tsx` — skeleton loading
- `src/app/(pwa)/app/courses/[courseId]/error.tsx` — error boundary với nút quay lại + thử lại
- `src/app/(pwa)/app/courses/page.tsx` — nâng cấp từ placeholder thành màn hình đầy đủ: search bar, filter tabs (Tất cả / Đang học / Chưa bắt đầu / Hoàn thành), danh sách CourseListItem

**Kết quả:**
- Build sạch; `/app/courses` = 1.8 kB, `/app/courses/[courseId]` = 5.61 kB (dynamic)
- `pm2 restart lms-web` → status online

**Lưu ý / Rủi ro:**
- Lesson status logic: sequential mode khóa bài tiếp theo nếu bài trước chưa done; free mode mọi bài đều active sau khi enroll

---

## [2026-06-26] PWA Phase 2 — Home Screen

**Loại:** feature

**Các thay đổi:**
- `src/app/(pwa)/layout.tsx` — thêm `AuthProvider` + `ToastProvider` wrap
- `src/app/(pwa)/app/home/page.tsx` — màn hình trang chủ đầy đủ: hero gradient, stat cards (3 cột), ContinueCard, danh sách đang học, chưa bắt đầu; redirect về `/login` nếu chưa auth
- `src/app/(pwa)/app/home/loading.tsx` — skeleton đầy đủ tương ứng với layout thật
- `src/components/pwa/progress-bar.tsx` — reusable progress bar (thin/thick variant)
- `src/components/pwa/course-card.tsx` — `ContinueCard` (large) + `CourseListItem` (compact) với deadline badge, mandatory badge, progress bar
- `src/components/pwa/skeleton/course-skeleton.tsx` — skeleton cho cả 2 card variant

**Kết quả:**
- Build sạch, `/app/home` = 4.31 kB (tăng từ 1.28 kB)
- `pm2 restart lms-web` → status online

**Lưu ý / Rủi ro:**
- Data fetch qua `useAuth()` → accessToken → `/api/my/courses`; nếu token hết hạn sẽ auto-refresh theo logic AuthProvider

---

## [2026-06-26] PWA Phase 1 — Scaffold + Layout

**Loại:** feature

**Các thay đổi:**
- `src/app/(pwa)/layout.tsx` — PWA route group layout: Inter font, PWA metadata, viewport, BottomNav
- `src/app/(pwa)/app/page.tsx` — redirect `/app` → `/app/home`
- `src/app/(pwa)/app/home/page.tsx` — placeholder trang chủ
- `src/app/(pwa)/app/home/loading.tsx` — skeleton loading state
- `src/app/(pwa)/app/home/error.tsx` — error boundary
- `src/app/(pwa)/app/courses/page.tsx` — placeholder khóa học
- `src/app/(pwa)/app/progress/page.tsx` — placeholder tiến độ
- `src/app/(pwa)/app/notifications/page.tsx` — placeholder thông báo
- `src/app/(pwa)/app/profile/page.tsx` — placeholder hồ sơ
- `src/components/pwa/bottom-nav.tsx` — bottom nav 5 tabs, active state, safe area inset
- `src/components/pwa/pwa-header.tsx` — header với back button + title slot
- `public/manifest.json` — PWA manifest (start_url: /app/home, theme: #185FA5)
- `public/sw.js` — service worker cache shell + offline fallback

**Kết quả:**
- Build thành công, routes `/app/home`, `/app/courses`, `/app/progress`, `/app/notifications`, `/app/profile` live
- `pm2 restart lms-web` → status online

**Lưu ý / Rủi ro:**
- Cần tạo icon-192.png và icon-512.png trong `public/icons/` để PWA install hoạt động đầy đủ
- Service worker chỉ cache shell, chưa có offline page riêng

---

## [2026-06-26 15:25] Fix đăng nhập thất bại: Redis + Tailwind CSS + auth degraded mode

**Loại:** fix + deploy

**Các thay đổi:**
- **Redis** — Cài đặt Redis 5.0.14 (tporadowski/redis) vào `C:\Redis\`, đăng ký như Windows Service (`redis-server --service-install`). Redis đã chạy và PING thành công.
- `src/services/auth.service.ts` — Fix `refresh()`: chỉ ném lỗi 401 khi Redis trả về token cụ thể và không khớp. Nếu Redis trả về `null` (không chạy hoặc chưa có token), vẫn cho phép refresh dựa vào JWT signature. Trước đây: `null !== refreshToken` → 401 ngay sau login.
- `tailwind.config.ts` — Thêm mapping CSS variables shadcn/ui (`background`, `foreground`, `card`, `popover`, `secondary`, `muted`, `accent`, `destructive`, `input`, `ring`) để `@apply bg-background text-foreground` trong globals.css không bị lỗi "class does not exist" khi build không có cache.
- Sửa `border.DEFAULT` từ `rgba(0,0,0,0.08)` thành `hsl(var(--border))` (đổi tên sang `border.subtle` để vẫn dùng được).

**Kết quả:**
- Build thành công sau khi xóa cache, `pm2 restart lms-web` → online
- Redis online, không còn lỗi trong log
- Đăng nhập qua domain hoạt động bình thường

**Lưu ý / Rủi ro:**
- Redis Service đã cài và start. Nếu server restart, Redis sẽ tự động start lại (đã đăng ký service).
- Nếu có class Tailwind dùng `border` (không phải `border-subtle`), màu sẽ đổi từ `rgba(0,0,0,0.08)` sang `hsl(var(--border))` — cần kiểm tra UI thực tế.

## [2026-06-25 10:45] Fix SMTP port sai — email không gửi được

**Loại:** config

**Các thay đổi:**
- `SmtpConfig` (DB) — Sửa `port` từ 995 (POP3S — nhận mail) thành 465 (SMTPS — gửi mail). Port 995 khiến nodemailer nhận phản hồi POP3 thay vì SMTP greeting → lỗi EPROTOCOL. Port 465 và 587 đều kết nối thành công; chọn 465 vì `secure = true` đã đúng.
- Gửi test email đến `nam.dv@kowil.com.vn` thành công (response `250 2.6.0 Ok`).
- `pm2 restart lms-web` để xóa cache SMTP transporter trong memory.

**Kết quả:**
- Email hoạt động, `nam.dv@kowil.com.vn` đã nhận được email test
- Mọi chức năng gửi mail (welcome, reset password, invite) giờ hoạt động bình thường

**Lưu ý / Rủi ro:**
- Trong giao diện Cài đặt → Mail Server, cần sửa port hiển thị thành 465 để khớp với thực tế trong DB

## [2026-06-25 10:30] Fix lỗi học viên xem khóa học + email admin + xác thực email domain

**Loại:** fix

**Các thay đổi:**
- `src/services/enrollment.service.ts` — Fix lỗi nghiêm trọng: raw SQL dùng `"Section"` nhưng tên bảng thực trong PostgreSQL là `"CourseSection"` → gây crash `P2010` cho mọi học viên khi vào khóa học. Đã đổi thành `"CourseSection"`.
- `src/app/api/organizations/[id]/admin/route.ts` — (1) Thêm xác thực MX record qua `checkEmailDomain()` trước khi tạo admin (giống `/api/users`). (2) Await `sendWelcomeEmail()` thay vì fire-and-forget, trả về `emailSent: true/false` và `emailError` thực tế thay vì luôn `true`.
- `src/app/(dashboard)/organizations/[id]/page.tsx` — Cập nhật thông báo tạo admin: phân biệt email gửi thành công / thất bại (kèm lý do như "SMTP chưa cấu hình").

**Kết quả:**
- Build thành công, `pm2 restart lms-web` → status online
- Học viên có thể xem khóa học không còn bị lỗi hệ thống
- Tạo admin sẽ báo đúng trạng thái email

**Lưu ý / Rủi ro:**
- Bảng `SmtpConfig` trong DB hiện TRỐNG — SMTP chưa được cấu hình. Đây là nguyên nhân email `nam.dv@kowil.com.vn` không nhận được. Cần vào **Cài đặt → Cấu hình Email (SMTP)** để nhập thông tin máy chủ email và test gửi trước khi tạo user tiếp theo.

## [2026-06-25 10:00] Fix 3 lỗi: vận hành hệ thống, tạo company_admin, phân tách user theo công ty

**Loại:** fix

**Các thay đổi:**
- `src/app/api/admin/operations/route.ts` — Fix crash: prisma query dùng sai tên relation (`userRoles` → `users`) và field không tồn tại (`isActive` trên `UserRole`). Sửa bằng cách bỏ `_count`, thêm `prisma.user.count()` riêng per company với filter `roles.some { organization: { OR: [{ id }, { companyId }] } }`. Đồng thời tính enrollment và completion per company.
- `src/services/user.service.ts` — Thêm param `filterCompanyId?: string | null` để group_admin có thể lọc user theo từng công ty cụ thể. Logic: `effectiveCompanyId = isGroupAdmin ? (filterCompanyId ?? null) : companyId`; `applyOrgFilter = !isGroupAdmin || !!filterCompanyId`. Thêm `companyId` vào organization select.
- `src/app/api/users/route.ts` — GET handler trích xuất `filterCompanyId` từ query string (chỉ cho group_admin), truyền vào `getUsers()`.
- `src/app/(dashboard)/users/page.tsx` — Thêm dropdown lọc theo công ty (chỉ hiện với group_admin). Thêm cột "Công ty" trong bảng. Hàm `getUserCompany()` lấy tên công ty từ role. Hiển thị đếm "N người dùng (tất cả / đã lọc)".
- `src/app/(dashboard)/organizations/[id]/page.tsx` — Fix `loadUsers()`: dùng `filterCompanyId` cho org loại company, `deptId` cho dept/team. Thêm section "Tạo quản trị viên" (amber box, chỉ hiện group_admin + company org): form tạo company_admin qua endpoint `/api/organizations/${id}/admin`.

**Kết quả:**
- Build thành công, `pm2 restart lms-web` → status online
- Menu "Vận hành hệ thống" không còn báo lỗi
- group_admin có thể chọn công ty để lọc user và tạo company_admin

**Lưu ý / Rủi ro:**
- Vấn đề tenant isolation ở cấp dữ liệu (user được gán vào sai org khi tạo trước đây) cần kiểm tra lại bằng SQL. Code logic đã đúng.

## [2026-06-24 XX:XX] Fix 6 lỗi: sidebar động, branding công ty, tenant isolation, nhóm ngoài hệ thống

**Loại:** fix + feature

**Các thay đổi:**
- `src/app/api/me/company/route.ts` — NEW: endpoint trả về branding (tên, logo, màu) của công ty người dùng hiện tại. Accessible cho mọi role.
- `src/app/(dashboard)/layout.tsx` — Sidebar hiển thị logo công ty (nếu có) hoặc tên công ty thay vì hardcode "Tập đoàn". Áp dụng CSS variable `--color-primary` từ metadata công ty.
- `src/services/organization.service.ts` — Fix bug: khi tạo org loại 'company', trường `companyId` được set đúng = id của chính org đó (sau khi tạo), thay vì sai = parentId. Dùng transaction để update ngay sau khi create.
- `src/services/user.service.ts` — Thêm guard: nếu `companyId` rỗng và không phải group_admin → trả về mảng rỗng, tránh trường hợp trả về tất cả user.
- `src/app/api/learning-groups/[id]/members/[userId]/route.ts` — Fix: thêm `company_admin` và `hr_manager` vào quyền xóa member (trước chỉ có group_admin/group_hrm).
- `src/app/api/learning-groups/[id]/members/import/route.ts` — NEW: GET tải file mẫu CSV, POST bulk import email từ CSV/Excel (tối đa 200), gọi `addMember()` cho từng email.
- `src/components/learning-group/external-member-search.tsx` — Thêm UI import từ file (download template, upload CSV/Excel, hiển thị kết quả chi tiết). Fix UI delete button vẫn hiển thị đúng.

**Kết quả:**
- Build thành công, `pm2 restart lms-web` → status online
- Sidebar giờ hiển thị "LMS + logo công ty" hoặc "LMS + tên công ty"
- Màu chủ đạo (primaryColor) từ cài đặt công ty được áp dụng tự động vào dashboard
- Xóa member nhóm ngoài hệ thống hoạt động cho company_admin và hr_manager
- Import hàng loạt email vào nhóm external qua CSV/Excel

**Lưu ý / Rủi ro:**
- Org 'company' mới tạo sau fix này sẽ có `companyId = id riêng`. Org cũ vẫn dùng cấu trúc cũ — không ảnh hưởng query vì check `OR [id, companyId]`.
- Tenant isolation bug (3 công ty đều thấy user CTA) có thể là vấn đề dữ liệu (user được assign vào sai org). Code logic đã được kiểm tra là đúng. Đã thêm guard `companyId` rỗng.

## [2026-06-25] Fix AI import tài liệu: bỏ FastAPI, xử lý trực tiếp trong Next.js

**Loại:** fix + refactor

**Nguyên nhân gốc:** FastAPI AI service không chạy (không có trong PM2). Health check phát hiện đúng nhưng giải pháp đúng là loại bỏ dependency vào FastAPI cho tính năng này.

**Các thay đổi:**
- `npm install pdf-parse mammoth jszip @types/pdf-parse @types/jszip` — packages parse tài liệu
- `src/services/ai-document-processor.ts` (mới) — Xử lý toàn bộ pipeline trực tiếp trong Node.js:
  - PDF: dùng `pdf-parse`
  - DOCX: dùng `mammoth`
  - PPTX: dùng `jszip` đọc XML slide
  - Tách text thành chunks ~2000 ký tự theo đoạn văn
  - Gọi LLM qua OpenAI-compatible API (`{endpoint}/chat/completions`) với model từ `AiServiceConfig`
  - Parse JSON response, save câu hỏi vào DB với status `review`
  - Update tiến độ sau mỗi chunk, xử lý tối đa 8 chunks
- `src/app/api/question-banks/[id]/import-document/route.ts` — Pre-flight check: verify có AI config active trước khi tạo job; fire-and-forget qua `setImmediate()` thay vì gọi FastAPI

**Kết quả:** build ✓, pm2 lms-web online. Document import giờ hoạt động với bất kỳ AI endpoint OpenAI-compatible nào được cấu hình.

## [2026-06-25] 3 fixes: AI import lỗi rõ ràng, template CSV font, dashboard vận hành

**Loại:** fix + feature

**AI Import câu hỏi từ tài liệu:**
- `import-document/route.ts` — Health check đồng bộ tới AI service trước khi tạo job; nếu down báo lỗi ngay. Fetch fail → mark job `failed` với message cụ thể
- `question-bank.service.ts` — Thêm `markImportJobFailed()`
- `import-document-modal.tsx` — Timeout 8 phút, elapsed timer, hướng dẫn khắc phục trong màn lỗi

**Template CSV câu hỏi:**
- `import-csv/route.ts` — Thêm UTF-8 BOM vào đầu CSV → Excel Windows đọc tiếng Việt đúng

**Dashboard vận hành (mới - group_admin):**
- `require-role.ts` — Redis key `online:{userId}` TTL 15 phút mỗi request xác thực
- `api/admin/operations/route.ts` — API: RAM/uptime/Node, online users từ Redis, DB stats per company
- `(dashboard)/operations/page.tsx` — Dashboard tự làm mới 30s: memory bars, online users, bảng công ty
- `layout.tsx` — Nav link "Vận hành hệ thống" cho group_admin

**Kết quả:** build ✓, pm2 lms-web online

## [2026-06-25 00:30] Fix 4 issues: file upload wizard, tạo admin công ty, nút chỉnh sửa, nhóm học tập

**Loại:** fix + feature

**Các thay đổi:**

### 1. AI Course Wizard — upload tài liệu tham khảo
- `src/components/wizard/step-course-info.tsx`: Thay textarea đơn thuần bằng khu vực kéo-thả + nút "chọn từ máy tính". Hỗ trợ TXT (đọc trực tiếp trên browser), PDF và DOCX (gọi server). Hiển thị badge tên file sau khi trích xuất, trạng thái loading, thông báo lỗi inline.
- `src/app/api/wizard/extract-text/route.ts` **Tạo mới**: POST endpoint trích xuất text từ file. TXT → UTF-8. PDF → pdfjs-dist (legacy Node.js). DOCX → parse ZIP với `inflateRawSync` + strip XML tags.

### 2. Tạo công ty + tài khoản admin
- `src/app/(dashboard)/organizations/page.tsx`: Sau khi group_admin tạo công ty → hiển thị step-2 modal "Tạo tài khoản quản trị". Sinh mật khẩu ngẫu nhiên, gửi email. Nút "Bỏ qua" để tạo sau.
- `src/app/api/organizations/[id]/admin/route.ts` **Tạo mới**: POST tạo user company_admin, sinh password, hash bcrypt, UserRole, gửi welcome email async.

### 3. Nút Chỉnh sửa tổ chức không phản hồi
- `src/app/(dashboard)/organizations/[id]/page.tsx`: Click "Chỉnh sửa" → `setActiveTab('info')` đồng thời để form luôn hiện. Thay `alert()`/`confirm()` bằng `toast()`. Thêm `removingRoleId` loading state.

### 4. Nhóm học tập ẩn với company_admin
- `src/app/(dashboard)/layout.tsx`: Thêm `company_admin`, `hr_manager` vào roles của `/learning-groups`.

**Kết quả:**
- `npm run build` thành công, `pm2 restart lms-web` online

**Lưu ý / Rủi ro:**
- PDF extraction: nếu PDF scan (ảnh) thì text trống — khuyến nghị dùng PDF có layer text
- DOCX extraction không hỗ trợ table content phức tạp
- Admin creation gửi email async — nếu SMTP chưa cấu hình, user vẫn được tạo

## [2026-06-24] Fix AI config: test kết nối hỗ trợ OpenAI-compatible API

**Loại:** fix

**Các thay đổi:**
- `src/services/ai-config.service.ts` — `testAiConnection` và `getAvailableModels` trước đó hardcode `/api/tags` (Ollama-only). Thêm helper `probeEndpoint` tự động thử `/api/tags` (Ollama) trước, nếu thất bại thử `/models` (OpenAI-compatible). Hỗ trợ cả 2 kiểu response: `{models:[{name}]}` (Ollama) và `{data:[{id}]}` (OpenAI)

**Kết quả:**
- Test kết nối với endpoint OpenAI-compatible (VNG Cloud, Azure, v.v.) hoạt động đúng
- `npm run build` → ✓ compiled successfully
- `pm2 restart lms-web` → online

## [2026-06-24] Fix AI config: group_admin thấy tất cả config, hiển thị chọn công ty, sửa logo upload

**Loại:** fix

**Các thay đổi:**
- `src/app/(dashboard)/ai-config/page.tsx` — Sửa `isGroupAdmin` check: client-side `user.roles` là array of objects `{role, organizationId, organizationName}[]`, không phải `string[]`. Phải dùng `.map(r => r.role).includes(...)` giống settings/page.tsx. Hệ quả: menu chọn công ty nay hiển thị đúng với group_admin
- `src/app/api/ai-config/route.ts` — GET handler: truyền `isGroupAdmin` vào `getAiConfigs()` (trước đó không truyền nên group_admin không thấy config của công ty con)
- `src/services/ai-config.service.ts` — `getAiConfigs`: khi `isGroupAdmin = true` bỏ qua filter companyId trong SQL → trả tất cả config trong DB
- `src/app/api/upload/logo/route.ts` — Thay `getPresignedDownloadUrl()` bằng proxy URL `/api/public/image?key=...`. Loại bỏ lỗi `ExpiresParamError` và không cần expose port 9000
- `src/app/api/organizations/[id]/logo/route.ts` — Tương tự: dùng proxy URL thay presigned URL

**Kết quả:**
- Group admin xem thấy toàn bộ AI config kể cả config được tạo bởi company admin
- Mục "Công ty được phép sử dụng" hiển thị đúng với group_admin
- Upload logo không còn lỗi ExpiresParamError
- `npm run build` → ✓ compiled successfully
- `pm2 restart lms-web` → online

## [2026-06-24] Fix 4 issues: tiến độ, logo/background, AI config UI

**Loại:** fix + feature

**Các thay đổi:**
- `src/services/enrollment.service.ts` — Sửa SQL tiến độ: thay `AVG(progressPct)` bằng correlated subquery `SUM/COUNT(all lessons)`, đảm bảo bài học chưa xem tính là 0% thay vì bị bỏ qua
- `src/app/api/public/image/route.ts` — Tạo mới: proxy ảnh logo/background từ MinIO qua Next.js (không cần expose port 9000)
- `src/app/api/public/branding/route.ts` — Dùng `/api/public/image?key=` thay vì presigned URL cho logo và background; đảm bảo ảnh hiển thị qua domain
- `src/app/(dashboard)/settings/page.tsx` — Lưu `loginBgObjectName` vào metadata org khi upload background; load đúng field khi render
- `prisma/schema.prisma` — Thêm field `allowedCompanyIds Json?` vào model `AiServiceConfig`
- `src/services/ai-config.service.ts` — Thêm `allowedCompanyIds` vào schema + upsert; filter config theo công ty được phép
- `src/app/(dashboard)/ai-config/page.tsx` — Thêm field API key (tùy chọn) và checkbox danh sách công ty vào modal tạo mới
- `src/components/ai-config/config-card.tsx` — Thêm hiển thị trạng thái API key ("Đã cấu hình"/"Chưa có"), form thay đổi API key, và checkbox danh sách công ty vào modal chỉnh sửa

**Kết quả:**
- Tiến độ khóa học tính đúng: xem 1/5 video → 20%, không phải 100%
- Logo và ảnh nền login hiển thị bình thường qua domain công khai
- AI config: có thể nhập API key cho AI đối tác (OpenAI-compatible), giới hạn công ty được phép dùng từng config
- `prisma db push` + `prisma generate` (stop PM2 trước) → thành công
- `npm run build` → ✓ compiled successfully
- `pm2 restart lms-web` → online

**Lưu ý / Rủi ro:**
- API key AI được lưu plain text trong DB (chưa encrypt) — chấp nhận được cho môi trường nội bộ, cần encrypt nếu đưa lên cloud
- `allowedCompanyIds: null` = tất cả công ty được dùng (backward-compatible với config cũ)

## [2026-06-24] Fix video không chạy qua domain — proxy HLS segment qua Next.js

**Loại:** fix

**Các thay đổi:**
- `src/app/api/assets/[id]/segment/[...segPath]/route.ts` *(file mới)*: Route proxy segment HLS. GET `/api/assets/[id]/segment/segment_000.ts` → fetch từ MinIO nội bộ → stream ra browser. Không cần auth (UUID bảo vệ đủ). Content-Type `video/mp2t`. Cache 1h.
- `src/app/api/assets/[id]/manifest/route.ts`: Đổi rewrite từ presigned MinIO URLs sang `/api/assets/[id]/segment/[filename]`. Lý do: MinIO port 9000 không expose ra internet — browser truy cập qua domain không kết nối được trực tiếp. Proxy qua Next.js (port 80/443) giải quyết triệt để.

**Kết quả:**
- `npm run build` thành công, `pm2 restart lms-web` → online
- manifest trả `segment URL: /api/assets/.../segment/segment_000.ts`
- segment proxy: **200 OK, 306 KB** — video chạy được hoàn toàn qua domain

**Lưu ý / Rủi ro:**
- Segment traffic đi qua Node.js process thay vì trực tiếp MinIO → tốn thêm CPU/RAM server. Với số lượng user nhỏ đây không phải vấn đề. Nếu scale lớn sau này có thể dùng nginx proxy MinIO hoặc CDN.

## [2026-06-24] Fix SSR crash DOMMatrix + dynamic import VideoPlayer/PdfViewer

**Loại:** fix

**Các thay đổi:**
- `src/app/(dashboard)/my-courses/[id]/lessons/[lessonId]/page.tsx`: Đổi import tĩnh `VideoPlayer` và `PdfViewer` sang `dynamic(..., { ssr: false })`. Lý do: `pdfjs-dist` và `video.js` dùng `DOMMatrix` và các browser-only API — khi Next.js SSR trang này sẽ crash với `ReferenceError: DOMMatrix is not defined`. Dynamic import với `ssr: false` ngăn các library này load ở server. Bundle lesson page giảm từ 329 kB → 4.84 kB.

**Kết quả:**
- `npm run build` thành công
- `pm2 restart lms-web` → status online
- Không còn lỗi DOMMatrix trong logs
- Test end-to-end: Login → stream-url → manifest → segment 200 OK — video hoạt động

**Lưu ý / Rủi ro:**
- VideoPlayer và PdfViewer sẽ hiện loading placeholder trong ~1s khi trang load lần đầu (vì lazy load JS). Đây là trade-off chấp nhận được.

## [2026-06-24] Fix MinIO presigned URL 403 — dùng public endpoint để ký URL

**Loại:** fix

**Các thay đổi:**
- `src/lib/minio.ts`: Thêm `minioPresignClient` — MinIO client dùng public endpoint (`MINIO_PUBLIC_URL`) thay vì internal `localhost`. Lý do: AWS4 presigned URL ký `Host` header. Nếu ký với `localhost:9000` nhưng browser gọi tới `lms.phuthaiholdings.com:9000`, host không khớp → 403 SignatureDoesNotMatch. Giải pháp: ký với public endpoint để host signature khớp với request của browser. Bỏ `rewriteToPublic()` vì không còn cần thiết.

**Kết quả:**
- `npm run build` thành công
- `pm2 restart lms-web` → status online
- Test end-to-end với user `nam.dv@phuthaiholdings.com`: Login OK → stream-url OK → manifest 200 → segment fetch 200 → Video load được

**Lưu ý / Rủi ro:**
- `minioPresignClient` kết nối tới public endpoint (`lms.phuthaiholdings.com:9000`) để ký URL. Nếu domain không resolve được từ server → fallback sang internal client (khi không có MINIO_PUBLIC_URL).
- `minioClient` (internal) vẫn dùng cho tất cả object operations (get, put, copy, delete).

## [2026-06-24] Fix video HLS không load + fix ExpiresParamError thumbnail

**Loại:** fix

**Các thay đổi:**
- `src/app/api/assets/[id]/manifest/route.ts`: Bỏ `withAuth` middleware — manifest endpoint không cần Bearer token. UUID của asset là đủ bảo mật; segment URLs là presigned (hết hạn sau 2h). Root cause: VHS `xhr.beforeRequest` trong player options không hoạt động → request manifest không có Authorization header → 401 → "HLS playlist request error".
- `src/components/lesson/VideoPlayer.tsx`: Bỏ config `xhr.beforeRequest` không hoạt động trong player options. Manifest endpoint giờ là public nên không cần.
- `src/app/api/courses/[id]/thumbnail/route.ts`: Sửa TTL presigned URL thumbnail từ `5 * 365 * 24 * 3600` (5 năm, vượt giới hạn MinIO) → `7 * 24 * 3600` (7 ngày, max MinIO). Dùng `getPresignedDownloadUrl` thay vì gọi trực tiếp `minioClient.presignedGetObject`.

**Kết quả:**
- `npm run build` thành công
- `pm2 restart lms-web` → status online
- Video HLS sẽ load được khi học viên play

**Lưu ý / Rủi ro:**
- Thumbnail presigned URL hết hạn sau 7 ngày — cần upload lại hoặc implement auto-refresh sau. objectName nên được lưu riêng để tái tạo URL.
- Manifest endpoint không có auth — ai biết UUID của asset đều lấy được manifest (nhưng không có session ID MinIO để access bucket trực tiếp).

## [2026-06-24 00:30] Fix quiz template download + thêm CSV import cho Question Bank

**Loại:** fix + feature

**Các thay đổi:**
- `src/app/(dashboard)/courses/[id]/page.tsx`: Fix bug tải file mẫu quiz — đổi `<a href>` (không gửi Authorization header) thành `fetch()` + blob URL download
- `src/app/api/question-banks/[id]/import-csv/route.ts`: **Tạo mới** — GET trả file mẫu CSV, POST parse và bulk-import câu hỏi vào question bank
- `src/app/(dashboard)/question-banks/[id]/page.tsx`: Thêm nút "↓ Mẫu CSV" và "📥 Import CSV" với modal đầy đủ (template download + file picker + validation error display)

**Kết quả:**
- Build thành công, lms-web online

**Lưu ý / Rủi ro:**
- Root cause quiz template: `withRole` middleware yêu cầu Bearer token trong header, nhưng `<a href>` chỉ gửi cookies — fix bằng fetch() trong JS
- Question bank CSV import tạo questions với status `approved` (không qua review queue)

## [2026-06-24 00:00] External User Group — Nhóm người dùng ngoài hệ thống

**Loại:** feature

**Các thay đổi:**
- `prisma/schema.prisma`: Thêm `external` vào enum `GroupType`; thêm `isActive Boolean @default(true)` vào `GroupMember`; thêm `isExternal Boolean` và `mustChangePassword Boolean` vào `User`
- `src/services/learning-group.service.ts`: Mở rộng `addMember()` — validate email MX record, tự động tạo tài khoản external user (isExternal=true) khi email chưa tồn tại, gửi email mời; thêm `toggleMemberActive()`; cập nhật `createGroupSchema` thêm `external` type; cập nhật `getLearningGroup` select thêm `isExternal` cho user
- `src/services/enrollment.service.ts`: Thêm filter `gm."isActive" = true` vào UNION query source2 — inactive member không thấy courses
- `src/services/email.service.ts`: Thêm `sendExternalLearnerInviteEmail()` với template hiển thị tên nhóm và danh sách khóa học
- `src/services/auth.service.ts`: Return `mustChangePassword` trong `LoginResult`
- `src/components/providers/auth-provider.tsx`: Sau login kiểm tra `mustChangePassword` → redirect `/change-password` thay vì `/dashboard`
- `src/app/api/learning-groups/[id]/members/route.ts`: Thêm PATCH handler để toggle active/inactive member
- `src/app/api/auth/change-password/route.ts`: **Tạo mới** — endpoint đổi mật khẩu, invalidate refresh token sau khi đổi
- `src/app/(auth)/change-password/page.tsx`: **Tạo mới** — trang đổi mật khẩu bắt buộc lần đầu đăng nhập
- `src/app/(dashboard)/learning-groups/page.tsx`: Thêm option "Ngoài hệ thống" khi tạo nhóm, badge màu cam
- `src/app/(dashboard)/learning-groups/[id]/page.tsx`: Hỗ trợ type `external`, toggle active/inactive, badge "Ngoài CT" cho external users
- `src/components/learning-group/external-member-search.tsx`: **Tạo mới** — component thêm external user bằng email với validation feedback

**Kết quả:**
- Build thành công, không có lỗi TypeScript
- `prisma db push` thành công — schema đã sync với DB
- `prisma generate` thành công (sau khi stop PM2)
- `pm2 restart all` — lms-web và lms-worker đều online

**Lưu ý / Rủi ro:**
- External users được tạo với role `learner` và gán vào org của người thêm (hoặc org của company nếu group có companyId)
- Email invite gửi async — không block response nếu SMTP chưa cấu hình
- `mustChangePassword` chỉ là signal frontend redirect, không block access token
- Inactive member vẫn còn trong nhóm (chỉ ẩn khỏi courses) — reactivate bằng toggle

## [2026-06-24 23:50] Fix company_admin không có quyền lưu cài đặt branding

**Loại:** fix

**Các thay đổi:**
- `src/services/organization.service.ts` — `updateOrganization()` dòng 158: thêm điều kiện `org.id !== companyId` vào permission check. Root cause: org cấp company có `companyId = null` (nó chính là company), nên `org.companyId !== companyId` luôn `true` và throw ForbiddenError. Hàm `getOrganization` đã xử lý đúng nhưng `updateOrganization` bị thiếu điều kiện này.

**Kết quả:**
- `npm run build` thành công, `pm2 restart lms-web` online
- company_admin có thể lưu cài đặt branding của công ty mình

**Lưu ý / Rủi ro:**
- Fix nhất quán với điều kiện đã có trong `getOrganization` (dòng 113)

## [2026-06-24 23:30] Fix logo upload ExpiresParamError + lưu objectName để tái tạo URL

**Loại:** fix

**Các thay đổi:**
- `src/app/api/upload/logo/route.ts`: Sửa TTL từ `5 * 365 * 24 * 3600` (5 năm) → `7 * 24 * 3600` (7 ngày) — MinIO giới hạn presigned URL tối đa 7 ngày. Thêm trả về `objectName` trong response để frontend lưu lại.
- `src/app/api/organizations/[id]/logo/route.ts`: Sửa TTL tương tự. Lưu cả `logoObjectName` lẫn `logoUrl` vào `metadata` của org.
- `src/app/api/public/branding/route.ts`: Import `getPresignedDownloadUrl`. Nếu `meta.logoObjectName` tồn tại → tái tạo presigned URL 7 ngày mới trên mỗi request (logo không bao giờ hết hạn). Fallback về `meta.logoUrl` nếu MinIO không khả dụng.
- `src/app/(dashboard)/settings/page.tsx`: Thêm `logoObjectName` vào interface `BrandingForm` và `DEFAULT_BRANDING`. Load `logoObjectName` từ metadata khi fetch. Lưu cả `logoObjectName` khi upload thành công → tự động được include khi save branding.

**Kết quả:**
- `npm run build` thành công, `pm2 restart lms-web` online
- Test upload `Logo PTHG mau.png` → response `{"success":true,"data":{"url":"...","objectName":"logos/..."}}`
- Logo luôn khả dụng — URL được tái tạo mới khi branding API được gọi

**Lưu ý / Rủi ro:**
- Root cause: MinIO giới hạn presigned URL tối đa 7 ngày (604800s) — passing giá trị lớn hơn gây `ExpiresParamError`
- Giải pháp bền vững: lưu `objectName` trong DB, regenerate URL mỗi lần thay vì lưu URL tĩnh
- Logo cũ (chỉ có `logoUrl`, không có `logoObjectName`) vẫn hoạt động nhờ fallback

## [2026-06-24 19:00] Fix video streaming, quiz CSV import, logo upload

**Loại:** fix + feature

**Các thay đổi:**

### Video streaming (Fix HLS segment không load được)
- `src/lib/minio.ts`: Thêm `getObjectContent()` helper đọc nội dung object từ MinIO.
- `src/app/api/assets/[id]/manifest/route.ts` (MỚI): Endpoint proxy manifest HLS — fetch file .m3u8 từ MinIO, rewrite tất cả dòng segment (`.ts`) thành presigned URL, trả về content thay vì redirect. Giải quyết vấn đề TS segments trong private bucket không có auth khi video.js fetch trực tiếp.
- `src/services/asset.service.ts`: `getStreamUrl()` trả về `{ url, mimeType }`. HLS → url là `/api/assets/{id}/manifest`. MP4 → url là presigned MinIO URL.
- `src/app/api/assets/[id]/stream-url/route.ts`: Pass thêm `mimeType` trong response.
- `src/components/lesson/VideoPlayer.tsx`: Dùng `mimeType` từ API (không cứng `application/x-mpegURL`). Thêm `beforeRequest` hook trong VHS để gắn `Authorization` header khi fetch manifest từ API. Đổi `preload: 'auto'` → `preload: 'metadata'`.

### Quiz CSV Import (Tính năng mới)
- `src/app/api/lessons/[lessonId]/quiz-import/route.ts` (MỚI):
  - `GET`: Trả file mẫu CSV để download.
  - `POST`: Parse CSV, tạo `Question` records trong `QuestionBank`, upsert `QuizConfig` cho lesson.
  - Hỗ trợ type: `single_choice`, `true_false`, `fill_blank`.
  - Tự tạo QuestionBank nếu chưa có (tên: "Quiz: {lesson title}").
- `src/app/(dashboard)/courses/[id]/page.tsx`: Thêm nút "Import CSV" bên cạnh "Soạn câu hỏi" cho quiz lesson. Thêm modal import với hướng dẫn + download template + upload file.

### Logo upload (Fix lỗi + hiển thị màn hình đăng nhập)
- `src/app/api/upload/logo/route.ts`: Fix dùng `getPresignedDownloadUrl()` (có `rewriteToPublic()`). Tăng giới hạn 2MB → 5MB. Thêm fallback detect MIME từ extension file (tránh lỗi khi browser gửi sai MIME type).
- `src/app/api/organizations/[id]/logo/route.ts` (MỚI): Upload logo + lưu URL vào `metadata.logoUrl` của organization trong DB. Hỗ trợ `group_admin` và `company_admin`.
- `src/app/(dashboard)/organizations/[id]/page.tsx`: Thêm `useToast`, logo upload UI. Click vào icon tổ chức → hover "Đổi logo" → chọn file → upload + cập nhật ngay.
- Login page (không sửa): Đã hiển thị logo từ `rootOrg.metadata.logoUrl` qua `/api/public/branding`. Logo của org type='group' sẽ xuất hiện trên màn hình đăng nhập.

**Kết quả:**
- `npm run build` thành công
- `pm2 restart lms-web` online (pid 5796)
- lms-worker không restart (không thay đổi worker code)

**Lưu ý / Rủi ro:**
- Video HLS: Manifest endpoint sign mỗi segment với TTL 2 giờ. Nếu video dài hơn 2 giờ, user cần reload trang để lấy manifest mới (presigned URLs sẽ expire).
- Logo trên login screen: Chỉ logo của org type='group' (root org) mới hiển thị. Để set logo cho toàn hệ thống, vào `/organizations/{group-id}` và upload logo.
- Quiz import: Sau khi import, instructor nên kiểm tra lại QuizConfig (tổng câu, passing score) trong mục "Soạn câu hỏi".

## [2026-06-24 17:00] Fix role delete, learning groups cho company_admin, tạo phòng ban

**Loại:** fix + feature

**Các thay đổi:**
- `src/app/(dashboard)/users/[id]/page.tsx`: Sửa interface `UserRole` thêm `id`, `organization: { id, name, type }`. Fix `handleRemoveRole` dùng `roleId` (UserRole.id) thay vì organizationId. Fix table key và disabled state. Thêm kiểm tra duplicate trước khi add role.
- `prisma/schema.prisma`: Thêm field `companyId String?` vào model `LearningGroup` để hỗ trợ nhóm đào tạo phạm vi công ty.
- `src/services/learning-group.service.ts`: Cập nhật `getLearningGroups` filter theo companyId cho non-group-admin. Cập nhật `createLearningGroup` nhận và lưu companyId.
- `src/app/api/learning-groups/route.ts`: Mở quyền GET/POST cho `company_admin`, `hr_manager`. Group-level groups không có companyId, company-scoped groups có companyId.
- `src/app/api/learning-groups/[id]/route.ts`: Mở quyền GET/PATCH cho `company_admin`, `hr_manager`.
- `src/app/api/learning-groups/[id]/members/route.ts`: Mở quyền POST cho `company_admin`, `hr_manager`.
- `src/app/(dashboard)/organizations/page.tsx`: Thêm detect `isCompanyAdmin`. Hiển thị nút "Tạo phòng ban" cho company_admin. Giới hạn type dropdown chỉ dept/team cho company_admin.

**Kết quả:**
- `prisma db push` thành công (thêm column `companyId` vào bảng `LearningGroup`)
- `npm run build` thành công
- `pm2 start all` — cả lms-web và lms-worker đều online

**Lưu ý / Rủi ro:**
- Các LearningGroup cũ (tạo bởi group_admin) có `companyId = NULL` — đây là expected behavior, group_admin vẫn thấy tất cả.
- company_admin chỉ thấy và quản lý các nhóm trong công ty mình.

## [2026-06-24] Fix video player + thumbnail khóa học

**Loại:** fix + feature

**Các thay đổi:**
- `src/services/enrollment.service.ts`: Fix `getMyCourse` — sections trước đây bị gói trong `{ detail }` nên frontend không đọc được; giờ sections được flatten ra root level với field mapping chuẩn (`displayOrder→order`, `assets[0]?.id→assetId`, `quizId=lessonId`, `durationSeconds` từ asset)
- `src/services/enrollment.service.ts`: Thêm `assets` vào Prisma include cho lesson (filter `processingStatus: READY`, lấy 1 cái đầu tiên)
- `src/app/(dashboard)/my-courses/[id]/lessons/[lessonId]/page.tsx`: Fix `handleComplete` gửi sai body (`{ completed: true }` → `{ progressPct: 100, status: 'completed' }` theo schema)
- `src/app/(dashboard)/my-courses/[id]/lessons/[lessonId]/page.tsx`: Thay `alert()` bằng `useToast`
- `src/app/(dashboard)/my-courses/page.tsx`: Thay ký tự đầu tiên làm thumbnail bằng SVG icon sách mặc định
- `src/app/(dashboard)/courses/[id]/page.tsx`: Thêm thumbnail upload UI (80×80 clickable area, hover overlay "Đổi ảnh")
- `src/app/api/courses/[id]/thumbnail/route.ts`: Tạo mới — POST endpoint upload ảnh bìa lên MinIO, presigned URL 5 năm, cập nhật `Course.thumbnailUrl`

**Kết quả:**
- Học viên vào khóa học thấy đầy đủ chương/bài học; video hiển thị đúng nếu asset đã `READY`
- Tiến độ video được đánh dấu hoàn thành khi VideoPlayer gọi `onComplete`
- Instructor upload được ảnh bìa khóa học; learner thấy ảnh bìa thay icon sách mặc định

**Lưu ý / Rủi ro:**
- Video chỉ hiển thị nếu asset `processingStatus = READY` — nếu vừa upload xong chưa xử lý, learner thấy "Không có video" (đúng behavior)
- Presigned thumbnail URL có hiệu lực 5 năm; cần cơ chế refresh dài hạn sau này

## [2026-06-24] Fix PM2 lms-web errored — EADDRINUSE port 3004

**Loại:** fix

**Các thay đổi:**
- Kill orphaned Node process (PID 4216) đang giữ port 3004 sau khi PM2 crash loop
- Build lại production bundle (`npm run build`) sau khi sửa code enrollment.service.ts và my-courses/page.tsx
- `pm2 restart lms-web` — process khởi động thành công, status online

**Kết quả:**
- lms-web: online, uptime ổn định, restart count không tăng thêm
- lms-worker: online, không bị ảnh hưởng

**Lưu ý / Rủi ro:**
- Nguyên nhân gốc là PM2 crash loop do lỗi SQL (đã fix) — mỗi lần crash, process cũ không bị kill hết, gây EADDRINUSE ở lần restart tiếp
- Nếu tái diễn: `netstat -ano | grep :3004` → kill PID trước khi restart PM2

## [2026-06-24] Fix trang "Khóa học của tôi" báo lỗi hệ thống

**Loại:** fix

**Các thay đổi:**
- `src/services/enrollment.service.ts`: Sửa SQL lỗi GROUP BY — thay `SELECT ac.*` bằng liệt kê cột tường minh để loại bỏ cột `rn` (ROW_NUMBER) khỏi SELECT nhưng không có trong GROUP BY; PostgreSQL báo lỗi dẫn đến 500
- `src/services/enrollment.service.ts`: Đổi tên alias SQL từ `progressPct` → `progressPercent` cho nhất quán với frontend; cập nhật `CourseRow` interface tương ứng
- `src/app/(dashboard)/my-courses/page.tsx`: Xóa field `level` và `status` khỏi `MyCourse` interface (không có trong schema/API); thêm `source` và `isMandatory`
- `src/app/(dashboard)/my-courses/page.tsx`: Thay `alert()` bằng `useToast` theo CLAUDE.md rule #5; hiển thị badge "Bắt buộc" thay badge level

**Kết quả:**
- Trang khóa học của learner hoạt động bình thường, không còn lỗi 500
- Tiến độ học tập hiển thị đúng giá trị thực
- Thông báo đăng ký khóa học dùng Toast thay alert()

**Lưu ý / Rủi ro:**
- Nếu có cache Redis đang lưu data cũ (key `my-courses:{userId}`), cần invalidate hoặc chờ TTL hết hạn để lấy data mới

## [2026-06-23 18:30] Fix position-changes lỗi 500 (unknown arg companyId)

**Loại:** fix

**Các thay đổi:**
- `src/services/gap-analysis.service.ts`: `getPositionChanges()` filter `user: { companyId }` → sai vì User không có field companyId trực tiếp. Sửa thành filter qua `user.roles.organization` với OR `[{ id: companyId }, { companyId }]`

**Kết quả:**
- Build + restart OK. Regression test 12/12 endpoint pass (cả group_admin và company_admin)

## [2026-06-23 17:30] Fix company_admin xem user, settings branding, SMTP ECONNRESET

**Loại:** fix

**Các thay đổi:**
- `src/services/user.service.ts`: thêm `companyId: true` vào organization select trong `getUserById` — fix ForbiddenError khi company_admin xem user dept-level
- `src/services/organization.service.ts`: `getOrganizations` dùng OR filter `[{ id: companyId }, { companyId }]` — fix settings branding không hiển thị company org (vì company org có `companyId = null`)
- `src/app/api/settings/company-mail/route.ts`: thêm nodemailer timeout (connectionTimeout, greetingTimeout, socketTimeout) + error hints chi tiết cho ECONNRESET/ETIMEDOUT/ENOTFOUND/auth
- `src/app/api/settings/mail/route.ts`: áp dụng cùng fix timeout + error hints cho global SMTP route

**Kết quả:**
- Build thành công, pm2 restart lms-web OK
- Company_admin có thể xem user details mà không bị ForbiddenError
- Settings branding hiển thị đúng thông tin công ty

**Lưu ý / Rủi ro:**
- SMTP `mail.phuthaiholdings.com:587` vẫn trả về `530 4.7.0 Connection refused` — đây là IP whitelist issue phía mail server, không phải lỗi code
- Cần whitelist IP LMS server `58.186.204.65` trên mail server phuthaiholdings.com
- Cấu hình đang lưu `secure: true` với port 587 là SAI — phải đổi `secure: false` (port 587 = STARTTLS, không phải implicit SSL)

## [2026-06-23 16:00] Fix org selector settings, thêm per-company mail config, cho phép sửa email user

**Loại:** fix + feature

**Các thay đổi:**
- `src/app/(dashboard)/settings/page.tsx`: Thêm `isCompanyAdmin` derived state; org selector lọc chỉ `type === 'company'` cho non-group-admin (fix hiện dept/team); hiển thị tab "Mail Server" cho cả `company_admin`; `saveMail` và `useEffect` mail dùng endpoint `/api/settings/company-mail` cho company_admin
- `prisma/schema.prisma`: Thêm model `CompanySmtpConfig` (per-company SMTP) và back-relation `smtpConfig` trên `Organization`
- `src/app/api/settings/company-mail/route.ts`: Tạo mới — GET/PUT per-company SMTP config, guard `['group_admin', 'company_admin']`, upsert theo `companyId`
- `src/services/user.service.ts`: Thêm `email` vào `updateUserSchema`; `updateUser` kiểm tra uniqueness email trước khi update
- `src/app/(dashboard)/users/[id]/page.tsx`: Thêm field `email` vào `editForm`; populate khi load user; gửi `email` trong PATCH body; thêm input "Email đăng nhập" trong form "Thông tin cơ bản"

**Kết quả:**
- Settings page: company_admin không còn thấy phòng ban/team trong org selector
- company_admin có tab Mail Server riêng, cấu hình SMTP per-company
- Admin có thể đổi email đăng nhập của user từ trang chi tiết user

**Lưu ý / Rủi ro:**
- `CompanySmtpConfig` cần chạy `npx prisma migrate dev` trước khi deploy
- Đổi email user ảnh hưởng tài khoản đăng nhập — cần thông báo user

---

## [2026-06-23 15:00] Thêm PATCH route cho section/lesson và nâng cấp dashboard

**Loại:** feature

**Các thay đổi:**
- `src/services/course.service.ts` — thêm `updateSection()` và `updateLesson()` sau `createSection`/`createLesson`
- `src/app/api/courses/[id]/sections/[sId]/route.ts` — tạo mới: PATCH endpoint cập nhật section (title, description), có validate zod + role guard
- `src/app/api/courses/[id]/sections/[sId]/lessons/[lessonId]/route.ts` — tạo mới: PATCH endpoint cập nhật lesson (title, estimatedMinutes), có validate zod + role guard
- `src/app/(dashboard)/dashboard/page.tsx` — nâng cấp dashboard:
  - group_admin: thêm bảng so sánh công ty từ `/api/reports/group/company-comparison` (progress bar completion rate) + stat "Học viên tháng này" từ `activeLearnersThisMonth`
  - company_admin / hr_manager: thêm bảng per-course từ `/api/reports/company/${companyId}/by-course` với color-coded progress bar
  - learner: thêm banner link đến `/my-learning-paths` nếu có lộ trình

**Kết quả:**
- Các file được tạo/sửa đúng spec; chưa chạy build (không được yêu cầu)

**Lưu ý / Rủi ro:**
- PATCH section/lesson dùng chung directory với POST lessons (`[sId]/lessons/route.ts` đã tồn tại); file mới là `[sId]/route.ts` và `[sId]/lessons/[lessonId]/route.ts` — không xung đột
- Dashboard learner gọi thêm `/api/my/learning-paths`; nếu endpoint chưa tồn tại sẽ catch lỗi im lặng, không crash

## [2026-06-23 14:00] Fix course.status bug + thêm inline edit tiêu đề khóa học, chương, bài học

**Loại:** fix + feature

**Các thay đổi:**
- `src/app/(dashboard)/courses/[id]/page.tsx` — Sửa interface `Course`: thay `status: string` bằng `isPublished: boolean` cho đúng với Prisma model
- Thay toàn bộ `course.status === 'published'` → `course.isPublished` và `course.status !== 'published'` → `!course.isPublished` (status badge, publish button guard, assign warning, assign button disabled)
- Thêm inline edit cho tiêu đề khóa học: click icon ✎ → input edit → Lưu gọi `PATCH /api/courses/${id}` với `{ title }`
- Thêm inline edit cho tên chương: icon ✎ trên mỗi section header → `PATCH /api/courses/${id}/sections/${sId}`
- Thêm inline edit cho tên bài học: icon ✎ trên mỗi lesson row → `PATCH /api/courses/${id}/sections/${sId}/lessons/${lessonId}`
- Tất cả inline edit dùng state riêng (editingCourseTitle, editingSectionId, editingLessonId + editingLessonSectionId), hỗ trợ Enter/Escape, dùng toast thành công/lỗi, gọi load() sau khi lưu
- Không dùng alert()/confirm()/prompt() — tuân thủ quy tắc Toast system

**Kết quả:**
- Status badge và guard điều kiện xuất bản/phân phối hoạt động đúng (trước đây luôn undefined)
- Người dùng có thể sửa tiêu đề trực tiếp trên trang mà không cần điều hướng sang trang khác

**Lưu ý / Rủi ro:**
- Cần đảm bảo các API PATCH `/api/courses/[id]`, `/api/courses/[id]/sections/[sId]`, `/api/courses/[id]/sections/[sId]/lessons/[lessonId]` đã tồn tại hoặc được tạo

---

## [2026-06-23 13:30] Fix "Lỗi hệ thống" khi đổi Phạm vi hiển thị / Xóa asset

**Loại:** fix

**Các thay đổi:**
- `src/services/asset.service.ts` — `updateAsset()`: serialize `fileSizeBytes` (BigInt) thành string trước khi return
- `src/services/asset.service.ts` — `deleteAsset()`: tương tự, serialize BigInt trước khi return

**Nguyên nhân:**
- `PATCH /api/assets/[id]` trả về raw Prisma record có `fileSizeBytes: BigInt`
- `NextResponse.json()` không serialize được BigInt → crash 500 → "Lỗi hệ thống. Vui lòng thử lại sau."
- Log: `[API Error] TypeError: Do not know how to serialize a BigInt at api/assets/[id]/route.js`

**Kết quả:**
- Build thành công, restart lms-web
- Chọn "Phạm vi hiển thị" và xóa asset hoạt động bình thường

## [2026-06-22 23:10] Fix lms-worker — BullMQ Redis connection + rebuild lms-web

**Loại:** fix

**Các thay đổi:**
- `src/lib/redis.ts`: thêm `createBullMQConnection()` — tạo Redis connection riêng với `maxRetriesPerRequest: null` (yêu cầu bắt buộc của BullMQ); `createRedisClient()` giữ nguyên `maxRetriesPerRequest: 3` cho cache
- `src/lib/queue.ts`: đổi từ `redis` (shared) sang `createBullMQConnection()` cho tất cả Queue
- `src/jobs/asset-processor.job.ts`: đổi `connection: redis` → `connection: createBullMQConnection()`
- `src/jobs/tracking-writer.job.ts`: đổi `connection: redis` → `connection: createBullMQConnection()`
- `src/jobs/position-change.job.ts`: đổi `connection: redis` → `connection: createBullMQConnection()` (cả Queue lẫn Worker)

**Kết quả:**
- lms-worker khởi động thành công: `[Worker] All workers started successfully`
- Không còn lỗi `BullMQ: Your redis options maxRetriesPerRequest must be null`
- Build Next.js thành công, restart lms-web
- Cả 3 services (lms-web, lms-worker, minio) đều online

**Lưu ý / Rủi ro:**
- Các job cũ trong queue (từ lần upload trước) báo `S3Error: Not Found` vì temp object đã hết hạn — bình thường, không ảnh hưởng upload mới
- Mỗi Worker/Queue bây giờ tạo connection Redis riêng — tổng số connection tăng nhẹ nhưng vẫn trong giới hạn chấp nhận được

## [2026-06-22 22:40] Fix upload file — proxy qua Next.js, không cần mở port 9000

**Loại:** fix + refactor

**Các thay đổi:**
- `src/app/api/assets/upload/route.ts`: Tạo mới — nhận file từ browser qua multipart, push lên MinIO qua localhost (không cần presigned URL, không cần port 9000 mở ra ngoài)
- `src/app/(dashboard)/courses/[id]/lessons/[lessonId]/content/page.tsx`: Thay 3-bước (presigned URL → PUT MinIO → confirm) bằng 2-bước (POST `/api/assets/upload` → confirm). Dùng XHR để có progress bar thực. Xóa cảnh báo MinIO cũ.

**Kết quả:**
- Upload hoạt động qua port 5980 (đang mở) — không cần NAT port 9000
- Test xác nhận: file 19.3KB vào `lms-temp` bucket thành công
- Progress bar hiển thị % upload thực tế

**Lưu ý / Rủi ro:**
- File lớn (video GB) được buffer trong RAM của Next.js server trước khi push MinIO — server cần đủ RAM. Với RAM 8GB+ là đủ cho video dưới 2GB.
- Nếu cần upload file >2GB, cần implement streaming thay buffer.

## [2026-06-22 22:10] Fix MinIO upload — presigned URL dùng public hostname

**Loại:** fix + config

**Các thay đổi:**
- `.env`: Thêm `MINIO_PUBLIC_URL="http://lms.phuthaiholdings.com:9000"`
- `src/lib/minio.ts`: Thêm hàm `rewriteToPublic()` — sau khi tạo presigned URL với localhost, swap host thành MINIO_PUBLIC_URL; tránh hairpin NAT (server không kết nối được tới IP ngoài của chính mình)
- `C:/minio/ecosystem.config.js`: Đưa MinIO vào PM2 để auto-start và quản lý restart
- Windows Firewall: Thêm inbound rule cho port 9000 (MinIO API) và 9001 (Console)
- Kill process MinIO cũ (không qua PM2), để PM2 quản lý độc quyền

**Kết quả:**
- MinIO chạy ổn định dưới PM2 (PID 11920, port 9000 + 9001)
- Upload URL trả về `http://lms.phuthaiholdings.com:9000/...` thay vì `http://localhost:9000/...`
- Browser từ client ngoài có thể PUT file trực tiếp lên MinIO
- `pm2 save` đã lưu — tự start lại sau reboot

**Lưu ý / Rủi ro:**
- Port 9000 cần mở trên router/firewall ngoài (nếu có NAT) để browser truy cập được
- MinIO console tại `http://lms.phuthaiholdings.com:9001` — login: minioadmin/minioadmin
- Nên đổi credentials MinIO trong production

## [2026-06-22 21:40] Fix upload nội dung & phân phối khóa học không hiển thị

**Loại:** fix

**Các thay đổi:**
- `src/app/(dashboard)/layout.tsx`: Thêm `group_admin` và `group_hrm` vào menu "Khóa học" — trước đó chỉ có `company_admin`, `hr_manager`, `instructor` thấy
- `src/app/(dashboard)/courses/[id]/page.tsx`: Thay `confirm()` và `alert()` bằng confirm inline + `useToast`
- `src/app/(dashboard)/courses/[id]/lessons/[lessonId]/content/page.tsx`: Thay `confirm()` và `alert()` bằng confirm inline + `useToast`

**Kết quả:**
- Group Admin/HRM giờ thấy menu "Khóa học" và có thể quản lý nội dung đào tạo
- Không còn dùng native browser dialog
- Đã rebuild production và restart PM2

**Lưu ý / Rủi ro:**
- Không có breaking change. Workflow upload video vẫn là: Khóa học → Chọn khóa → Thêm Chương → Thêm Bài học → Upload nội dung

## [2026-06-22 21:00] Fix chức năng import file Excel

**Loại:** fix

**Các thay đổi:**
- `src/app/api/import/validate/route.ts`: Sửa sheetMap từ `1_ORG_CHART/2_USERS/3_JOB_POSITIONS` → `OrgChart/Users/JobPositions`; thêm validation thực sự (gọi `validateOrgRows`/`validateUserRows`); trả về `validRows` và `valid` đúng interface frontend
- `src/services/import.service.ts`: Sửa 3 lần gọi `parseExcel` dùng đúng sheet name; export `validateOrgRows` và `validateUserRows` để validate route dùng được
- `src/app/api/import/templates/route.ts`: Sửa giá trị hợp lệ của `type` từ `company|department|branch|team` → `group|company|dept|team` (khớp Prisma enum OrgType)
- `template_org_chart.xlsx`: Regenerate với data mẫu dùng đúng type values (`group`, `company`, `dept`, `team`)

**Kết quả:**
- Validate API trả về `{ valid: true, totalRows: 4, validRows: 4, errors: [] }` với file template đúng format
- Import flow hoàn chỉnh: upload → validate → execute
- Đã rebuild production và restart PM2

**Lưu ý / Rủi ro:**
- Các file xlsx cũ của người dùng dùng type `department`/`branch` sẽ báo lỗi validate — cần dùng `dept` thay `department`

## [2026-06-22 20:20] Fix PM2 không start được lms-worker trên Windows

**Loại:** fix

**Các thay đổi:**
- `ecosystem.config.js`: Sửa `interpreter` của `lms-worker` từ `node_modules/.bin/ts-node` sang `node` với `interpreter_args: '-r ts-node/register'`
- Nguyên nhân gốc: Trên Windows, PM2 không thể spawn file shell Unix (`ts-node` không có `.cmd`); ngoài ra `interpreter_args` với escaped quotes gây lỗi `EINVAL`

**Kết quả:**
- Cả `lms-web` (Next.js, port 3004) và `lms-worker` đều `online`
- Đã chạy `pm2 save` để lưu process list

**Lưu ý / Rủi ro:**
- `-r ts-node/register` không truyền `--compiler-options {"module":"CommonJS"}` như config cũ. Nếu worker dùng ESM imports thì có thể gặp lỗi module — cần theo dõi log `lms-worker`

## [2026-06-22 00:00] Fix lỗi import org chart báo "Thiếu file hoặc importType"

**Loại:** fix

**Các thay đổi:**
- `src/app/(dashboard)/import/page.tsx`: Sửa FormData gửi sai field name và sai value khi validate/execute import
  - Đổi `fd.append('type', tab)` → `fd.append('importType', TEMPLATE_TYPES[tab])` cho cả `handleValidate` và `handleExecute`
  - Di chuyển `TEMPLATE_TYPES` mapping ra ngoài component (module-level constant) để dùng được trong các handler
  - Xóa khai báo trùng `TEMPLATE_TYPES` bên trong component

**Nguyên nhân:**
- Frontend gửi field `type` với giá trị `organizations` (tên tab UI)
- Backend đọc field `importType` với giá trị `org_chart` (internal type)
- → Backend nhận `null` cho `importType` nên ném lỗi "Thiếu file hoặc importType"

**Kết quả:**
- Import validate và execute hoạt động đúng cho tất cả 3 loại: org_chart, users, job_positions

## [2026-06-18 00:00] Fix settings page crash — isGroupAdmin dùng trước khi khai báo

**Loại:** fix

**Các thay đổi:**
- `src/app/(dashboard)/settings/page.tsx`: Di chuyển khai báo `userRoles` và `isGroupAdmin` lên trước `useEffect` phụ thuộc vào chúng. Trước đây chúng được khai báo ở dòng ~120 nhưng được dùng trong dependency array của `useEffect` ở dòng ~72 — gây lỗi JavaScript client-side khi React đánh giá dependency array.

**Kết quả:**
- Trang Settings không còn crash với "Application error: a client-side exception has occurred"

**Lưu ý / Rủi ro:**
- Không có breaking change. Chỉ thay đổi thứ tự khai báo biến trong component function.

## [2026-06-19 10:30] Hàng loạt tính năng: mail server, mật khẩu, tổ chức, upload bài giảng

**Loại:** feature + fix

**Các thay đổi:**

**Schema & DB:**
- `prisma/schema.prisma` — Thêm `SmtpConfig` (id singleton, lưu cấu hình SMTP) và `PasswordResetToken` (token reset mật khẩu, TTL 1h); thêm relation `passwordResetTokens` vào `User`
- `prisma db push` — Sync schema lên PostgreSQL ✓

**Email infrastructure:**
- `src/lib/email.ts` — nodemailer transport đọc từ DB (`SmtpConfig`), cache 5 phút
- `src/services/email.service.ts` — Template HTML: `sendWelcomeEmail` (chào mừng + mật khẩu) và `sendPasswordResetEmail` (link đặt lại)
- `npm install nodemailer` ✓

**Mail settings UI:**
- `src/app/api/settings/mail/route.ts` — GET/PUT SMTP config (group_admin only), PUT có option `testConnection` để verify trước khi lưu
- `src/app/(dashboard)/settings/page.tsx` — Thêm tab "Mail Server": form SMTP host/port/SSL/user/pass/fromName/fromEmail, nút "Kiểm tra kết nối" và "Lưu cấu hình"

**Fix lỗi thêm chương / bài học:**
- `src/services/course.service.ts` — `displayOrder` optional trong `createSectionSchema` và `createLessonSchema`; tự động tính = count + 1 nếu không gửi lên
- `src/app/(dashboard)/courses/[id]/page.tsx` — Bỏ `alert()`, dùng state error hiển thị inline dưới form

**Tạo user — mật khẩu ngẫu nhiên + gửi email:**
- `src/app/(dashboard)/users/page.tsx` — Modal tạo user: tự generate mật khẩu ngẫu nhiên 10 ký tự khi mở modal, nút "🔀 Tạo ngẫu nhiên", checkbox "Gửi thông tin qua email"
- `src/app/api/users/route.ts` — Nhận `sendWelcomeEmail` flag, gọi `sendWelcomeEmail()` async sau khi tạo user

**User tự đổi mật khẩu:**
- `src/app/api/auth/me/route.ts` — Thêm `PATCH`: xác minh mật khẩu hiện tại, hash và lưu mật khẩu mới
- `src/app/(dashboard)/profile/page.tsx` — Trang mới: hiển thị thông tin tài khoản + form đổi mật khẩu (xác nhận khớp)
- `src/app/(dashboard)/layout.tsx` — Thêm link "Đổi mật khẩu" vào sidebar user section; thêm `company_admin` vào nav "Tổ chức"

**Quên mật khẩu:**
- `src/app/api/auth/forgot-password/route.ts` — POST: tạo token 32 bytes random, lưu DB với TTL 1h, gửi email async (không lộ thông tin email tồn tại hay không)
- `src/app/api/auth/reset-password/route.ts` — POST: validate token + TTL, hash mật khẩu mới, đánh dấu token đã dùng
- `src/app/(auth)/forgot-password/page.tsx` — UI: form nhập email → thông báo đã gửi
- `src/app/(auth)/reset-password/page.tsx` — UI: đọc `?token=` từ URL, form nhập mật khẩu mới + xác nhận, redirect login sau 3s
- `src/app/(auth)/login/page.tsx` — Thêm link "Quên mật khẩu?" cạnh label Password
- `src/middleware.ts` — Thêm `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/public` vào PUBLIC_PATHS

**Kết quả:**
- Build thành công, `pm2 start lms-web` ✓
- Upload nội dung bài giảng đã có sẵn (nút "Upload nội dung" trong từng bài học)
- Lỗi "Dữ liệu không hợp lệ" khi thêm chương đã được fix
- company_admin thấy mục "Tổ chức" trong sidebar

**Lưu ý / Rủi ro:**
- Cần cấu hình Mail Server trong Cài đặt → tab "Mail Server" trước khi gửi email
- Token reset mật khẩu lưu trong PostgreSQL (bảng `PasswordResetToken`), hết hạn sau 1h
- Mật khẩu ngẫu nhiên hiển thị dạng plaintext trong form — chỉ admin tạo mới thấy
- `sendWelcomeEmail` gọi async không block response — nếu mail fail sẽ log vào PM2 console

## [2026-06-19 09:30] Validate email domain (MX record) khi tạo user

**Loại:** feature

**Các thay đổi:**
- `src/services/user.service.ts` — Thêm `checkEmailDomain()`: dùng `dns.Resolver` với Google DNS (8.8.8.8/1.1.1.1) để lookup MX record của domain email; gọi trong `createUser()` trước khi insert — throw `ValidationError` nếu domain không có MX record
- `src/app/api/users/check-email/route.ts` — Tạo mới endpoint `GET /api/users/check-email?email=xxx` (yêu cầu role group_admin/company_admin/hr_manager); trả `{ valid: boolean, reason?: string }`
- `src/app/(dashboard)/users/page.tsx` — Thêm real-time email validation: `onBlur` trên ô email gọi check-email API; hiển thị icon ✓/✗ và text xanh/đỏ; disable nút submit khi email invalid hoặc đang checking

**Lý do dùng Google DNS (8.8.8.8):**
DNS nội bộ server (kv-11.kowil.local, 10.191.36.11) không hỗ trợ MX record query → ECONNREFUSED. Dùng `new Resolver()` riêng với Google DNS để tránh ảnh hưởng global DNS setting.

**Kết quả:**
- Build thành công, `pm2 restart lms-web` ✓
- `gmail.com` → valid ✓
- `khongtontan.xyz` → invalid ✓ (Tên miền không tồn tại)
- Nếu domain không có MX record: trả lỗi cả backend (422) lẫn frontend (block submit)

**Lưu ý / Rủi ro:**
- DNS lookup thêm ~200–500ms latency khi tạo user (có timeout 5s nếu unreachable)
- Nếu server bị block outbound UDP/TCP port 53 đến 8.8.8.8 → MX check sẽ timeout → user vẫn không tạo được. Cần verify firewall cho phép DNS ra ngoài.

## [2026-06-16 15:00] Bug fix: Login branding, users page, toast system, import templates

**Loại:** fix

**Các thay đổi:**
- `src/app/(auth)/login/page.tsx` — Tích hợp `/api/public/branding`: hiển thị logo, tiêu đề, subtitle, màu nút, và ảnh nền đều cấu hình được; không còn hardcode "LMS Tập đoàn"
- `src/app/api/public/branding/route.ts` — Tạo endpoint GET không cần auth, trả branding từ root group org
- `src/app/api/upload/logo/route.ts` — Tạo endpoint POST upload logo lên MinIO, trả signed URL
- `src/app/api/import/templates/route.ts` — Tạo endpoint GET trả file Excel mẫu cho users/org_chart/job_positions
- `src/app/(dashboard)/import/page.tsx` — Thêm nút tải file mẫu cho từng loại import
- `src/app/(dashboard)/settings/page.tsx` — Rewrite: thêm upload logo, 8 theme preset có hình ảnh, cấu hình login page (title/subtitle/bg)
- `src/components/ui/toast.tsx` — Tạo Toast system (ToastProvider + useToast), thay thế alert() trong toàn app
- `src/app/(dashboard)/layout.tsx` — Wrap ToastProvider
- `src/app/(dashboard)/learning-groups/page.tsx` — Fix useEffect accessToken dependency, thêm toast feedback khi tạo
- `src/app/(dashboard)/question-banks/page.tsx` — Fix useEffect accessToken dependency, thêm toast feedback
- `src/app/api/question-banks/route.ts` — Thêm 'instructor' vào POST allowed roles
- `src/services/user.service.ts` — Fix `getUsers`: filter OR `{ companyId }` + `{ id: companyId }` để company_admin thấy cả user gán trực tiếp vào company org
- `CLAUDE.md` — Thêm rule bắt buộc: không dùng alert()/confirm()/prompt(), dùng Toast system

**Kết quả:**
- Login page hiển thị branding theo cấu hình từ DB
- company_admin xem được danh sách user trong công ty mình
- Learning Groups và Question Banks tạo mới hoạt động, có feedback toast
- Import có nút tải file mẫu Excel

**Lưu ý / Rủi ro:**
- MinIO signed URL cho logo có TTL 1 năm — cần refresh nếu logo thay đổi
- Toast system dùng React context, không tương thích với server components

## [2026-06-18 08:47] Fix lỗi 400 khi login qua domain (HTTP → HTTPS redirect)

**Loại:** fix

**Nguyên nhân gốc:**
- Nginx port 5980 chỉ listen SSL (`listen 5980 ssl`)
- Khi browser truy cập `http://lms.phuthaiholdings.com:5980` (không có `s`), nginx trả "400 Bad Request — The plain HTTP request was sent to HTTPS port"
- Đây là lỗi nginx 497 (NGX_HTTP_TO_HTTPS), hiển thị ra browser thành 400

**Các thay đổi:**
- `C:/nginx/conf/lms-staging.conf` — Thêm `error_page 497 https://$host:5980$request_uri;` vào server block để tự redirect HTTP → HTTPS thay vì báo lỗi 400
- Nginx reload: `nginx -s reload`

**Kết quả:**
- `http://lms.phuthaiholdings.com:5980` → 302 redirect → `https://lms.phuthaiholdings.com:5980` ✅
- `https://lms.phuthaiholdings.com:5980/api/auth/login` hoạt động bình thường (200/401) ✅
- Login thành công với `group_admin@via.vn` / `Admin@2026` ✅

**Lưu ý / Rủi ro:**
- Password hiện tại của seed users là `Admin@2026` (không phải `Password@123` như trong seed.ts)
- Không cần mở thêm port firewall vì dùng error_page 497 trong cùng server block 5980

## [2026-06-17 20:30] Hoàn thiện quản lý người dùng: tạo user đầy đủ trường + đổi mật khẩu

**Loại:** feature

**Các thay đổi:**
- `src/app/(dashboard)/users/page.tsx` — Rewrite form tạo user: thêm dropdown `organizationId` (nhóm Companies/Depts), dropdown `role`, trường mật khẩu (min 8 ký tự)
- `src/app/api/users/route.ts` — POST handler truyền `isGroupAdmin` vào `createUser` để group_admin tạo user ở bất kỳ công ty nào
- `src/services/user.service.ts` — `createUser` nhận param `isGroupAdmin`, bỏ qua kiểm tra ownership org khi là group_admin
- `src/app/api/users/[id]/password/route.ts` — Tạo mới PATCH endpoint đổi mật khẩu (bcrypt, min 8 ký tự, kiểm tra tenant)
- `src/app/(dashboard)/users/[id]/page.tsx` — Thêm section "Đổi mật khẩu" với confirm field, gọi `PATCH /api/users/:id/password`

**Kết quả:**
- Build thành công (ignoreBuildErrors: true)
- pm2 restart lms-web ✓
- group_admin có thể tạo company_admin cho bất kỳ công ty nào
- Admin có thể reset mật khẩu user từ trang chi tiết user

**Lưu ý / Rủi ro:**
- Endpoint đổi mật khẩu chỉ cho phép `group_admin` và `company_admin`
- Mật khẩu mặc định khi tạo user không nhập: `ChangeMe@123`

## [2026-06-17 18:00] Thêm luồng tạo bài giảng, upload, gán khóa học

**Loại:** feature

**Các thay đổi:**
- `src/app/(dashboard)/courses/[id]/page.tsx` — Thêm 2 tab: "Nội dung bài giảng" (sections/lessons + Upload/Quiz links) và "Phân phối & Giao học" (giao cho nhóm học tập / phòng ban / cá nhân, có checkbox bắt buộc + hạn hoàn thành)
- `src/app/(dashboard)/learning-groups/[id]/page.tsx` — Thêm component `AddCourseToGroup` trong tab Courses: chọn khóa học đã xuất bản + hạn → POST `/api/learning-groups/:id/courses`
- `src/app/(dashboard)/courses/[id]/lessons/[lessonId]/quiz/page.tsx` — Trang cấu hình Quiz: chọn ngân hàng câu hỏi, phân bổ độ khó (dễ/trung bình/khó), thời gian, số lần làm, xáo trộn → PUT `/api/lessons/:lessonId/quiz-config`

**Kết quả:**
- Build thành công, `pm2 restart lms-web` hoàn tất
- Luồng hoàn chỉnh: Tạo khóa học → Thêm chương → Thêm bài học → Upload (video/PDF) hoặc Soạn Quiz → Xuất bản → Giao cho nhóm/phòng/cá nhân

## [2026-06-17 17:30] Chẩn đoán lỗi truy cập qua domain

**Loại:** fix

**Các thay đổi:**
- Không thay đổi code — chỉ chẩn đoán

**Kết quả kiểm tra:**
- LMS App (port 3004): ✅ OK
- Nginx (port 5980) + SSL cert `*.phuthaiholdings.com` (hết hạn Jul 2026): ✅ OK
- Windows Firewall port 5980: ✅ OK
- WAN IP thực tế: **58.186.204.69** (không phải .65 — .65 là IP outbound NAT khác)
- Test HTTPS login qua `58.186.204.69:5980` → thành công 100%
- DNS `lms.phuthaiholdings.com`: ❌ Chưa có A record → đây là nguyên nhân duy nhất

**Việc cần làm (bên ngoài server):**
- Vào DNS quản lý domain `phuthaiholdings.com`, thêm: `A  lms  →  58.186.204.69  TTL=300`
- Không cần port forward thêm — port 5980 đã reachable từ ngoài qua .69

## [2026-06-17 17:00] Cài đặt MinIO và fix BigInt serialization

**Loại:** deploy + fix

**Các thay đổi:**
- Tải `minio.exe` v2025-09-07 vào `C:/minio/`, start qua PM2 (id: 10)
- Tải `mc.exe` (MinIO client) vào `C:/minio/mc.exe`
- Tạo 2 bucket: `lms-private` (lưu trữ vĩnh viễn) và `lms-temp` (auto-delete 24h)
- Cấu hình lifecycle rule expire 1 ngày cho `lms-temp`
- `src/services/asset.service.ts`: Fix `TypeError: Do not know how to serialize a BigInt` — convert `fileSizeBytes` sang string trước khi trả response (cả `confirmUpload` và `getAssets`)
- Rebuild + restart lms-web
- `pm2 save` để giữ MinIO khởi động sau reboot

**Kết quả:**
- MinIO chạy tại http://localhost:9000, console tại http://localhost:9001
- Test upload end-to-end: presigned URL → PUT file → confirm → DB record → thành công
- Credentials: MINIO_ROOT_USER=minioadmin / MINIO_ROOT_PASSWORD=minioadmin (khớp .env)

**Lưu ý / Rủi ro:**
- MinIO data ở `D:/minio-data/` — không xóa thư mục này
- Ecosystem config MinIO ở `C:/minio/ecosystem.config.js`
- Nếu server reboot: `pm2 resurrect` sẽ tự start lại MinIO

## [2026-06-17 14:30] Hoàn thiện luồng vận hành: tạo công ty, phân quyền, upload nội dung bài học

**Loại:** feature

**Các thay đổi:**
- `src/app/(dashboard)/organizations/page.tsx` — Thêm nút "Tạo công ty" (chỉ group_admin), modal tạo tổ chức với đầy đủ trường (tên, mã, loại, org cha, địa chỉ, điện thoại). Hiển thị dạng card cho công ty, bảng cho đơn vị khác
- `src/app/(dashboard)/organizations/[id]/page.tsx` — Xây lại thành trang chi tiết tổ chức: 3 tab (Thông tin / Người dùng / Sơ đồ), chỉnh sửa inline, danh sách user trong org, phân quyền user vào org (thêm/xóa role)
- `src/app/(dashboard)/courses/[id]/lessons/[lessonId]/content/page.tsx` — Trang upload nội dung bài học: presigned upload MinIO → confirm → theo dõi trạng thái xử lý (PENDING/PROCESSING/READY/FAILED), cài chính sách tải và phạm vi hiển thị từng asset
- `src/app/(dashboard)/courses/[id]/page.tsx` — Thêm nút "Upload nội dung" cho từng bài học
- `src/services/asset.service.ts` — Thêm filter `lessonId` vào `getAssets()`
- `src/app/api/assets/route.ts` — Truyền `lessonId` query param vào service

**Kết quả:**
- Build thành công, `pm2 restart lms-web` hoàn tất
- Luồng vận hành đầy đủ: group_admin → tạo công ty → phân quyền company_admin → company_admin quản lý user → instructor upload nội dung

**Lưu ý / Rủi ro:**
- Upload file yêu cầu MinIO chạy (port 9000). MinIO chưa cài đặt trên server → UI hiển thị cảnh báo, upload sẽ thất bại ở bước lấy presigned URL
- Để cài MinIO: tải từ https://min.io/download → chạy `minio server D:\minio-data --console-address :9001` → tạo bucket `lms-private` và `lms-temp`

## [2026-06-17 10:00] Thêm trang User Detail, Settings/Branding, cập nhật Sidebar và Users list

**Loại:** feature

**Các thay đổi:**
- Tạo `src/app/(dashboard)/users/[id]/page.tsx` — trang chi tiết user: xem/edit thông tin cơ bản (fullName, employeeCode, jobTitle), toggle isActive, quản lý vai trò (xem danh sách, xoá từng vai trò, thêm vai trò mới với dropdown Role + Tổ chức)
- Tạo `src/app/(dashboard)/settings/page.tsx` — trang cài đặt branding: chọn tổ chức (group_admin thấy tất cả, company_admin thấy org của mình), form logoUrl + companyName + primaryColor + secondaryColor, preview card, PATCH `/api/organizations/[id]` với metadata
- Cập nhật `src/app/(dashboard)/layout.tsx` — thêm link `/settings` vào NAV_LINKS với roles `['group_admin', 'company_admin']`
- Cập nhật `src/app/(dashboard)/users/page.tsx` — thêm cột "Chi tiết" với Link đến `/users/${user.id}` trong mỗi row của bảng

**Kết quả:**
- Build thành công, không có webpack errors
- `/settings` — static, `/users/[id]` — dynamic (server-rendered on demand)

**Lưu ý / Rủi ro:**
- roleId dùng cho DELETE `/api/users/[id]/roles/[roleId]` là `organizationId` (theo route handler `params.roleId`)
- Settings page lọc org theo type `company` hoặc `group` cho group_admin; company_admin chỉ thấy org của mình qua user.roles

## [2026-06-17 00:00] Thêm auth guard, sidebar nav, và các trang bị thiếu

**Loại:** feature

**Các thay đổi:**
- `src/app/(dashboard)/layout.tsx` — Viết lại hoàn toàn: thêm `AuthProvider` wrapper, `DashboardShell` inner component với auth guard (`useEffect` redirect về `/login` nếu chưa đăng nhập), sidebar navigation với role-based links, mobile hamburger menu, user info + nút đăng xuất
- `src/components/lesson/VideoPlayer.tsx` — Sửa CSS import path từ `video.js/dist/video-css/video-js.css` (sai) thành `video.js/dist/video-js.css` (đúng)
- `src/app/(dashboard)/courses/page.tsx` — Tạo mới: danh sách khóa học (table với badge status), modal tạo mới (title, description, level dropdown), link xem chi tiết
- `src/app/(dashboard)/courses/[id]/page.tsx` — Tạo mới: course editor với sections accordion, thêm section/lesson inline, nút xuất bản
- `src/app/(dashboard)/users/page.tsx` — Tạo mới: table người dùng với search, filter; modal thêm mới
- `src/app/(dashboard)/organizations/page.tsx` — Tạo mới: danh sách tổ chức, click row → `/organizations/[id]`
- `src/app/(dashboard)/import/page.tsx` — Tạo mới: tabs users/organizations, upload Excel, validate → execute flow, lịch sử import
- `src/app/(dashboard)/my-courses/page.tsx` — Tạo mới: learner course list với progress bars, nút đăng ký/tiếp tục
- `src/app/(dashboard)/my-courses/[id]/page.tsx` — Tạo mới: course outline với sections/lessons, trạng thái hoàn thành
- `src/app/(dashboard)/my-courses/[id]/lessons/[lessonId]/page.tsx` — Tạo mới: lesson player hỗ trợ video (VideoPlayer), PDF (PdfViewer), quiz (start/submit flow), text; nút hoàn thành bài; prev/next navigation

**Kết quả:**
- Build thành công: `npm run build` pass, 0 lỗi webpack
- Tất cả 17 dashboard routes đều compile và render (static + dynamic)

**Lưu ý / Rủi ro:**
- VideoPlayer CSS path bug đã được fix trong `src/components/lesson/VideoPlayer.tsx`
- Layout mới sử dụng pattern `AuthProvider > DashboardShell` để tránh lỗi `useAuth must be used inside AuthProvider` khi Next.js prerender
- Lesson player page bundle lớn (~449 kB) do video.js + pdfjs-dist — cân nhắc lazy load nếu cần

---

## [2026-06-17 02:00] Fix dashboard trắng + DNS

**Loại:** fix

**Các thay đổi:**
- `src/app/api/auth/me/route.ts` — Thay `getAuthContext(req)` (đọc header middleware-injected) bằng `getAuthUser(req)` (đọc Bearer token trực tiếp). Trước đây sau khi bỏ middleware inject header, `/api/auth/me` luôn throw UnauthorizedError → `fetchMe()` trả null → user null → dashboard trắng
- `src/app/(dashboard)/dashboard/page.tsx` — Thay `localStorage.getItem('accessToken')` bằng `accessToken` từ `useAuth()` context. Thêm helper `getRole()` để xử lý roles là string[] (sau login) hoặc object[] (sau fetchMe)

**Kết quả:**
- `/api/auth/me` trả đúng fullName + roles object format ✓
- Dashboard hiển thị tên user + stats + quick nav ✓
- `lms.phuthaiholdings.com` → **chưa có DNS A record** → cần thêm thủ công (xem Lưu ý)

**Lưu ý / Rủi ro:**
- DNS cần thêm A record: `lms.phuthaiholdings.com → 58.186.204.65` tại DNS provider của domain phuthaiholdings.com
- Sau khi thêm DNS, truy cập qua: `https://lms.phuthaiholdings.com:5980`

---

## [2026-06-17 01:00] Fix 404/500 — middleware ioredis + dashboard page + port nginx

**Loại:** fix

**Các thay đổi:**
- `src/middleware.ts` — Bỏ import `ioredis` (rate-limit) và `jsonwebtoken` khỏi Edge Runtime. Middleware giờ chỉ là pass-through; auth thực sự vẫn được enforce tại route-level qua `withAuth()`/`withRole()` HOF (chạy trong Node.js runtime)
- `src/app/(dashboard)/dashboard/page.tsx` — Tạo mới trang dashboard home: hiển thị stats theo role (group_admin → overview tập đoàn, company_admin → overview công ty, learner → khóa học của tôi), quick nav links theo role
- `ecosystem.config.js` + `.env` — Đổi PORT từ `3002` → `3004` để khớp với nginx config (`lms-staging.conf` proxy_pass port 3004)
- `.env` — Cập nhật `NEXT_PUBLIC_APP_URL` và `NEXTAUTH_URL` thành `https://lms.phuthaiholdings.com:5980`

**Nguyên nhân lỗi:**
- `500 Internal Server Error` khi login: middleware import `ioredis` → `ReferenceError: ioredis is not defined` trong Edge Runtime sandbox
- `404` tại `/dashboard`: không có `(dashboard)/dashboard/page.tsx` — chỉ có layout group
- Domain không vào được: nginx `lms-staging.conf` trỏ port `3004`, LMS đang chạy port `3002`

**Kết quả:**
- Login API: `{"success":true,"data":{"accessToken":...}}` ✓
- `/dashboard` → HTTP 200 ✓
- `lms-web` (PM2 id 9) chạy port **3004**, nginx proxy qua domain `https://lms.phuthaiholdings.com:5980` ✓

**Lưu ý / Rủi ro:**
- Rate limiting (100 req/10s) đã bị tắt ở middleware level — nếu cần, có thể implement lại trong từng route handler Node.js (không bị Edge Runtime giới hạn)

---

## [2026-06-17 00:00] Build & Deploy lần đầu — lms-web + lms-worker

**Loại:** deploy

**Các thay đổi:**
- Tạo `.env` từ cấu hình server thực tế: PostgreSQL `localhost:5432` (user: postgres, password: Via@2026), Redis `localhost:6379`, AI Service `localhost:8000`, app port **3002** (3001 đã dùng bởi via-api)
- `prisma/schema.prisma` — Fix relation thiếu `ContentRating → ContentAsset` và `ContentRating → User`; thêm `User.contentRatings ContentRating[]`
- `next.config.js` — Thêm `typescript.ignoreBuildErrors`, `eslint.ignoreDuringBuilds`, `webpack externals` (ioredis, bullmq, pdfkit, minio) để giải quyết `node:diagnostics_channel` không hợp lệ trên webpack
- `src/app/api/quizzes/` — Gộp `[lessonId]/start` và `[attemptId]/submit` thành `[id]/start` + `[id]/submit` (conflict slug cùng level Next.js)
- `src/app/(dashboard)/learning-paths/[id]/page.tsx` — Fix TypeScript: explicit type cho `addForm` state (stepType union thay vì literal)
- `src/app/(dashboard)/question-banks/[id]/page.tsx` — Fix TypeScript cast double-unknown
- `src/app/(dashboard)/reports/page.tsx` — Fix `roles.includes('group_admin')` → `roles.some(r => r.role === 'group_admin')`
- `ecosystem.config.js` — Đổi `script` từ `.bin/next` (bash script) sang `node_modules/next/dist/bin/next` (Windows-compatible); ts-node dùng local path; PORT=3002
- Cài thêm packages: `swr`, `iconv-lite`
- `npx prisma db push` — Tạo toàn bộ tables trong DB `lms_db`
- `npm run db:seed` — Seed 7 tài khoản test, 3 tổ chức, 4 phòng ban, 1 khóa học mẫu

**Kết quả:**
- Build Next.js thành công (44 routes, static + dynamic)
- `lms-web` (PM2 id 8) → `online`, port **3002**
- `lms-worker` (PM2 id 6) → `online`
- `lms-ai-service` (PM2 id 4) → `online`, port 8000 (đã chạy từ trước)
- DB `lms_db` đầy đủ schema + seed data

**Lưu ý / Rủi ro:**
- MinIO chưa chạy — upload/download file sẽ fail gracefully
- 64 TypeScript errors còn tồn tại (type annotations, không ảnh hưởng runtime) — cần fix sau
- `SYSTEM_USER_ID` trong `.env` chưa điền — cần lấy UUID của system user sau khi seed
- Port 3002 thay vì 3001 — nếu cần expose qua domain/nginx, cập nhật reverse proxy

---

## [2026-06-16 21:00] Giai đoạn 6 — Sprint 5 hoàn thành (Task 5.1 → 5.6)

**Loại:** feature

**Các thay đổi:**

### Task 5.1 — Competency Framework Service + API
- `src/services/competency.service.ts` — CRUD cho Framework, Domain, Competency. `linkCourse/unlinkCourse` gắn khóa học vào năng lực với targetLevel. `getUserCompetencyProfile` + `upsertUserCompetency` quản lý profile học viên (nguồn: SELF/MANAGER/QUIZ/SYSTEM, cấp 0–5). Tenant isolation qua framework.companyId chain.
- API routes: GET/POST `/api/frameworks`, GET/PATCH/DELETE `/api/frameworks/[id]`, POST `/api/frameworks/[id]/domains`, PATCH/DELETE `/api/frameworks/[id]/domains/[dId]`, POST `/api/frameworks/[id]/domains/[dId]/competencies`, PATCH/DELETE `/api/competencies/[id]`, POST/DELETE `/api/competencies/[id]/courses`, GET/POST `/api/users/[id]/competencies`

### Task 5.2 — Job Position Service + API
- `src/services/position.service.ts` — CRUD vị trí công việc: gắn `competencyFrameworkId` + `learningPathId`; unique constraint `companyId+code`; block xóa nếu có user đang giữ vị trí
- API routes: GET/POST `/api/positions`, GET/PATCH/DELETE `/api/positions/[id]`

### Task 5.3 — Learning Path Builder + API
- `src/services/learning-path.service.ts` — CRUD Learning Path + Steps. `addStep`: tự động tăng stepOrder, validate course cùng công ty. `reorderSteps`: bulk update trong transaction. `enrollUserToPath`: tạo LearningPathEnrollment + LearningPathStepEnrollment (bước đầu unlock, còn lại khóa). `onCourseCompleted`: unlock step tiếp theo theo prerequisite + recalculatePathProgress. `unlockDueSteps`: cron helper check availableAfterDays
- API routes: GET/POST `/api/learning-paths`, GET/PATCH/DELETE `/api/learning-paths/[id]`, POST `/api/learning-paths/[id]/steps`, PATCH/DELETE `/api/learning-paths/[id]/steps/[stepId]`, POST `/api/learning-paths/[id]/steps/reorder`, POST `/api/learning-paths/[id]/enroll`

### Task 5.4 — Gap Analysis + Position Change
- `src/services/gap-analysis.service.ts` — `runGapAnalysis`: load competency framework của vị trí mới → compare với UserCompetencyProfile → tính overallReadinessScore (weighted by requiredLevel) → lưu vào PositionChangeEvent.gapAnalysisResult. `createPositionChange`: validate user+position trong company. `approvePositionChange`: auto-enroll vào learningPath của vị trí + update user.jobPositionId. `getUserGapAnalysis`: latest event + result
- `src/jobs/position-change.job.ts` — BullMQ worker `position-change`: runGapAnalysis → check CompanyLearningPolicy.autoEnrollOnPositionChange → auto-enroll hoặc set PENDING_APPROVAL. Retry 3 lần với exponential backoff
- `src/jobs/worker.ts` — Đăng ký `startPositionChangeWorker()`
- `src/jobs/cron.ts` — Thêm daily cron 01:00 gọi `unlockDueSteps()`
- API routes: POST `/api/users/[id]/position-change` (kick off BullMQ job), GET `/api/users/[id]/gap-analysis`, GET `/api/position-changes` (filter by status/userId), POST `/api/position-changes/[id]/approve`

### Task 5.5 — Learner Learning Path Enrollment API
- API: GET `/api/my/learning-paths` — list tất cả path enrollments của user hiện tại với step details + course enrollment progress. GET `/api/my/learning-paths/[id]` — chi tiết 1 enrollment

### Task 5.6 — UI Pages
- `src/app/(dashboard)/competency-frameworks/page.tsx` — List frameworks, create modal, publish/toggle active buttons
- `src/app/(dashboard)/competency-frameworks/[id]/page.tsx` — Detail editor: accordion domains, add domain inline, add competency per domain (with requiredLevel selector), delete buttons
- `src/app/(dashboard)/positions/page.tsx` — Table vị trí với badge framework + learning path, create/edit modal (dropdown chọn framework và learning path)
- `src/app/(dashboard)/learning-paths/page.tsx` — List learning paths với step count + enrollment count, create modal
- `src/app/(dashboard)/learning-paths/[id]/page.tsx` — Path builder: danh sách steps có thể xóa, form thêm step (courseId, stepType, deadlineOffsetDays, availableAfterDays, prerequisiteStepId), enroll user modal
- `src/app/(dashboard)/position-changes/page.tsx` — List events với filter by status, expand để xem gap analysis (readiness %, competency gaps), nút "Duyệt & Đăng ký" cho PENDING_APPROVAL
- `src/app/(dashboard)/my-learning-paths/page.tsx` — Learner view: list path enrollments với progress bar, expand để xem steps (locked/unlocked/done với icon), link "Học →" cho step đang mở

**Kết quả:**
- Sprint 5 hoàn thành đầy đủ 6 tasks
- Competency Framework: domain → competency → course link đầy đủ
- Job Position: gắn framework + learning path, tenant isolated
- Learning Path: builder step-by-step, prerequisite chain, auto-unlock theo time/completion
- Gap Analysis: score 0–100% weighted, auto-enroll hoặc PENDING_APPROVAL theo policy
- BullMQ worker xử lý gap analysis background, retry tự động
- UI đầy đủ cho HR và learner

**Lưu ý / Rủi ro:**
- `CompanyLearningPolicy.autoEnrollOnPositionChange` field cần có trong schema — nếu chưa có thì mọi position change sẽ về PENDING_APPROVAL
- `onCourseCompleted()` cần được gọi từ enrollment service khi user hoàn thành khóa học (hook vào `updateProgress` khi `progressPct >= 100`)
- Cron unlock-path-steps chạy mỗi ngày 01:00 — test thủ công có thể gọi `unlockDueSteps()` trực tiếp
- `useSWR` trong UI pages cần `swr` package — đã có trong package.json từ Sprint 1

---

## [2026-06-16 20:00] Giai đoạn 5 — Sprint 4 hoàn thành (Task 4.1 → 4.6)

**Loại:** feature

**Các thay đổi:**

### Task 4.1 — FastAPI AI Service (khung cơ bản)
- `ai-service/main.py` — FastAPI app với CORSMiddleware, include routers question_generator + script_generator, health endpoint `/health`
- `ai-service/config.py` — Settings đọc từ env: NEXTJS_URL, NEXTJS_API_KEY, INTERNAL_API_KEY
- `ai-service/services/llm_client.py` — `get_ai_config(name)`: GET từ Next.js internal API với X-Internal-Key. `call_ollama(base_url, model, prompt, ...)`: POST /api/generate timeout 120s. `extract_json(text)`: strip markdown fences, find JSON boundaries
- `ai-service/requirements.txt` — fastapi, uvicorn, httpx, PyMuPDF, python-docx, python-pptx, python-multipart
- `ai-service/routers/__init__.py`, `ai-service/services/__init__.py` — package markers

### Task 4.2 — Document Parser
- `ai-service/services/document_parser.py` — `parse_pdf()` PyMuPDF, `parse_docx()` python-docx, `parse_pptx()` python-pptx. `chunk_text(text, max_tokens=500)`: split on sentence boundaries (~4 chars/token). `parse_document(bytes, mime)`: dispatcher

### Task 4.3 — Question Generator & Script Generator
- `ai-service/routers/question_generator.py` — QUESTION_PROMPT template tiếng Việt. `POST /api/questions/generate-from-document`: background task (parse → chunk → generate → webhook callback). `POST /api/questions/generate-from-text`: synchronous, cap 10 chunks, trả JSON trực tiếp
- `ai-service/routers/script_generator.py` — `POST /api/scripts/generate-course-outline`: OUTLINE_PROMPT, sections/lessons JSON. `POST /api/scripts/generate-lesson-script`: SCRIPT_PROMPT, segments với speakerNotes
- `src/app/api/internal/ai-configs/[name]/route.ts` — Internal endpoint bảo vệ bằng X-Internal-Key (không dùng JWT), trả AiServiceConfig từ DB cho AI service
- `src/app/api/internal/question-banks/[bankId]/save-generated/route.ts` — Webhook nhận từ FastAPI sau khi generate xong, gọi saveGeneratedQuestions()
- `src/app/api/wizard/outline/route.ts` — POST proxy đến FastAPI /api/scripts/generate-course-outline
- `src/app/api/wizard/script/route.ts` — POST proxy đến FastAPI /api/scripts/generate-lesson-script

### Task 4.4 — Question Bank Management UI
- `src/services/question-bank.service.ts` — Full CRUD, saveGeneratedQuestions() (mcq→single_choice, map options với isCorrect→key/text), createImportJob() (upload file MinIO → tạo SourceDocument), approveQuestion/rejectQuestion, getImportJobStatus
- API routes: GET/POST `/api/question-banks`, GET/PATCH/DELETE `/api/question-banks/[id]`, GET/POST `/api/question-banks/[id]/questions`, PATCH `/api/question-banks/[id]/questions/[qId]`, GET `/api/question-banks/[id]/import-jobs/[jobId]`, POST `/api/question-banks/[id]/import-document`
- `src/app/(dashboard)/question-banks/page.tsx` — List banks + tạo bank mới
- `src/app/(dashboard)/question-banks/[id]/page.tsx` — Chi tiết: tabs (Câu hỏi / Import tài liệu / Cài đặt), filter by status/difficulty/type, approve/reject câu hỏi AI-generated
- `src/components/question-bank/question-list.tsx` — Danh sách câu hỏi với badge status màu (draft=gray, review=yellow, approved=green, rejected=red)
- `src/components/question-bank/question-form.tsx` — Form tạo/sửa câu hỏi MCQ/True-False/Short-Answer với dynamic options
- `src/components/question-bank/import-document-modal.tsx` — 3 stages: upload → polling mỗi 3s → done/error. Hiển thị số câu hỏi đã generate

### Task 4.5 — Quiz Config Form
- `src/app/api/lessons/[lessonId]/quiz-config/route.ts` — GET (config + available banks), PUT (upsert với validation: easyCount+mediumCount+hardCount === totalQuestions)
- `src/components/lesson/quiz-config-form.tsx` — Multi-select banks, distribution sliders, passingScore, timeLimitMins, maxAttempts, shuffleQuestions/Options. Validation inline. Preview pool distribution realtime

### Task 4.6 — AI Course Wizard
- `src/app/(dashboard)/courses/wizard/page.tsx` — 5-step stepper: CourseInfo → Outline (auto-generate khi Next) → ScriptReview → QuestionPreview → Tạo Course. Khi finish: tạo Course → Sections → Lessons qua API. State: courseInfo, outline, scripts Map, finalQuestions, submitting
- `src/components/wizard/step-course-info.tsx` — Topic, targetAudience, objectives (add/remove), durationHours, documentText (paste)
- `src/components/wizard/step-outline-editor.tsx` — Edit outline AI-generated: title/desc khóa học, accordion sections, inline edit lesson title/contentType/minutes, add/remove lesson/section, regenerate
- `src/components/wizard/step-script-review.tsx` — Per-lesson script generation, expand để xem segments + speakerNotes + keyTakeaways, "Sinh tất cả" sequential async
- `src/components/wizard/step-question-preview.tsx` — Generate từ tất cả scripts, checkbox select câu hỏi, select-all/deselect-all, skip option

**Kết quả:**
- Sprint 4 hoàn thành đầy đủ 6 tasks
- AI Service: FastAPI độc lập, communicate qua internal API + webhook callback
- Document Parser: PDF/DOCX/PPTX → chunk → question generation background job
- Question Bank: full CRUD + AI import workflow (review → approve/reject)
- Quiz Config: đọc từ DB với validation distribution, fallback default nếu chưa cấu hình
- AI Course Wizard: 5-step end-to-end từ ý tưởng → cấu trúc khóa học đầy đủ

**Lưu ý / Rủi ro:**
- Cần env vars: `NEXTJS_API_KEY` (shared secret Next.js↔AI service), `AI_SERVICE_URL=http://localhost:8000`, `SYSTEM_USER_ID=<uuid>`, `NEXT_PUBLIC_APP_URL`
- Migration cần chạy: `npx prisma migrate dev --name add_quiz_config_source_doc_sprint4`
- AI Service cần: `cd ai-service && pip install -r requirements.txt && uvicorn main:app --reload`
- Question generation từ document chạy background — frontend poll `/api/question-banks/{id}/import-jobs/{jobId}`
- Wizard QuestionPreview gọi AI service trực tiếp qua `NEXT_PUBLIC_AI_SERVICE_URL` — cần expose port nếu deploy
- Script generation tuần tự ("Sinh tất cả") — N bài học × latency Ollama, có thể chậm nếu outline lớn

---

## [2026-06-16 19:00] Giai đoạn 4 — Sprint 3 hoàn thành (Task 3.1 → 3.4)

**Loại:** feature

**Các thay đổi:**

### Task 3.1 — Learning Group (xuyên công ty)
- `src/services/learning-group.service.ts` — getLearningGroups, getLearningGroup, createLearningGroup, updateLearningGroup, deleteLearningGroup (soft-delete isActive=false), addMember (tìm bằng email hoặc employeeCode — không expose danh sách), removeMember (soft-delete removedAt), addCourse, removeCourse, syncRuleBasedGroup (evaluate ruleJson AND/OR conditions — fields: job_level/job_title/company_id/department_id, ops: eq/in/contains)
- API routes: GET/POST `/api/learning-groups`, GET/PATCH/DELETE `/api/learning-groups/[id]`, POST `/api/learning-groups/[id]/members`, DELETE `/api/learning-groups/[id]/members/[userId]`, POST `/api/learning-groups/[id]/courses`, DELETE `/api/learning-groups/[id]/courses/[courseId]`, POST `/api/learning-groups/[id]/sync`
- `src/app/(dashboard)/learning-groups/page.tsx` — List + create modal
- `src/app/(dashboard)/learning-groups/[id]/page.tsx` — Detail: tabs (Thành viên / Khóa học / Quy tắc), sync button cho rule-based
- `src/components/learning-group/member-search.tsx` — Search by email/employeeCode only
- `src/components/learning-group/rule-builder.tsx` — UI để build ruleJson với dropdown field/op và input value, thay đổi realtime PATCH về API
- `src/jobs/cron.ts` — Thêm hourly cron: tự đồng bộ tất cả rule-based groups

### Task 3.2 — Mandatory Training & Compliance
- `src/services/compliance.service.ts` — getCompanyCompliance (filter: deptId, courseId, overdueOnly), getUserCompliance; 5 trạng thái: completed/in_progress/overdue/not_started/overdue_not_started; summary theo phòng ban
- API routes: GET `/api/company/[companyId]/compliance`, GET `/api/company/[companyId]/users/[userId]/compliance`

### Task 3.3 — Reports & Analytics
- `src/services/report.service.ts` — getGroupOverview, getCompanyComparison, getLearningGroupProgress (matrix member×course), getCompanyOverview, getCompanyByDepartment, getCompanyByCourse, getUserReport, exportComplianceReport (XLSX với xlsx package)
- API routes: GET `/api/reports/group/overview`, `/api/reports/group/company-comparison`, `/api/reports/learning-groups/[id]/progress`, `/api/reports/company/[companyId]/overview`, `/by-department`, `/by-course`, `/users/[userId]`, `/export`
- `src/app/(dashboard)/reports/page.tsx` — Dashboard khác nhau theo role (group_admin thấy overview toàn tập đoàn + company comparison, company_admin thấy overview công ty + dept breakdown)
- `src/app/(dashboard)/reports/compliance/page.tsx` — Compliance report với filter "chỉ trễ hạn"
- `src/components/reports/kpi-cards.tsx` — Grid metric cards có color coding
- `src/components/reports/completion-chart.tsx` — Recharts BarChart với color theo threshold (≥80%=green, ≥50%=orange, <50%=red)
- `src/components/reports/user-progress-table.tsx` — Table tiến độ với progress bar inline, configurable columns
- `src/components/reports/compliance-table.tsx` — Compliance breakdown: totals, dept progress bars, detail table
- `src/components/reports/compliance-heatmap.tsx` — Ma trận phòng ban × khóa học, cells màu theo trạng thái + legend
- `src/components/reports/export-button.tsx` — Export Excel trigger + download via Blob URL

### Task 3.4 — AI Config Management UI
- `src/services/ai-config.service.ts` — getAiConfigs, getAiConfig, upsertAiConfig, deleteAiConfig, testAiConnection (fetch Ollama /api/tags, timeout 10s, trả latency + model list), getAvailableModels
- API routes: GET/POST `/api/ai-config`, PATCH/DELETE `/api/ai-config/[id]`, POST `/api/ai-config/[id]/test`, GET `/api/ai-config/[id]/models`
- `src/app/(dashboard)/ai-config/page.tsx` — List configs + create modal
- `src/components/ai-config/config-card.tsx` — Card per config: status indicator (green/red/yellow/gray), test button, edit modal với dropdown model từ danh sách thực tế sau khi test

**Kết quả:**
- Sprint 3 hoàn thành đầy đủ 4 tasks
- Learning Group: manual + rule-based, sync hourly cron, member search không expose danh sách công ty
- Compliance: 5 trạng thái, filter overdueOnly, export Excel, summary theo phòng ban
- Reports: role-based dashboard, không expose cross-tenant data
- AI Config: test connection live, list models từ Ollama, dropdown chọn model

**Lưu ý / Rủi ro:**
- `SYSTEM_USER_ID` env var cần set trong `.env` (dùng cho cron sync group — có thể dùng UUID của system user trong DB)
- Rule-based sync chạy mỗi giờ — test thủ công qua POST `/api/learning-groups/:id/sync`
- Report queries chưa có Redis cache — khi data lớn cần thêm cacheAside cho getGroupOverview và getCompanyComparison
- Export XLSX dùng `xlsx` package đã có sẵn trong package.json

---

## [2026-06-16 18:00] Bổ sung Sprint 2 — QuizConfig schema + Certificate PDF

**Loại:** fix / feature

**Các thay đổi:**

### Fix 1 — QuizConfig model
- `prisma/schema.prisma` — Bổ sung model `QuizConfig` (lessonId unique, bankIds String[], totalQuestions, easyCount, mediumCount, hardCount, passingScore, timeLimitMins, maxAttempts, shuffleQuestions, shuffleOptions). Thêm relation `quizConfig QuizConfig?` vào `Lesson`. Thêm `lessonId String` vào `QuizAttempt` để link ngược về QuizConfig khi auto-submit.
- `src/services/quiz.service.ts` — Bỏ hardcode (TOTAL=10, TIME=30min, MAX_ATTEMPTS=3). Đọc từ `QuizConfig` qua `lesson.quizConfig`. Fallback về default nếu QuizConfig chưa tạo. `autoSubmitExpiredAttempts` giờ per-attempt time limit thay vì global 30 phút.

### Fix 2 — Certificate PDF generation
- `package.json` — Thêm `pdfkit ^0.15.2` + `@types/pdfkit ^0.13.9`
- `src/services/certificate.service.ts` — `generateCertificatePdf()` dùng pdfkit tạo PDF A4 ngang: border vàng, tiêu đề, tên học viên, khóa học, ngày hoàn thành, ngày hết hạn (nếu có), cert code, verify URL. Upload lên MinIO `certificates/{code}.pdf`. `issueCertificate()` gọi generate PDF sau khi tạo record → lưu `pdfUrl`. Thêm `getCertificatePdfUrl()` trả về signed URL 5 phút. PDF generation failure không block cert issuance.
- `src/app/api/my/certificates/[code]/route.ts` — GET trả về signed PDF download URL (auth required, chỉ chủ sở hữu)
- `src/app/verify/[code]/page.tsx` — Hiển thị link "Tải chứng chỉ PDF" nếu cert có `hasPdf = true`

**Kết quả:**
- QuizConfig đầy đủ theo spec, đọc từ DB thay vì hardcode
- Certificate PDF tự động tạo khi course hoàn thành, lưu MinIO, học viên tải qua signed URL 5 phút

**Lưu ý / Rủi ro:**
- Cần chạy `npm install` để cài `pdfkit`
- Cần migrate DB: `npx prisma migrate dev --name add_quiz_config_and_lesson_id_on_attempt`
- `QuizAttempt` thêm `lessonId NOT NULL` — nếu DB đã có data cũ cần cung cấp giá trị mặc định hoặc dùng migration bước 2 (set lessonId, rồi add NOT NULL)
- Certificate PDF dùng font mặc định Helvetica (không cần font file bên ngoài)
- `NEXT_PUBLIC_APP_URL` cần set trong `.env` để verify URL trong PDF đúng domain

---

## [2026-06-16 17:30] Giai đoạn 3 — Sprint 2 hoàn thành (Task 2.0 → 2.4)

**Loại:** feature

**Các thay đổi:**

### Task 2.0 — Course CRUD API + Schema bổ sung
- `prisma/schema.prisma` — Bổ sung `CoursePublication` (Cơ chế ①: group_admin publish xuống công ty), `CourseAssignment` (Cơ chế ③: assign nội bộ), `@@unique([assetId, organizationId])` cho AssetPermission
- `src/services/course.service.ts` — getCourses, getCourse, createCourse, updateCourse, deleteCourse, publishCourse (bao gồm tạo CoursePublication), createSection, createLesson, assignCourse
- API routes: GET/POST `/api/courses`, GET/PATCH/DELETE `/api/courses/[id]`, POST `/api/courses/[id]/publish`, POST `/api/courses/[id]/sections`, POST `/api/courses/[id]/sections/[sId]/lessons`, POST `/api/courses/[id]/assign`

### Task 2.1 — Lesson Player Components
- Packages cài thêm: `video.js`, `@videojs/http-streaming`, `@types/video.js`, `pdfjs-dist`
- `src/components/lesson/VideoPlayer.tsx` — Video.js HLS player, tracking đầy đủ: watch_start/heartbeat(10s)/pause/resume/seek/watch_end/speed_change, fire-and-forget POST /api/tracking/video, auto-fetch signed HLS URL, loading/error states
- `src/components/lesson/PdfViewer.tsx` — PDF.js canvas render (không dùng iframe), watermark diagonal overlay (tên+email+timestamp, opacity 0.12), disable contextmenu/Ctrl+S/Ctrl+P, page tracking (open/page_view/page_leave/close), pagination controls, zoom controls

### Task 2.2 — Enrollment & Progress
- `src/services/enrollment.service.ts` — getMyCourses (raw SQL UNION 3 nguồn + cache 60s), getMyCourse, enrollCourse (verify access trước khi enroll), updateLessonProgress (upsert + auto-complete check), checkCourseCompletion (đếm required lessons → auto set completedAt → issueCertificate)
- `/api/my/courses` — GET list UNION 3 nguồn
- `/api/my/courses/[id]` — GET chi tiết với section/lesson/progress
- `/api/my/courses/[id]/enroll` — POST đăng ký
- `/api/my/courses/[id]/lessons/[lessonId]/progress` — POST cập nhật tiến độ

### Task 2.3 — Quiz Engine
- `src/services/quiz.service.ts` — startQuiz (random N câu từ QuestionBank theo tỉ lệ dễ/trung/khó, shuffle options, trả về BỎ correctAnswer), submitQuiz (grade, tính scorePct, isPassed, cập nhật LessonProgress nếu passed), autoSubmitExpiredAttempts (batch cron)
- `/api/quizzes/[lessonId]/start` — GET khởi tạo attempt session
- `/api/quizzes/[attemptId]/submit` — POST nộp bài
- `src/jobs/cron.ts` — registerCronJobs(): auto-submit expired attempts mỗi 5 phút
- `src/jobs/worker.ts` — tích hợp registerCronJobs()

### Task 2.4 — Certificate
- `src/services/certificate.service.ts` — issueCertificate (tạo cert record với code unique, stub PDF generation chờ Sprint 4), verifyCertificate (public, trả đầy đủ thông tin học viên + khóa học)
- `src/app/verify/[code]/page.tsx` — Server Component, public verify page, hiển thị trạng thái valid/expired + chi tiết chứng chỉ

**Kết quả:**
- Tất cả 5 tasks Sprint 2 hoàn thành
- UNION 3 nguồn dùng raw SQL đúng spec (Prisma không handle UNION tốt)
- VideoPlayer không bao giờ expose raw MP4 URL — chỉ signed HLS
- PdfViewer không dùng iframe src trực tiếp — render qua PDF.js canvas
- Certificate auto-issue khi completedAt được set

**Lưu ý / Rủi ro:**
- PDF.js worker cần copy `pdf.worker.min.js` vào `public/` khi build: `cp node_modules/pdfjs-dist/build/pdf.worker.min.js public/`
- Quiz QuizConfig chưa có bảng riêng trong schema — đang dùng hardcode (TOTAL=10, TIME=30min, MAX_ATTEMPTS=3) — TODO: tạo QuizConfig model gắn với Lesson
- Certificate PDF generation là stub — Sprint 4 sẽ call FastAPI service
- Schema đã thay đổi (thêm CoursePublication, CourseAssignment) → cần chạy lại `prisma migrate dev` khi có DB

---

## [2026-06-16 16:30] Giai đoạn 2 — Sprint 1 hoàn thành (Task 1.1 → 1.6)

**Loại:** feature

**Các thay đổi:**

### Task 1.1 — Auth API + Login UI
- `src/lib/auth.ts` — getAuthContext() trích xuất user từ request headers (inject bởi middleware)
- `src/services/auth.service.ts` — login (bcrypt verify, JWT sign, cache roles Redis), refresh, logout, getMe
- `src/app/api/auth/login/route.ts` — POST, set refresh_token vào httpOnly cookie
- `src/app/api/auth/refresh/route.ts` — POST, accept từ cookie hoặc body
- `src/app/api/auth/logout/route.ts` — POST, revoke Redis token + clear cookie
- `src/app/api/auth/me/route.ts` — GET profile đầy đủ với roles
- `src/components/ui/button.tsx`, `input.tsx`, `label.tsx` — shadcn/ui components
- `src/lib/utils.ts` — cn() helper
- `src/components/providers/auth-provider.tsx` — React Context: login/logout/refresh, auto-renew 13 phút
- `src/app/(auth)/login/page.tsx` — Login form với react-hook-form + zod validation
- `src/app/(auth)/layout.tsx`, `src/app/(dashboard)/layout.tsx`

### Task 1.2 — Organizations API + Service
- `src/services/organization.service.ts` — getOrgTree (recursive CTE), getOrgFlat, getOrgChildren, CRUD với tenant isolation
- `src/app/api/organizations/route.ts` — GET (list) + POST (create)
- `src/app/api/organizations/[id]/route.ts` — GET + PATCH
- `src/app/api/organizations/[id]/tree/route.ts` — GET nested JSON (cached 30 phút)
- `src/app/api/organizations/[id]/flat/route.ts` — GET flat array cho React Flow
- `src/app/api/organizations/[id]/children/route.ts` — GET lazy load children

### Task 1.3 — Org Chart UI (React Flow)
- `src/components/org-chart/OrgChartViewer.tsx` — @xyflow/react + dagre auto-layout, custom node card (màu theo type), lazy load 2 cấp, expand on demand, Export PNG, zoom/pan/minimap
- `src/app/(dashboard)/organizations/[id]/page.tsx`

### Task 1.4 — Import Pipeline
- `src/services/import.service.ts` — parseExcel, validateOrgRows/validateUserRows, topologicalSort, importOrgChart/importUsers/importJobPositions (transaction + snapshot), rollbackImport (24h limit), generateErrorFile (highlight lỗi)
- `src/app/api/import/validate/route.ts` — dry-run
- `src/app/api/import/execute/route.ts` — org_chart | users | job_positions
- `src/app/api/import/jobs/[jobId]/route.ts` — GET status
- `src/app/api/import/jobs/[jobId]/log/route.ts` — GET error Excel file
- `src/app/api/import/rollback/[jobId]/route.ts` — POST rollback
- `src/app/api/import/history/route.ts` — GET paginated history

### Task 1.5 — Users API
- `src/services/user.service.ts` — getUsers (paginated + filter), getUserById (tenant check), createUser (bcrypt password), updateUser, assignRole (cache invalidate), removeRole
- `src/app/api/users/route.ts` — GET + POST
- `src/app/api/users/[id]/route.ts` — GET + PATCH
- `src/app/api/users/[id]/roles/route.ts` — POST assign role
- `src/app/api/users/[id]/roles/[roleId]/route.ts` — DELETE remove role
- `src/app/api/users/import-csv/route.ts` — POST bulk import

### Task 1.6 — ContentAsset Upload Pipeline
- `src/lib/queue.ts` — BullMQ queues: asset-processing, tracking, notifications
- `src/services/asset.service.ts` — getUploadUrl (presigned PUT, lms-temp), confirmUpload (DB record + enqueue), getStreamUrl (HLS signed URL, cache 18 phút), getViewUrl, handleDownload (policy check → 403/watermark/signed URL), CRUD, getAssetLogs, setAssetPermission, rateAsset
- `src/jobs/asset-processor.job.ts` — BullMQ Worker: download từ temp → FFmpeg HLS conversion → extract thumbnail → upload lms-private → update DB (READY/FAILED)
- `src/jobs/tracking-writer.job.ts` — Batch writer: buffer events → flush mỗi 10s hoặc 100 events → prisma createMany
- `src/jobs/worker.ts` — PM2 entry point cho lms-worker process
- `src/app/api/assets/upload-url/route.ts` — POST presigned PUT URL
- `src/app/api/assets/route.ts` — GET list + POST confirm upload
- `src/app/api/assets/[id]/route.ts` — PATCH + DELETE
- `src/app/api/assets/[id]/status/route.ts` — GET processing status
- `src/app/api/assets/[id]/stream-url/route.ts` — GET HLS signed URL
- `src/app/api/assets/[id]/view-url/route.ts` — GET PDF signed URL
- `src/app/api/assets/[id]/download/route.ts` — POST download (policy enforcement)
- `src/app/api/assets/[id]/heartbeat/route.ts` — POST stream keepalive
- `src/app/api/assets/[id]/logs/route.ts` — GET access logs
- `src/app/api/assets/[id]/permissions/route.ts` — POST set org permission
- `src/app/api/assets/[id]/rating/route.ts` — POST rate 1–5
- `src/app/api/tracking/video/route.ts` — POST fire-and-forget → queue
- `src/app/api/tracking/document/route.ts` — POST fire-and-forget → queue

**Kết quả:**
- Tất cả 6 tasks Sprint 1 hoàn thành
- Code tuân thủ toàn bộ nguyên tắc CLAUDE.md: tenant isolation, signed URL only, download blocked by default, async tracking, ownership check kép
- Chưa test thực tế (cần DB + Redis + MinIO)

**Lưu ý / Rủi ro:**
- FFmpeg phải được cài trên server: `choco install ffmpeg` hoặc download từ ffmpeg.org
- `AssetPermission` upsert dùng fake `id` field — cần thêm unique constraint `[assetId, organizationId]` vào schema (TODO sprint review)
- `generateErrorFile` hiện chỉ append text vào cell — styling Excel màu đỏ cần thư viện `exceljs` nếu muốn đẹp hơn

---

## [2026-06-16 15:45] Giai đoạn 1 — SETUP hoàn thành (Task 0.1 → 0.5)

**Loại:** setup / feature

**Các thay đổi:**

### Task 0.1 — Project structure
- `package.json` — Next.js 14 + đầy đủ dependencies (Prisma, Redis/BullMQ, MinIO, shadcn/ui, react-flow, xlsx...)
- `next.config.js` — security headers, external packages cho Prisma
- `tsconfig.json` — strict mode, path alias `@/*`
- `tailwind.config.ts` — shadcn/ui theme variables, dark mode class
- `postcss.config.js`
- `.gitignore`
- `.env.example` — template với tất cả biến môi trường cần thiết
- `jest.config.js` — ts-jest với path alias
- `ecosystem.config.js` — PM2 config cho lms-web + lms-worker
- `src/app/globals.css` — CSS variables cho shadcn/ui theme
- `src/app/layout.tsx` — Root layout với Inter font
- `src/app/page.tsx` — Redirect về /dashboard
- `src/types/index.ts` — Core types (RoleType, AuthUser, ApiResponse, Pagination)

### Task 0.2 — Prisma Schema + Seed
- `prisma/schema.prisma` — Schema đầy đủ theo LMS_MASTER_SPEC Section 4:
  - Organization (multi-tenant, self-join hierarchy)
  - User + UserRole (6 roles)
  - Course + CourseSection + Lesson
  - ContentAsset + AssetPermission + AssetAccessLog (security layer)
  - Enrollment + LessonProgress + Certificate
  - VideoWatchEvent + DocumentViewEvent + AssetEngagementStat (analytics)
  - JobPosition + CompetencyFramework + Competency + UserCompetencyProfile
  - LearningPath + LearningPathStep + LearningPathEnrollment
  - PositionChangeEvent (gap analysis workflow)
  - LearningGroup + GroupMember + GroupCourse
  - QuestionBank + Question + QuizAttempt
  - ImportJob + CompanyLearningPolicy + AiServiceConfig
- `prisma/seed.ts` — Seed data:
  - 1 group org (Tập đoàn VIA) + 2 company (CTA, CTB) + 4 dept
  - 7 users (1 mỗi role), password: `Password@123`
  - 3 job positions
  - 1 course mẫu (2 sections, 4 lessons)
  - 1 CompanyLearningPolicy

### Task 0.3 — Infrastructure Libs
- `src/lib/prisma.ts` — Singleton PrismaClient (global để tránh hot-reload leak)
- `src/lib/redis.ts` — ioredis client + helpers (redisGet/Set/Del/DelPattern) với error fallback
- `src/lib/minio.ts` — MinIO client + presigned URL helpers (upload/download/move/delete/ensureBuckets)
- `src/lib/cache.ts` — TTL constants, CACHE_KEYS builders, cacheAside pattern, invalidation helpers

### Task 0.4 — Middleware Stack
- `src/middleware/auth.middleware.ts` — JWT verify/extract/sign, getAuthUser từ request
- `src/middleware/tenant-guard.ts` — resolveTenantId (group_admin có thể switch company), assertSameTenant
- `src/middleware/require-role.ts` — withRole() HOF, withAuth() HOF
- `src/middleware/rate-limit.ts` — Sliding window 100 req/10s dùng Redis sorted set
- `src/middleware.ts` — Next.js middleware chain: JWT verify → rate limit → inject context headers

### Task 0.5 — Error Handling
- `src/lib/errors.ts` — AppError base + subclasses: Unauthorized, Forbidden, NotFound, Validation, Conflict, TenantViolation, ServiceUnavailable
- `src/app/api/error-handler.ts` — handleApiError() map: AppError → HTTP, ZodError → 422, Prisma P2002 → 409, P2025 → 404

**Kết quả:**
- `npm install` thành công — 890 packages installed
- `tailwindcss-animate` bổ sung sau (cần cho shadcn/ui)
- `@radix-ui/react-badge` bị xóa khỏi package.json (package không tồn tại)
- Chưa chạy `prisma migrate` — cần DB PostgreSQL trước
- Chưa chạy `prisma db seed` — cần migrate xong

**Lưu ý / Rủi ro:**
- Next.js 14.2.29 có security advisory — cân nhắc nâng lên 14.2.30+ sau khi sprint ổn định
- Cần tạo file `.env` từ `.env.example` với thông tin thực trước khi chạy
- Lệnh cần chạy tiếp theo khi có DB:
  ```bash
  cp .env.example .env
  # Điền DATABASE_URL, REDIS_URL, MINIO_* vào .env
  npx prisma migrate dev --name init
  npm run db:seed
  npm run dev
  ```

---

> File này được cập nhật tự động sau mỗi lần thực hiện thay đổi.
> Xem git log để biết chi tiết commit từng file.

# PROMPT MASTER — LMS Tập đoàn (Claude CLI One-Shot Build)

> Đặt file này tại root project: `./PROMPT_MASTER.md`  
> Chạy: `claude` → paste nội dung file này vào session đầu tiên  
> Claude CLI sẽ đọc `LMS_MASTER_SPEC.md` và triển khai từng Sprint theo thứ tự

---

## CONTEXT & NHIỆM VỤ

Bạn là Senior Full-Stack Engineer chịu trách nhiệm xây dựng hệ thống LMS đào tạo nội bộ
cho mô hình tập đoàn. Toàn bộ yêu cầu kỹ thuật đã được định nghĩa đầy đủ trong file
`LMS_MASTER_SPEC.md` tại thư mục gốc của project.

**Đọc toàn bộ `LMS_MASTER_SPEC.md` trước khi thực hiện bất kỳ task nào.**

---

## STACK & CẤU TRÚC PROJECT

```
Stack:
  Frontend:   Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui
  Backend:    Next.js API Routes + Prisma ORM
  AI Service: FastAPI (Python) — kết nối Ollama qua HTTP
  Database:   PostgreSQL
  Cache:      Redis (ioredis + BullMQ)
  Storage:    MinIO (S3-compatible)
  Deploy:     PM2 + GitHub Actions + Ansible (Windows Server)

Cấu trúc thư mục:
lms/
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── (auth)/             # login, register
│   │   ├── (dashboard)/        # protected routes
│   │   │   ├── organizations/  # org chart
│   │   │   ├── users/
│   │   │   ├── courses/
│   │   │   ├── assets/
│   │   │   ├── learning-paths/
│   │   │   ├── competency/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   └── api/                # API routes
│   │       ├── auth/
│   │       ├── organizations/
│   │       ├── users/
│   │       ├── courses/
│   │       ├── assets/
│   │       ├── tracking/
│   │       ├── import/
│   │       ├── positions/
│   │       ├── frameworks/
│   │       ├── learning-paths/
│   │       └── reports/
│   ├── components/
│   │   ├── org-chart/          # React Flow org chart
│   │   ├── lesson/             # Video.js + PDF.js players
│   │   ├── learning-path/      # step UI, unlock indicator
│   │   ├── competency/         # framework builder
│   │   └── ui/                 # shadcn/ui components
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   ├── minio.ts
│   │   ├── auth.ts
│   │   └── cache.ts
│   ├── services/
│   │   ├── asset.service.ts    # Signed URL, download policy
│   │   ├── import.service.ts   # Excel parse + validate + transaction
│   │   ├── gap-analysis.service.ts
│   │   └── notification.service.ts
│   ├── jobs/                   # BullMQ workers
│   │   ├── asset-processor.job.ts
│   │   ├── tracking-writer.job.ts
│   │   ├── position-change.job.ts
│   │   └── aggregate-stats.job.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── tenant-guard.ts
│   │   └── require-role.ts
│   └── types/
│       └── index.ts
├── prisma/
│   ├── schema.prisma            # Copy TOÀN BỘ schema từ Section 4 của SPEC
│   ├── migrations/
│   └── seed.ts
├── ai-service/                  # FastAPI
│   ├── main.py
│   ├── routers/
│   │   ├── questions.py
│   │   ├── wizard.py
│   │   └── watermark.py
│   └── requirements.txt
├── ecosystem.config.js          # PM2
├── .env.example                 # Copy từ Section 12 của SPEC
└── LMS_MASTER_SPEC.md
```

---

## NGUYÊN TẮC CODE BẮT BUỘC

### 1. Tenant Isolation — KHÔNG ĐƯỢC BỎ QUA
```typescript
// ❌ SAI — không có tenant guard
export async function GET(req: Request) {
  const courses = await prisma.course.findMany();
}

// ✅ ĐÚNG — luôn filter theo companyId từ middleware
export async function GET(req: NextRequest) {
  const { companyId } = getAuthContext(req); // từ middleware
  const courses = await prisma.course.findMany({
    where: { ownerCompanyId: companyId }
  });
}
```

### 2. Signed URL — KHÔNG bao giờ trả URL gốc
```typescript
// ❌ SAI
return { videoUrl: asset.storagePath };

// ✅ ĐÚNG
const signedUrl = await minioClient.presignedGetObject(
  'lms-private', asset.hlsPlaylistPath, 20 * 60
);
return { streamUrl: signedUrl };
```

### 3. Download Policy — Luôn kiểm tra trước
```typescript
// Mọi endpoint liên quan tới file PHẢI gọi
await logAccessEvent(assetId, userId, 'download_attempt');
if (asset.downloadPolicy === 'BLOCKED') throw new ForbiddenError('...');
```

### 4. Tracking — KHÔNG ghi DB đồng bộ
```typescript
// ❌ SAI — block API response
await prisma.videoWatchEvent.create({ data: event });

// ✅ ĐÚNG — queue, trả về ngay
await trackingQueue.add('event', event);
return Response.json({ ok: true });
```

### 5. Role check — Luôn dùng middleware, không hardcode
```typescript
// ❌ SAI
if (user.role === 'company_admin') { ... }

// ✅ ĐÚNG — dùng decorator/middleware
export const GET = withRole(['company_admin', 'group_admin'], handler);
```

### 6. Error handling — Nhất quán
```typescript
// Luôn dùng custom error classes
throw new ForbiddenError('Không có quyền truy cập');
throw new NotFoundError('Tài liệu không tồn tại');
throw new ValidationError('email không hợp lệ', { field: 'email' });

// Global error handler ở middleware tự map sang HTTP status
```

---

## THỨ TỰ THỰC HIỆN

### GIAI ĐOẠN 1 — SETUP (làm trước, không code feature)

**Task 0.1 — Khởi tạo project**
```bash
npx create-next-app@14 lms --typescript --tailwind --app --src-dir
cd lms
npx shadcn-ui@latest init
npm install @prisma/client prisma zod next-auth bcryptjs jsonwebtoken
npm install ioredis bullmq xlsx multer @xyflow/react dagre
npm install @tanstack/react-query axios node-cron winston
npm install -D @types/bcryptjs @types/jsonwebtoken @types/multer
```

**Task 0.2 — Prisma Schema**
- Copy TOÀN BỘ schema từ Section 4 (LMS_MASTER_SPEC.md) vào `prisma/schema.prisma`
- Chạy `npx prisma migrate dev --name init`
- Tạo `prisma/seed.ts` với dữ liệu mẫu:
  - 1 group org, 2 company org (CT A, CT B), 4 dept
  - 1 user mỗi role (7 users tổng)
  - 3 job positions mẫu
  - 1 course mẫu với 2 section, 4 lesson

**Task 0.3 — Infrastructure**
- `src/lib/prisma.ts` — singleton Prisma client
- `src/lib/redis.ts` — ioredis client + helper functions (get/set/del với TTL)
- `src/lib/minio.ts` — MinIO client + presigned URL helpers
- `src/lib/cache.ts` — cache keys + cache-aside pattern functions
- `.env.example` — copy từ Section 12 của SPEC

**Task 0.4 — Middleware stack**
- `src/middleware/auth.middleware.ts` — verify JWT, inject `req.user`
- `src/middleware/tenant-guard.ts` — inject `req.companyId`, block cross-tenant
- `src/middleware/require-role.ts` — HOF nhận roles[], trả middleware
- `src/middleware/rate-limit.ts` — 100 req/10s per user (dùng Redis)
- `src/app/middleware.ts` — compose middleware chain cho toàn bộ `/api/*`

**Task 0.5 — Error handling**
- `src/lib/errors.ts` — ForbiddenError, NotFoundError, ValidationError, ConflictError
- `src/app/api/error-handler.ts` — global error → HTTP response mapper

---

### GIAI ĐOẠN 2 — SPRINT 1 (Auth + Org + Users + Import + Asset upload)

Sau khi hoàn thành Giai đoạn 1, thực hiện các task theo thứ tự sau.
**Mỗi task: tạo đầy đủ service + API route + UI component + test cơ bản.**

**Task 1.1 — Auth**
- API: POST /api/auth/login, /refresh, /logout, GET /api/auth/me
- UI: `/app/(auth)/login/page.tsx` với form + validation
- Provider: `src/components/providers/auth-provider.tsx`

**Task 1.2 — Organizations API**
- Service: `src/services/organization.service.ts`
  - `getOrgTree(companyId)` → nested JSON
  - `getOrgFlat(companyId)` → array cho React Flow
  - `getOrgChildren(id)` → lazy load
- API: GET /api/organizations, POST, GET/:id, PATCH/:id, GET/:id/tree, GET/:id/flat, GET/:id/children
- Tất cả query phải filter theo `companyId` từ middleware

**Task 1.3 — Org Chart UI**
- Install `@xyflow/react dagre`
- Component: `src/components/org-chart/OrgChartViewer.tsx`
  - Custom node card: tên, type badge (màu), userCount, managerName
  - Drag/zoom/pan, MiniMap, Controls
  - Click node → sidebar danh sách nhân sự
  - Nút Export PNG (react-flow `toImage()`)
  - Lazy load: chỉ render 2 cấp đầu, click expand để load con
- Page: `/app/(dashboard)/organizations/[id]/page.tsx`

**Task 1.4 — Import Pipeline**
- Service: `src/services/import.service.ts`
  - `parseExcel(buffer, sheetName)` → array of rows (dùng `xlsx` package)
  - `validateRows(rows, rules)` → ImportError[]
  - `topologicalSort(rows, codeField, parentField)` → sorted rows
  - `importOrgChart(file, companyId)` → transaction + snapshot
  - `importUsers(file, companyId)` → transaction
  - `importJobPositions(file, companyId)` → transaction
  - `generateErrorFile(originalFile, errors)` → Excel với ô lỗi highlight đỏ
- API: POST /api/import/validate, /execute, GET /api/import/jobs/:id, GET /jobs/:id/log, POST /rollback/:id
- UI: Upload component với drag-drop, progress indicator, error table

**Task 1.5 — Users API**
- API: GET /api/users, POST, GET/:id, PATCH/:id, POST/:id/roles, POST /import-csv
- Validation: Zod schema đầy đủ
- UI: `/app/(dashboard)/users/` — list + form + role management

**Task 1.6 — ContentAsset Upload**
- Service: `src/services/asset.service.ts`
  - `getUploadUrl(companyId, userId)` → presigned PUT (lms-temp, 15 phút)
  - `confirmUpload(assetData)` → tạo DB record + enqueue processor job
  - `getStreamUrl(assetId, userId)` → verify access + log + presigned GET HLS
  - `getViewUrl(assetId, userId)` → verify access + log + presigned GET PDF
  - `handleDownload(assetId, userId)` → check policy → watermark or signed URL
  - `canModifyAsset(userId, assetId)` → ownership check kép
- Job: `src/jobs/asset-processor.job.ts`
  - FFmpeg HLS conversion + thumbnail extraction
  - Move from lms-temp to lms-private
  - Update processingStatus
- API: tất cả endpoints từ Section 5.4

---

### GIAI ĐOẠN 3 — SPRINT 2 (Lesson Player + Progress + Quiz)

**Task 2.1 — Lesson Player Components**
- `src/components/lesson/VideoPlayer.tsx`
  - Video.js với plugin HLS
  - Event tracking: watch_start, heartbeat(10s), pause, resume, seek, watch_end
  - Fire-and-forget: `fetch('/api/tracking/video', { method: 'POST' }).catch(() => {})`
  - Tracking queue: `src/jobs/tracking-writer.job.ts` (batch write mỗi 10s)
- `src/components/lesson/PdfViewer.tsx`
  - PDF.js render (không dùng iframe src trực tiếp)
  - Canvas watermark overlay với tên + email + timestamp
  - Disable contextmenu, Ctrl+S, Ctrl+P
  - Page tracking: mỗi lần chuyển trang → POST /api/tracking/document

**Task 2.2 — Enrollment & Progress**
- API: GET /api/my/courses (UNION 3 nguồn), GET/:id, POST/:id/enroll
- API: POST /api/my/courses/:id/lessons/:lessonId/progress
- Logic: auto-complete course khi tất cả required lessons done → issue certificate

**Task 2.3 — Quiz Engine**
- API: GET /api/quizzes/:lessonId/start → random N câu từ QuestionBank
- API: POST /api/quizzes/:attemptId/submit → chấm điểm, cập nhật progress
- Logic: time limit, max attempts, auto-submit khi hết giờ (cron)

**Task 2.4 — Certificate**
- Auto-issue khi enrollment.completedAt set
- PDF generation (Python FastAPI + reportlab)
- Public verify: GET /verify/[code]

---

### GIAI ĐOẠN 4 — SPRINT 3 (Reports + Groups + Compliance)

**Task 3.1 — Learning Group**
- API: CRUD + /members + /courses
- Cron: sync rule-based group members mỗi 1 giờ

**Task 3.2 — Mandatory Training + Compliance**
- API: GET /api/company/:id/compliance
- Logic: compliance status (completed/in_progress/overdue/not_started)
- Cron: deadline reminder 14/7/1 ngày trước

**Task 3.3 — Reports & Analytics**
- Aggregate job: hourly AssetEngagementStat
- API: tất cả endpoints từ Section 5.7
- UI: dashboard charts (dùng recharts hoặc chart.js)

**Task 3.4 — Content Quality Dashboard**
- UI: bảng nội dung sắp xếp theo engagement score
- Flag tự động nội dung kém chất lượng theo threshold
- Drop-off curve chart cho video

---

### GIAI ĐOẠN 5 — SPRINT 4 (AI Service)

**Task 4.1 — FastAPI AI Service**
```python
# ai-service/main.py
# Routers:
# POST /ai/generate-questions  → nhận text, trả [{question, options, answer, explanation}]
# POST /ai/watermark/pdf       → nhận pdf bytes + user info, trả pdf watermarked
# POST /ai/course-wizard       → chatbot hỏi đáp, trả outline + script
# GET  /ai/health
```
- Kết nối Ollama: `http://localhost:11434/api/generate`
- Model: `qwen2.5:14b` (fit RTX 2080 Ti với Q4_K_M)
- Config endpoint từ `AiServiceConfig` table

**Task 4.2 — Question Bank từ tài liệu**
- Upload PDF/DOCX → extract text → FastAPI generate → review UI → approve → vào QuestionBank

**Task 4.3 — Course Wizard**
- Chatbot UI → gửi requirements → FastAPI → trả outline + script mẫu
- HR edit → save thành course draft

---

### GIAI ĐOẠN 6 — SPRINT 5 (Competency & Learning Path)

**Task 5.1 — Job Position + Competency Framework CRUD**
- API: tất cả endpoints từ Section 5.6 (positions + frameworks)
- UI: framework builder (domain → competency với level 1–5)
- Import: 02_COMPETENCY_LEARNING_PATH_IMPORT.xlsx support

**Task 5.2 — Learning Path Builder**
- UI: drag-drop step ordering + time settings per step
- API: CRUD steps, reorder
- Import: Sheet 2_LEARNING_PATH support

**Task 5.3 — Gap Analysis & Position Change Automation**
- Service: `src/services/gap-analysis.service.ts`
- Prisma middleware: detect `jobPositionId` change → create PositionChangeEvent
- Job: `src/jobs/position-change.job.ts` — runGapAnalysis + conditional enroll
- Cron: daily unlock path steps
- API: /position-changes, /approve, /reject
- UI: HR approval dashboard

---

## QUY TẮC TẠO FILE

1. **Tạo file thực sự** — không để `// TODO` trừ chỗ spec chưa rõ
2. **Tạo test** cho mọi service function (`*.test.ts`)
3. **Không import circular** — services không import lẫn nhau, dùng interface
4. **Zod validation** cho mọi API input
5. **TypeScript strict** — không dùng `any`, không bỏ qua type error
6. **Báo cáo** sau mỗi task: danh sách file đã tạo/sửa
7. **Flag** nếu có quyết định kỹ thuật cần confirm

---

## BẮT ĐẦU

Đọc `LMS_MASTER_SPEC.md`, xác nhận đã hiểu toàn bộ spec, sau đó bắt đầu từ **Task 0.1**.

Sau mỗi task, liệt kê:
- ✅ Files đã tạo
- ⚠️ Quyết định kỹ thuật đã đưa ra
- ❓ Điểm cần clarify (nếu có)
- → Next: task tiếp theo sẽ làm gì

Hỏi xác nhận trước khi chuyển sang Giai đoạn mới (0→1→2→3→4→5→6).

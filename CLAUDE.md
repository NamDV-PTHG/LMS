# CLAUDE.md — LMS Tập đoàn

> File này cung cấp context cho Claude CLI khi làm việc với dự án LMS.
> Đọc kỹ trước khi thực hiện bất kỳ task nào.

---

## Tổng quan dự án

Hệ thống LMS (Learning Management System) cho mô hình tập đoàn gồm nhiều công ty con. Stack chính:

- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Next.js API Routes + Prisma ORM
- **AI Service:** FastAPI (Python) — kết nối LLM server riêng qua Ollama
- **Database:** PostgreSQL
- **Deploy:** PM2 + GitHub Actions + Ansible (Windows Server)

Spec đầy đủ: `specs/LMS_SPEC_V1.0.md`
Schema Prisma: `packages/api/prisma/schema.prisma`

---

## Nguyên tắc bắt buộc — KHÔNG được vi phạm

### 1. Tenant Isolation
- Mọi query PHẢI filter theo `company_id` — không có ngoại lệ
- `company_id` luôn lấy từ `req.companyId` (inject bởi middleware) — KHÔNG từ `req.body`
- Middleware `tenantGuard` phải được apply cho mọi route trừ `/api/auth/*`

### 2. Role-based Access
- Dùng decorator/middleware `requireRole(...)` trước mọi handler
- Không hardcode role check trong business logic — phải qua `rbac.ts`
- `group_admin` bypass tenant guard nhưng vẫn phải log access

### 3. AI Service
- Mọi call đến LLM đều qua `ai-service/` (FastAPI) — KHÔNG gọi Ollama trực tiếp từ Next.js
- Config kết nối AI đọc từ bảng `AiServiceConfig` trong DB (có thể thay đổi qua UI)
- Fallback graceful nếu AI service down — không crash main app

### 4. Query 3 nguồn khóa học
- Learner dashboard PHẢI hợp nhất 3 nguồn: `group_publish` + `learning_group` + `company_assign`
- Dùng raw SQL với UNION (xem spec section 8) — Prisma không handle được UNION tốt
- Cache kết quả 60s với Redis nếu có, fallback DB nếu không

### 5. Thông báo UI — KHÔNG dùng alert() / confirm() / prompt()
- **TUYỆT ĐỐI KHÔNG** dùng `alert()`, `confirm()`, `prompt()` hoặc bất kỳ dialog của trình duyệt
- Mọi thông báo thành công / lỗi / cảnh báo / thông tin đều phải dùng **Toast system** (`useToast` từ `@/components/ui/toast`)
- Mọi hộp thoại xác nhận phải dùng **modal component** (custom dialog, không dùng `confirm()`)
- API: `const { toast } = useToast(); toast('success' | 'error' | 'info' | 'warning', 'Nội dung thông báo')`
- Toast tự động tắt sau 4 giây; hiển thị tối đa 5 toast cùng lúc
- `ToastProvider` đã được wrap trong `(dashboard)/layout.tsx` — dùng ngay không cần config thêm

### 6. Build và restart sau mỗi lần sửa code — BẮT BUỘC

Sau khi sửa bất kỳ file source nào (`.ts`, `.tsx`, `.css`, schema Prisma, env, config), **PHẢI thực hiện đủ các bước sau trước khi kết thúc task**:

```bash
# Nếu có thay đổi Prisma schema:
npx prisma db push --schema=prisma/schema.prisma
npx prisma generate --schema=prisma/schema.prisma   # chạy sau khi stop PM2 nếu cần

# Luôn build lại:
npm run build

# Luôn restart web:
pm2 restart lms-web
```

**Quy tắc cụ thể:**
- Sửa file `.ts` / `.tsx` / `.css` → `npm run build` + `pm2 restart lms-web`
- Sửa `prisma/schema.prisma` → `prisma db push` → `prisma generate` (stop PM2 trước nếu lỗi EPERM) → `npm run build` → `pm2 restart lms-web`
- Sửa `.env` → `pm2 restart lms-web --update-env`
- KHÔNG để task kết thúc khi web chưa được restart — người dùng cần thấy kết quả ngay

**Kiểm tra sau restart:** chạy `pm2 list` để xác nhận `lms-web` có status `online`.

---

### 7. Ghi nhật ký thay đổi vào `deploy.md`
- Sau MỖI lần thực hiện thay đổi code, cấu hình, migration, hoặc deploy — BẮT BUỘC ghi vào `deploy.md` ở root project
- Không được bỏ qua bước này dù thay đổi nhỏ
- Format mỗi entry:

```markdown
## [YYYY-MM-DD HH:MM] <Tiêu đề ngắn gọn>

**Loại:** feature | fix | migration | config | deploy | refactor

**Các thay đổi:**
- Mô tả file/component đã sửa và lý do
- ...

**Kết quả:**
- Trạng thái sau khi áp dụng (thành công / lỗi / cần theo dõi)
- Lệnh đã chạy nếu có (migrate, build, restart...)

**Lưu ý / Rủi ro:**
- Ghi nếu có breaking change, dependency mới, hoặc cần rollback plan
```

- Ghi theo thứ tự mới nhất lên đầu file (`deploy.md`)
- Nếu `deploy.md` chưa tồn tại — tạo mới với header và entry đầu tiên

---

## Cấu trúc thư mục

```
lms/
├── apps/
│   ├── web/          # Next.js 14
│   └── ai-service/   # FastAPI
├── packages/
│   └── api/          # shared backend logic, Prisma schema
├── specs/            # tài liệu spec
├── prompts/          # prompt files cho Claude CLI
└── CLAUDE.md         # file này
```

---

## Conventions

### TypeScript
```typescript
// ✅ Đúng — luôn type explicit
async function getCourses(companyId: string, userId: string): Promise<Course[]>

// ❌ Sai
async function getCourses(companyId, userId)
```

### API Response format
```typescript
// Success
{ success: true, data: T, meta?: { total, page, limit } }

// Error
{ success: false, error: string, code: string }
```

### Prisma queries
```typescript
// ✅ Luôn include companyId filter
await prisma.course.findMany({
  where: {
    ownerCompanyId: companyId,  // BẮT BUỘC
    status: 'published'
  }
})

// ❌ Không bao giờ query không có tenant filter
await prisma.course.findMany({ where: { status: 'published' } })
```

### Error handling
```typescript
// Dùng custom AppError
throw new AppError('COURSE_NOT_FOUND', 'Không tìm thấy khóa học', 404)
```

---

## AI Service Config

Kết nối AI được cấu hình động qua bảng `AiServiceConfig`. Khi cần gọi AI:

```python
# ai-service/services/llm_client.py
config = await get_ai_config("question_generator")  # lấy từ DB
response = await call_ollama(
    base_url=config.base_url,     # ví dụ: http://192.168.1.100:11434
    model=config.model,           # ví dụ: qwen2.5:14b
    prompt=prompt,
    temperature=config.temperature
)
```

**Không hardcode URL hoặc model name** — luôn đọc từ config.

---

## Thứ tự implement theo Sprint

**Sprint 1 (Tuần 1–3):** Auth → Organizations → Users → Course CRUD cơ bản
**Sprint 2 (Tuần 4–6):** Lesson player → Progress → Quiz engine → Certificate
**Sprint 3 (Tuần 7–9):** Learning Groups → Reports → AI Config UI
**Sprint 4 (Tuần 10–12):** AI Question Generator → Question Bank → Course Wizard

---

## Lệnh hay dùng

```bash
# Dev
npm run dev              # Next.js
cd apps/ai-service && uvicorn main:app --reload  # FastAPI

# DB
npx prisma migrate dev   # tạo migration
npx prisma db seed       # seed data
npx prisma studio        # GUI

# Test
npm run test             # unit tests
npm run test:e2e         # e2e tests
```

---

## Khi không chắc về yêu cầu

1. Đọc `specs/LMS_SPEC_V1.0.md` section liên quan
2. Nếu vẫn không rõ — implement phần đơn giản nhất, comment `// TODO: clarify with team`
3. Không tự sáng tạo business logic ngoài spec

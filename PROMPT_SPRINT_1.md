# PROMPT_SPRINT_1.md — Auth, Organizations, Users, Course CRUD

> Sử dụng với Claude CLI: `claude --context CLAUDE.md PROMPT_SPRINT_1.md`
> Đọc `specs/LMS_SPEC_V1.0.md` và `CLAUDE.md` trước khi bắt đầu.

---

## Mục tiêu Sprint 1

Xây dựng nền tảng hệ thống: xác thực, cấu trúc tổ chức, quản lý người dùng, và CRUD khóa học cơ bản.

---

## Task 1.1 — Khởi tạo dự án & Database

### Yêu cầu
Tạo cấu trúc thư mục đầy đủ theo spec, khởi tạo Next.js 14 App Router với TypeScript, cài đặt dependencies, tạo Prisma schema từ spec section 3.

### Dependencies cần cài
```json
{
  "dependencies": {
    "next": "14.x",
    "@prisma/client": "latest",
    "next-auth": "^4.24",
    "bcryptjs": "^2.4",
    "jsonwebtoken": "^9.0",
    "zod": "^3.22",
    "axios": "^1.6",
    "@tanstack/react-query": "^5.0",
    "shadcn-ui": "latest",
    "tailwindcss": "^3.4",
    "winston": "^3.11"
  },
  "devDependencies": {
    "prisma": "latest",
    "typescript": "^5.3",
    "@types/node": "^20",
    "@types/bcryptjs": "^2.4",
    "@types/jsonwebtoken": "^9.0"
  }
}
```

### Checklist
- [ ] Tạo `packages/api/prisma/schema.prisma` với toàn bộ models từ spec section 3
- [ ] Chạy `prisma migrate dev --name init`
- [ ] Tạo `packages/api/prisma/seed.ts` với dữ liệu mẫu:
  - 1 Organization type=group (tập đoàn)
  - 2 Organization type=company (Công ty A, Công ty B)
  - 3 Organization type=department (2 phòng ban CT A, 1 CT B)
  - 1 user group_admin
  - 1 user group_hrm
  - 2 user company_admin (1 mỗi CT)
  - 2 user instructor
  - 4 user learner
- [ ] Tạo file `.env.example` theo spec section 6
- [ ] Tạo `ecosystem.config.js` cho PM2

---

## Task 1.2 — Middleware nền tảng

### Yêu cầu
Tạo 3 middleware dùng xuyên suốt ứng dụng.

### File: `packages/api/middleware/auth.ts`
```typescript
// Verify JWT từ Authorization header hoặc cookie
// Inject req.user = { id, email, roles: UserRole[] }
// Throw 401 nếu token invalid/expired
```

### File: `packages/api/middleware/tenant-guard.ts`
```typescript
// Logic theo spec section 7:
// - group_admin: bypass, set req.companyId = null (có thể xem mọi CT)
// - Còn lại: verify user có quyền truy cập companyId được request
// - Inject req.companyId vào request
// - Throw 403 nếu không có quyền
```

### File: `packages/api/middleware/rbac.ts`
```typescript
// Factory function: requireRole(...roles: RoleType[])
// Kiểm tra req.user.roles có chứa role phù hợp không
// Có tính đến organizationId context
// Ví dụ: requireRole('company_admin', 'hr_manager')
```

### File: `packages/api/lib/app-error.ts`
```typescript
// Custom error class
// AppError(code: string, message: string, statusCode: number)
// Global error handler cho Next.js API routes
```

---

## Task 1.3 — Authentication API

### Endpoints cần implement
```
POST /api/auth/login
POST /api/auth/logout  
POST /api/auth/refresh
GET  /api/auth/me
```

### Yêu cầu chi tiết

**POST /api/auth/login**
- Body: `{ email, password }`
- Verify password với bcrypt
- Trả về: `{ accessToken, refreshToken, user: { id, email, fullName, roles } }`
- accessToken expires: 1h
- refreshToken expires: 7d
- Lưu refreshToken vào HttpOnly cookie

**GET /api/auth/me**
- Require: auth middleware
- Trả về: user info + tất cả roles + organizations của user đó

### UI cần tạo
- `app/(auth)/login/page.tsx` — form đăng nhập
- `app/(auth)/layout.tsx` — layout centered, không có sidebar
- `lib/auth.ts` — next-auth config hoặc custom auth hook
- `components/providers/auth-provider.tsx`

---

## Task 1.4 — Organizations API & UI

### Endpoints
```
GET    /api/organizations           # Middleware: auth + tenantGuard
POST   /api/organizations           # Middleware: requireRole('group_admin')
GET    /api/organizations/:id
PATCH  /api/organizations/:id
GET    /api/organizations/:id/tree  # Trả về org tree dạng nested JSON
```

### Service: `packages/api/services/organization.service.ts`
```typescript
// getOrgTree(rootId: string): Promise<OrgNode[]>
// Trả về nested structure: { id, name, type, children: OrgNode[] }

// getUsersByOrg(orgId: string, companyId: string): Promise<User[]>
// Phải verify companyId match với orgId (isolation)
```

### UI cần tạo
- `app/(dashboard)/organizations/page.tsx` — danh sách công ty (chỉ group_admin thấy)
- `app/(dashboard)/organizations/[id]/page.tsx` — chi tiết + org chart
- `components/organizations/org-tree.tsx` — visualize org chart dạng tree

---

## Task 1.5 — Users API & UI

### Endpoints
```
GET    /api/users                   # filter: companyId, deptId, role
POST   /api/users                   # company_admin trở lên
GET    /api/users/:id
PATCH  /api/users/:id
POST   /api/users/:id/roles
DELETE /api/users/:id/roles/:roleId
POST   /api/users/import-csv        # bulk import
```

### Validation (dùng Zod)
```typescript
const CreateUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  employeeCode: z.string().optional(),
  jobTitle: z.string().optional(),
  jobLevel: z.enum(['staff', 'senior', 'manager', 'director', 'c_level']).optional(),
  organizationId: z.string().uuid(),
  role: z.enum(['company_admin', 'hr_manager', 'instructor', 'learner'])
})
```

### UI cần tạo
- `app/(dashboard)/users/page.tsx` — data table với filter/search
- `app/(dashboard)/users/[id]/page.tsx` — user profile + roles
- `components/users/user-form.tsx` — create/edit form
- `components/users/import-csv-modal.tsx` — bulk import

---

## Task 1.6 — Course CRUD cơ bản

### Endpoints
```
GET    /api/courses                 # Middleware: tenantGuard
POST   /api/courses                 # Middleware: requireRole('company_admin', 'instructor')
GET    /api/courses/:id
PATCH  /api/courses/:id
DELETE /api/courses/:id             # chỉ owner và company_admin

GET    /api/courses/:id/sections
POST   /api/courses/:id/sections
PATCH  /api/courses/:id/sections/:sectionId
DELETE /api/courses/:id/sections/:sectionId

POST   /api/courses/:id/sections/:sectionId/lessons
PATCH  /api/courses/:id/sections/:sectionId/lessons/:lessonId
DELETE /api/courses/:id/sections/:sectionId/lessons/:lessonId
```

### Lưu ý quan trọng
- Khi tạo course: tự động set `ownerCompanyId = req.companyId`
- Upload video/tài liệu: lưu vào `STORAGE_LOCAL_PATH`, trả về URL
- Section và Lesson phải verify thuộc course của công ty hiện tại trước khi edit/delete

### UI cần tạo
- `app/(dashboard)/courses/page.tsx` — danh sách khóa học + filter status
- `app/(dashboard)/courses/new/page.tsx` — tạo khóa học mới
- `app/(dashboard)/courses/[id]/page.tsx` — course builder (kéo thả section/lesson)
- `components/course/section-builder.tsx` — quản lý section
- `components/course/lesson-editor.tsx` — editor theo lesson type
- `components/course/video-uploader.tsx` — upload video với progress bar

---

## Task 1.7 — AI Service Config UI

### Yêu cầu
Admin cần cấu hình kết nối đến AI server qua giao diện (không cần sửa .env).

### Endpoints
```
GET    /api/admin/ai-configs
POST   /api/admin/ai-configs
PATCH  /api/admin/ai-configs/:id
POST   /api/admin/ai-configs/:id/test-connection
```

**POST /api/admin/ai-configs/:id/test-connection**
```typescript
// Gọi thử đến Ollama: GET {baseUrl}/api/tags
// Nếu thành công: trả về { connected: true, models: string[] }
// Nếu fail: trả về { connected: false, error: string }
```

### UI cần tạo
- `app/(dashboard)/admin/ai-configs/page.tsx`
- Form với fields: name, baseUrl, model, apiKey (optional), temperature, maxTokens
- Nút "Test kết nối" — hiển thị kết quả ngay lập tức
- Dropdown chọn model (load từ kết quả test)

---

## Định dạng output mong muốn

Với mỗi task, Claude CLI cần:

1. **Tạo file** với đầy đủ code, không để `// TODO` trừ những chỗ spec chưa rõ
2. **Tạo file test** tương ứng (`*.test.ts`) cho service layer
3. **Báo cáo** danh sách file đã tạo/sửa
4. **Flag** nếu có quyết định kỹ thuật cần confirm với team

## Thứ tự thực hiện

```
1.1 (Setup) → 1.2 (Middleware) → 1.3 (Auth) → 1.4 (Orgs) → 1.5 (Users) → 1.6 (Courses) → 1.7 (AI Config)
```

Các task phụ thuộc theo thứ tự — không bỏ qua bước nào.

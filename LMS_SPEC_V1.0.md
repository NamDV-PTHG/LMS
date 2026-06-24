# LMS SPEC V1.0 — Hệ thống đào tạo trực tuyến tập đoàn

> **Stack:** Next.js 14 App Router · Prisma · PostgreSQL · FastAPI (AI Service) · PM2 · GitHub Actions · Ansible  
> **Phiên bản:** 1.0 — LMS Core  
> **Ngày:** 2026-06-15

---

## 1. Tổng quan hệ thống

### 1.1 Mô hình tổ chức

```
Tập đoàn (Group)
├── Công ty A
│   ├── Phòng ban A1
│   └── Phòng ban A2
├── Công ty B
│   └── Phòng ban B1
└── Công ty C
```

Hệ thống phục vụ mô hình **1 tập đoàn → nhiều công ty con (tenant cố định)**. Mọi dữ liệu được cô lập theo `company_id`. Không có dữ liệu "vô chủ" ở tầng tập đoàn.

### 1.2 Ba cơ chế giao khóa học

| # | Cơ chế | Người thực hiện | Phạm vi |
|---|--------|-----------------|---------|
| ① | Publish xuống công ty | Group Admin | Toàn bộ nhân viên CT nhận |
| ② | Assign vào Learning Group xuyên CT | Group HRM | Thành viên được chọn từ nhiều CT |
| ③ | Assign nội bộ công ty | Company Admin / HR Manager | Toàn CT / phòng ban / cá nhân |

### 1.3 Quy tắc bất biến (hard rules)

- Mọi entity đều có `owner_company_id` — không NULL
- Query luôn filter theo `company_id` của user — không ngoại lệ ở tầng service
- Nội dung "chung" là bản tham chiếu (`course_publications`) — không copy dữ liệu
- Group HRM **không thấy** danh sách nhân viên toàn công ty — chỉ thấy user trong group của mình
- Completion của Learning Group chỉ Group HRM và Group Admin xem được

---

## 2. Roles & Permissions

### 2.1 Danh sách roles (6 roles)

| Role | Tầng | Mô tả |
|------|------|-------|
| `group_admin` | Tập đoàn | Toàn quyền hệ thống |
| `group_hrm` | Tập đoàn | Quản lý Learning Group xuyên công ty |
| `company_admin` | Công ty | Toàn quyền trong công ty mình |
| `hr_manager` | Công ty | Assign khóa học, theo dõi compliance |
| `instructor` | Công ty | Tạo/chỉnh sửa nội dung, tạo câu hỏi |
| `learner` | Cá nhân | Học và làm bài kiểm tra |

> Một user có thể có nhiều roles ở các tổ chức khác nhau (bảng `user_roles`).

### 2.2 Ma trận quyền

| Chức năng | group_admin | group_hrm | company_admin | hr_manager | instructor | learner |
|-----------|:-----------:|:---------:|:-------------:|:----------:|:----------:|:-------:|
| Tạo/xóa công ty con | ✓ | — | — | — | — | — |
| Quản lý org chart | ✓ | — | ✓ CT mình | — | — | — |
| Xem danh sách nhân viên | ✓ toàn TĐ | △ trong group | ✓ CT mình | ✓ CT mình | — | — |
| Tạo khóa học | — | ✓ cho group | ✓ CT mình | — | ✓ CT mình | — |
| Publish khóa học xuống CT | ✓ | — | — | — | — | — |
| Assign khóa học nội bộ CT | — | — | ✓ | ✓ | — | — |
| Assign khóa học cho Learning Group | — | ✓ | — | — | — | — |
| Chỉnh sửa bài học | — | — | ✓ CT mình | — | ✓ CT mình | — |
| Học & xem nội dung | — | — | — | — | — | ✓ |
| Tạo/xóa Learning Group | ✓ | ✓ | — | — | — | — |
| Thêm/xóa thành viên Learning Group | ✓ | ✓ | — | — | — | — |
| Tạo câu hỏi vào NHCH | — | — | ✓ CT mình | — | ✓ CT mình | — |
| Duyệt câu hỏi (approved) | ✓ | — | ✓ CT mình | — | — | — |
| Upload tài liệu → sinh câu hỏi AI | — | — | ✓ CT mình | — | ✓ CT mình | — |
| Báo cáo toàn tập đoàn | ✓ | — | — | — | — | — |
| Báo cáo Learning Group | ✓ | ✓ | — | — | — | — |
| Báo cáo nội bộ công ty | ✓ | — | ✓ CT mình | ✓ CT mình | — | — |
| Xem completion cá nhân | — | — | — | — | — | ✓ |

---

## 3. Database Schema

### 3.1 Tổ chức

```prisma
model Organization {
  id        String   @id @default(uuid())
  name      String
  type      OrgType  // group | company | department
  parentId  String?
  parent    Organization?  @relation("OrgHierarchy", fields: [parentId], references: [id])
  children  Organization[] @relation("OrgHierarchy")
  metadata  Json?    // logo, address, tax_code, etc.
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users           UserRole[]
  courses         Course[]
  questionBanks   QuestionBank[]
  sourceDocuments SourceDocument[]
  coursePublicationsReceived CoursePublication[] @relation("TargetCompany")
}

enum OrgType {
  group
  company
  department
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  fullName     String
  avatarUrl    String?
  employeeCode String?
  jobTitle     String?
  jobLevel     String?  // staff | senior | manager | director | c_level
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  roles              UserRole[]
  groupMemberships   GroupMember[]
  enrollments        Enrollment[]
  questionAuthors    Question[]
  courseAuthors      Course[]
}

model UserRole {
  id             String       @id @default(uuid())
  userId         String
  role           RoleType
  organizationId String
  assignedAt     DateTime     @default(now())
  assignedBy     String?

  user           User         @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, role, organizationId])
}

enum RoleType {
  group_admin
  group_hrm
  company_admin
  hr_manager
  instructor
  learner
}
```

### 3.2 Khóa học & Nội dung

```prisma
model Course {
  id              String       @id @default(uuid())
  ownerCompanyId  String
  ownerCompany    Organization @relation(fields: [ownerCompanyId], references: [id])
  createdById     String
  createdBy       User         @relation(fields: [createdById], references: [id])
  title           String
  description     String?
  thumbnailUrl    String?
  estimatedHours  Float?
  level           CourseLevel  @default(beginner)
  status          CourseStatus @default(draft)
  prerequisiteIds String[]     // course IDs
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  sections        Section[]
  publications    CoursePublication[]
  groupCourses    GroupCourse[]
  assignments     CourseAssignment[]
  enrollments     Enrollment[]
}

enum CourseLevel { beginner intermediate advanced }
enum CourseStatus { draft published archived }

model Section {
  id          String   @id @default(uuid())
  courseId    String
  course      Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title       String
  orderIndex  Int
  createdAt   DateTime @default(now())

  lessons     Lesson[]
}

model Lesson {
  id           String      @id @default(uuid())
  sectionId    String
  section      Section     @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  title        String
  type         LessonType  // video | document | quiz | scorm
  content      Json?       // URL, text, config tùy type
  orderIndex   Int
  durationMins Int?
  isRequired   Boolean     @default(true)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  quizConfig   QuizConfig?
  progresses   LessonProgress[]
}

enum LessonType { video document quiz scorm }

// ① Publish xuống công ty
model CoursePublication {
  id              String       @id @default(uuid())
  courseId        String
  course          Course       @relation(fields: [courseId], references: [id])
  targetCompanyId String
  targetCompany   Organization @relation("TargetCompany", fields: [targetCompanyId], references: [id])
  publishedById   String       // phải là group_admin
  deadline        DateTime?
  revokedAt       DateTime?
  publishedAt     DateTime     @default(now())

  @@unique([courseId, targetCompanyId])
}

// ③ Assign nội bộ công ty
model CourseAssignment {
  id              String       @id @default(uuid())
  courseId        String
  course          Course       @relation(fields: [courseId], references: [id])
  targetCompanyId String?      // toàn công ty
  targetDeptId    String?      // phòng ban
  targetUserId    String?      // cá nhân
  assignedById    String
  deadline        DateTime?
  isMandatory     Boolean      @default(false)
  assignedAt      DateTime     @default(now())
}
```

### 3.3 Learning Group (② xuyên công ty)

```prisma
model LearningGroup {
  id          String          @id @default(uuid())
  name        String
  description String?
  type        GroupType       // manual | rule_based
  ruleJson    Json?           // { conditions: [...], logic: "AND"|"OR" }
  createdById String          // group_hrm hoặc group_admin
  isActive    Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  members     GroupMember[]
  courses     GroupCourse[]
}

enum GroupType { manual rule_based }

model GroupMember {
  id          String        @id @default(uuid())
  groupId     String
  group       LearningGroup @relation(fields: [groupId], references: [id])
  userId      String
  user        User          @relation(fields: [userId], references: [id])
  companyId   String        // công ty gốc của member
  addedById   String        // group_hrm
  addedAt     DateTime      @default(now())
  removedAt   DateTime?

  @@unique([groupId, userId])
}

model GroupCourse {
  id          String        @id @default(uuid())
  groupId     String
  group       LearningGroup @relation(fields: [groupId], references: [id])
  courseId    String
  course      Course        @relation(fields: [courseId], references: [id])
  assignedById String
  deadline    DateTime?
  assignedAt  DateTime      @default(now())

  @@unique([groupId, courseId])
}
```

### 3.4 Tiến độ học tập

```prisma
model Enrollment {
  id          String           @id @default(uuid())
  userId      String
  user        User             @relation(fields: [userId], references: [id])
  courseId    String
  course      Course           @relation(fields: [courseId], references: [id])
  source      EnrollmentSource // group_publish | learning_group | company_assign
  sourceRefId String?          // id của publication/groupCourse/assignment
  enrolledAt  DateTime         @default(now())
  completedAt DateTime?
  deadline    DateTime?

  lessonProgresses LessonProgress[]
  quizAttempts     QuizAttempt[]
  certificate      Certificate?

  @@unique([userId, courseId])
}

enum EnrollmentSource { group_publish learning_group company_assign self }

model LessonProgress {
  id           String     @id @default(uuid())
  enrollmentId String
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id])
  lessonId     String
  lesson       Lesson     @relation(fields: [lessonId], references: [id])
  status       ProgressStatus @default(not_started)
  progressPct  Float      @default(0)  // 0-100
  startedAt    DateTime?
  completedAt  DateTime?
  timeSpentSec Int        @default(0)

  @@unique([enrollmentId, lessonId])
}

enum ProgressStatus { not_started in_progress completed }

model Certificate {
  id           String     @id @default(uuid())
  enrollmentId String     @unique
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id])
  code         String     @unique @default(cuid())
  issuedAt     DateTime   @default(now())
  expiresAt    DateTime?
  pdfUrl       String?
}
```

### 3.5 Ngân hàng câu hỏi

```prisma
model QuestionBank {
  id             String       @id @default(uuid())
  ownerCompanyId String
  ownerCompany   Organization @relation(fields: [ownerCompanyId], references: [id])
  name           String
  description    String?
  createdById    String
  createdAt      DateTime     @default(now())

  questions      Question[]
}

model Question {
  id           String         @id @default(uuid())
  bankId       String
  bank         QuestionBank   @relation(fields: [bankId], references: [id])
  content      String
  type         QuestionType
  difficulty   Difficulty     @default(medium)
  explanation  String?
  tags         String[]
  status       QuestionStatus @default(draft)
  sourceDocId  String?        // NULL nếu tạo thủ công
  sourceDoc    SourceDocument? @relation(fields: [sourceDocId], references: [id])
  createdById  String
  createdBy    User           @relation(fields: [createdById], references: [id])
  approvedById String?
  approvedAt   DateTime?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  options      QuestionOption[]
}

enum QuestionType  { mcq true_false fill_blank essay }
enum Difficulty   { easy medium hard }
enum QuestionStatus { draft review approved }

model QuestionOption {
  id          String   @id @default(uuid())
  questionId  String
  question    Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  content     String
  isCorrect   Boolean  @default(false)
  orderIndex  Int

  @@index([questionId])
}

model QuizConfig {
  id              String   @id @default(uuid())
  lessonId        String   @unique
  lesson          Lesson   @relation(fields: [lessonId], references: [id])
  bankIds         String[] // source banks
  totalQuestions  Int
  easyCount       Int      @default(0)
  mediumCount     Int      @default(0)
  hardCount       Int      @default(0)
  passingScore    Float    @default(70)
  timeLimitMins   Int?
  maxAttempts     Int      @default(3)
  shuffleQuestions Boolean @default(true)
  shuffleOptions   Boolean @default(true)
}

model QuizAttempt {
  id           String        @id @default(uuid())
  enrollmentId String
  enrollment   Enrollment    @relation(fields: [enrollmentId], references: [id])
  lessonId     String
  attemptNo    Int
  score        Float
  isPassed     Boolean
  answers      Json          // [{ questionId, selectedOptionIds, isCorrect }]
  startedAt    DateTime      @default(now())
  submittedAt  DateTime?
}

// Tài liệu nguồn để AI sinh câu hỏi
model SourceDocument {
  id             String       @id @default(uuid())
  ownerCompanyId String
  ownerCompany   Organization @relation(fields: [ownerCompanyId], references: [id])
  filename       String
  mimeType       String
  storageUrl     String
  extractedText  String?      // text sau khi parse
  status         DocStatus    @default(pending)
  uploadedById   String
  uploadedAt     DateTime     @default(now())
  processedAt    DateTime?

  generatedQuestions Question[]
}

enum DocStatus { pending processing done failed }
```

### 3.6 AI Service Config

```prisma
model AiServiceConfig {
  id          String   @id @default(uuid())
  name        String   @unique  // "question_generator" | "script_generator" | "quiz_reviewer"
  baseUrl     String   // http://ai-server:11434
  model       String   // "qwen2.5:14b"
  apiKey      String?  // optional nếu server nội bộ
  temperature Float    @default(0.3)
  maxTokens   Int      @default(4096)
  isActive    Boolean  @default(true)
  updatedAt   DateTime @updatedAt
  updatedById String?
}
```

---

## 4. API Endpoints

### 4.1 Auth

```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
```

### 4.2 Organizations

```
GET    /api/organizations                    # group_admin: toàn TĐ
POST   /api/organizations                    # group_admin
GET    /api/organizations/:id
PATCH  /api/organizations/:id
GET    /api/organizations/:id/users          # users của org đó
POST   /api/organizations/:id/users          # thêm user vào org
```

### 4.3 Users & Roles

```
GET    /api/users                            # filter theo company
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
POST   /api/users/:id/roles                  # assign role
DELETE /api/users/:id/roles/:roleId
```

### 4.4 Courses

```
GET    /api/courses                          # danh sách theo context user
POST   /api/courses                          # company_admin / instructor
GET    /api/courses/:id
PATCH  /api/courses/:id
DELETE /api/courses/:id

GET    /api/courses/:id/sections
POST   /api/courses/:id/sections
PATCH  /api/courses/:id/sections/:sectionId
DELETE /api/courses/:id/sections/:sectionId

POST   /api/courses/:id/sections/:sectionId/lessons
PATCH  /api/courses/:id/sections/:sectionId/lessons/:lessonId
DELETE /api/courses/:id/sections/:sectionId/lessons/:lessonId

POST   /api/courses/:id/publish              # group_admin: publish xuống CT
DELETE /api/courses/:id/publish/:companyId   # thu hồi publish
POST   /api/courses/:id/assign               # company_admin: assign nội bộ
```

### 4.5 Learning Groups

```
GET    /api/learning-groups                  # group_admin, group_hrm
POST   /api/learning-groups
GET    /api/learning-groups/:id
PATCH  /api/learning-groups/:id
DELETE /api/learning-groups/:id

GET    /api/learning-groups/:id/members
POST   /api/learning-groups/:id/members      # thêm thủ công
DELETE /api/learning-groups/:id/members/:userId

GET    /api/learning-groups/:id/courses
POST   /api/learning-groups/:id/courses      # assign khóa học
DELETE /api/learning-groups/:id/courses/:courseId
```

### 4.6 Learner

```
GET    /api/my/courses                       # 3 nguồn hợp nhất
GET    /api/my/courses/:courseId
POST   /api/my/courses/:courseId/enroll
GET    /api/my/courses/:courseId/lessons/:lessonId
POST   /api/my/courses/:courseId/lessons/:lessonId/progress
POST   /api/my/courses/:courseId/lessons/:lessonId/quiz/start
POST   /api/my/courses/:courseId/lessons/:lessonId/quiz/submit
GET    /api/my/certificates
```

### 4.7 Question Bank

```
GET    /api/question-banks                   # theo company
POST   /api/question-banks
GET    /api/question-banks/:id/questions
POST   /api/question-banks/:id/questions     # tạo thủ công
PATCH  /api/question-banks/:id/questions/:qId
POST   /api/question-banks/:id/questions/:qId/approve

POST   /api/question-banks/:id/import-document  # upload → AI sinh câu hỏi
GET    /api/question-banks/:id/import-jobs/:jobId
```

### 4.8 Reports

```
GET    /api/reports/group/overview           # group_admin
GET    /api/reports/group/learning-groups    # group_admin, group_hrm
GET    /api/reports/company/:companyId/overview    # company_admin, hr_manager
GET    /api/reports/company/:companyId/compliance  # mandatory course tracking
GET    /api/reports/company/:companyId/users/:userId
```

### 4.9 AI Config (Admin)

```
GET    /api/admin/ai-configs
POST   /api/admin/ai-configs
PATCH  /api/admin/ai-configs/:id
POST   /api/admin/ai-configs/:id/test-connection
```

---

## 5. Cấu trúc thư mục dự án

```
lms/
├── apps/
│   ├── web/                          # Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx        # sidebar, header, auth guard
│   │   │   │   ├── my-courses/       # learner
│   │   │   │   ├── courses/          # admin/instructor
│   │   │   │   ├── learning-groups/  # group_admin, group_hrm
│   │   │   │   ├── question-banks/
│   │   │   │   ├── organizations/
│   │   │   │   ├── users/
│   │   │   │   └── reports/
│   │   │   └── api/                  # Next.js API routes → proxy to backend
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── course/
│   │   │   ├── quiz/
│   │   │   └── reports/
│   │   └── lib/
│   │       ├── auth.ts               # next-auth config
│   │       ├── api-client.ts
│   │       └── permissions.ts        # client-side permission check
│   │
│   └── ai-service/                   # FastAPI
│       ├── main.py
│       ├── routers/
│       │   ├── question_generator.py
│       │   └── script_generator.py   # Sprint 5+
│       ├── services/
│       │   ├── llm_client.py         # Ollama API client
│       │   ├── document_parser.py    # PDF/DOCX/PPTX
│       │   └── prompt_builder.py
│       └── config.py                 # AI server config
│
├── packages/
│   └── api/                          # Node.js / Next.js API handlers
│       ├── middleware/
│       │   ├── auth.ts               # JWT verify
│       │   ├── tenant-guard.ts       # company isolation
│       │   └── rbac.ts               # role-based access
│       ├── services/
│       │   ├── course.service.ts
│       │   ├── enrollment.service.ts
│       │   ├── question.service.ts
│       │   └── report.service.ts
│       └── prisma/
│           ├── schema.prisma
│           └── seed.ts
│
├── .env.example
├── CLAUDE.md                         # context cho Claude CLI
└── ecosystem.config.js               # PM2
```

---

## 6. Biến môi trường (.env.example)

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/lms_db"

# Auth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"

# AI Service Connection
AI_SERVICE_URL="http://ai-server:8000"        # FastAPI service
AI_SERVICE_API_KEY=""                          # optional

# LLM Server (Ollama - self-hosted)
OLLAMA_BASE_URL="http://llm-server:11434"
OLLAMA_DEFAULT_MODEL="qwen2.5:14b"
OLLAMA_TIMEOUT_SECONDS=120

# Storage (cho video, tài liệu)
STORAGE_PROVIDER="local"                       # local | s3
STORAGE_LOCAL_PATH="./uploads"
STORAGE_BASE_URL="http://localhost:3000/uploads"

# S3 (nếu dùng)
S3_BUCKET=""
S3_REGION=""
S3_ACCESS_KEY=""
S3_SECRET_KEY=""

# App
NODE_ENV="development"
PORT=3000
AI_SERVICE_PORT=8000
```

---

## 7. Tenant Guard Middleware

```typescript
// packages/api/middleware/tenant-guard.ts
// Mọi API route đều phải qua middleware này
// companyId inject vào req — service layer KHÔNG nhận companyId từ body

export async function tenantGuard(req, res, next) {
  const user = req.user; // đã verify JWT
  const requestedCompanyId = req.params.companyId || req.query.companyId;

  if (user.role === 'group_admin') return next(); // bypass

  const allowedCompanies = await getAllowedCompanies(user.id);
  if (requestedCompanyId && !allowedCompanies.includes(requestedCompanyId)) {
    return res.status(403).json({ error: 'Access denied to this company' });
  }

  req.companyId = requestedCompanyId || allowedCompanies[0];
  next();
}
```

---

## 8. Query hợp nhất 3 nguồn khóa học (Learner)

```sql
-- Dùng trong enrollment.service.ts
WITH learner_courses AS (
  -- ① Publish xuống CT
  SELECT c.id, c.title, c.thumbnail_url, 'group_publish' AS source,
         cp.deadline, cp.published_at AS available_from
  FROM courses c
  JOIN course_publications cp ON cp.course_id = c.id
  WHERE cp.target_company_id = $1        -- my_company_id
    AND cp.revoked_at IS NULL
    AND c.status = 'published'

  UNION

  -- ② Learning Group
  SELECT c.id, c.title, c.thumbnail_url, 'learning_group' AS source,
         gc.deadline, gc.assigned_at AS available_from
  FROM courses c
  JOIN group_courses gc ON gc.course_id = c.id
  JOIN group_members gm ON gm.group_id = gc.group_id
  WHERE gm.user_id = $2                  -- my_user_id
    AND gm.removed_at IS NULL
    AND c.status = 'published'

  UNION

  -- ③ Assign nội bộ
  SELECT c.id, c.title, c.thumbnail_url, 'company_assign' AS source,
         ca.deadline, ca.assigned_at AS available_from
  FROM courses c
  JOIN course_assignments ca ON ca.course_id = c.id
  WHERE (ca.target_user_id = $2
      OR ca.target_dept_id = $3          -- my_dept_id
      OR ca.target_company_id = $1)
    AND c.status = 'published'
)
SELECT DISTINCT ON (id) lc.*, e.completed_at, e.id AS enrollment_id
FROM learner_courses lc
LEFT JOIN enrollments e ON e.course_id = lc.id AND e.user_id = $2
ORDER BY id, available_from ASC;
```

---

## 9. Acceptance Criteria

### Sprint 1 (Tuần 1–3)
- [ ] Auth: đăng nhập, JWT refresh, logout
- [ ] Org: CRUD công ty, phòng ban, org chart
- [ ] User: CRUD, assign role, import CSV
- [ ] Course: CRUD cơ bản, upload video/tài liệu

### Sprint 2 (Tuần 4–6)
- [ ] Lesson player (video + document)
- [ ] Progress tracking real-time
- [ ] Quiz engine: random từ NHCH, nhiều loại câu hỏi
- [ ] Certificate tự động khi pass

### Sprint 3 (Tuần 7–9)
- [ ] Learning Group: tạo, quản lý thành viên, assign khóa học
- [ ] Mandatory training + deadline tracking
- [ ] Reports: completion, compliance, individual
- [ ] AI Config: CRUD, test connection

### Sprint 4 (Tuần 10–12)
- [ ] AI sinh câu hỏi từ tài liệu (PDF/DOCX/PPTX)
- [ ] Review & approve workflow câu hỏi
- [ ] NHCH: filter/tag/search, import vào quiz
- [ ] AI Course Wizard (script generator)

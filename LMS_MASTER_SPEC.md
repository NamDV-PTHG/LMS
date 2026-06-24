# LMS MASTER SPEC — Hệ thống đào tạo nội bộ tập đoàn
> Phiên bản tổng hợp V2.0 · Ngày: 2026-06-16  
> Stack: Next.js 14 App Router · Prisma · PostgreSQL · Redis · FastAPI · MinIO · FFmpeg · PM2

---

## MỤC LỤC

1. [Tổng quan hệ thống](#1-tổng-quan)
2. [Kiến trúc & Stack](#2-kiến-trúc)
3. [Mô hình tổ chức & Roles](#3-roles)
4. [Database Schema đầy đủ](#4-schema)
5. [API Endpoints](#5-api)
6. [Bảo mật nội dung](#6-content-security)
7. [Performance & Caching](#7-performance)
8. [Tracking & Analytics](#8-tracking)
9. [Khung năng lực & Lộ trình](#9-competency)
10. [Import & Org Chart](#10-import)
11. [Background Jobs & Cron](#11-jobs)
12. [Cấu hình môi trường](#12-env)
13. [Sprint Plan](#13-sprints)

---

## 1. TỔNG QUAN HỆ THỐNG

### 1.1 Mục tiêu
Hệ thống LMS đào tạo nội bộ cho mô hình **1 tập đoàn → nhiều công ty con**, mỗi công ty có sơ đồ tổ chức, giảng viên và khung năng lực riêng. Hệ thống cần:
- Quản lý nội dung học tập (video, tài liệu, bài giảng) theo cấu trúc phòng ban
- Phân quyền chi tiết theo vị trí trong sơ đồ tổ chức
- Tracking tiến độ học tập và chất lượng nội dung
- Khung năng lực & lộ trình học tự động theo vị trí công việc
- Cấm download mặc định, bảo vệ nội dung bằng HLS + Signed URL + Watermark

### 1.2 Quy mô ban đầu
- Dưới 500 user, tăng dần theo công ty con
- Chạy chung server staging với VIA CRM (cần cấu hình thêm Redis, MinIO)
- GPU RTX 2080 Ti cho LLM offline (Qwen2.5:14b qua Ollama)

### 1.3 Nguyên tắc bất biến — KHÔNG được vi phạm

```
1. TENANT ISOLATION: Mọi query PHẢI filter theo company_id — inject từ middleware, KHÔNG từ body
2. SIGNED URL ONLY: Client không bao giờ nhận URL gốc của file — chỉ Signed URL TTL 20 phút
3. DOWNLOAD BLOCKED: downloadPolicy mặc định = BLOCKED cho mọi asset mới
4. OWNERSHIP CHECK KÉP: Mọi thao tác sửa/xóa verify cả organizationId lẫn role
5. ASYNC TRACKING: Tracking events KHÔNG ghi DB đồng bộ — queue → batch write
6. AI SERVICE ISOLATED: Mọi call LLM qua FastAPI service riêng, không gọi Ollama trực tiếp
```

---

## 2. KIẾN TRÚC & STACK

```
┌─────────────────────────────────────────────────────┐
│  Cloudflare CDN (HLS segments, static assets, TTL 4h)│
└──────────────────────┬──────────────────────────────┘
                       ↓ cache miss
┌─────────────────────────────────────────────────────┐
│  Next.js 14 App Router (API Routes + Server Actions) │
│  Middleware: JWT auth · tenantGuard · rate limit     │
│  100 req/10s per user                                │
└──────┬──────────────┬────────────────┬──────────────┘
       ↓              ↓                ↓
┌──────────┐  ┌───────────────┐  ┌────────────────────┐
│  Redis   │  │  PostgreSQL   │  │  MinIO (S3-compat)  │
│  Cache   │  │  Primary +    │  │  lms-private bucket │
│  + Queue │  │  Read Replica │  │  lms-temp bucket    │
│ (BullMQ) │  │  (reports)    │  │  (auto-delete 24h)  │
└──────────┘  └───────────────┘  └────────────────────┘
                                          ↓
                              ┌─────────────────────┐
                              │  FastAPI AI Service  │
                              │  Ollama Qwen2.5:14b  │
                              │  (RTX 2080 Ti)       │
                              └─────────────────────┘
```

**Packages chính:**
```json
{
  "next": "14.x", "@prisma/client": "latest",
  "next-auth": "^4.24", "bcryptjs": "^2.4",
  "jsonwebtoken": "^9.0", "zod": "^3.22",
  "ioredis": "^5", "bullmq": "^5",
  "xlsx": "^0.18", "multer": "^1.4",
  "@xyflow/react": "latest", "dagre": "^0.8",
  "bullmq": "^5", "node-cron": "^3"
}
```

---

## 3. MÔ HÌNH TỔ CHỨC & ROLES

### 3.1 Cấu trúc tổ chức
```
Tập đoàn (group)
├── Công ty A (company)
│   ├── Phòng HCNS (dept)
│   │   └── Tổ Tuyển dụng (team)
│   └── Phòng Kinh doanh (dept)
└── Công ty B (company)
    └── Phòng Kỹ thuật (dept)
```

### 3.2 Sáu roles — không chồng chéo

| Role | Tầng | Mô tả |
|------|------|-------|
| `group_admin` | Tập đoàn | Toàn quyền hệ thống |
| `group_hrm` | Tập đoàn | Quản lý Learning Group xuyên công ty |
| `company_admin` | Công ty | Toàn quyền trong công ty mình |
| `hr_manager` | Công ty | Assign khóa học, theo dõi compliance |
| `instructor` | Công ty | Tạo/upload nội dung, tạo câu hỏi |
| `learner` | Cá nhân | Học và làm bài kiểm tra |

### 3.3 Ma trận quyền tổng hợp

| Chức năng | g_admin | co_admin | hr_mgr | instructor | learner |
|-----------|:-------:|:--------:|:------:|:----------:|:-------:|
| Tạo/xóa công ty con | ✓ | — | — | — | — |
| Quản lý org chart | ✓ | ✓ CT mình | — | — | — |
| Import org chart | ✓ | ✓ CT mình | — | — | — |
| CRUD user | ✓ | ✓ CT mình | — | — | — |
| Upload tài liệu/video | ✓ | ✓ CT | ✓ dept | ✓ dept | — |
| Xóa tài liệu (mình upload) | ✓ | ✓ | ✓ | ✓ | — |
| Xóa tài liệu (người khác) | ✓ | ✓ CT | — | — | — |
| Đổi download policy | ✓ | ✓ CT | — | — | — |
| Đổi visibility | ✓ | ✓ CT | — | — | — |
| Tạo khóa học | ✓ | ✓ CT | — | ✓ CT | — |
| Publish khóa học xuống CT | ✓ | — | — | — | — |
| Assign khóa học nội bộ | — | ✓ | ✓ | — | — |
| Xem/stream bài học | ✓ | ✓ | ✓ | ✓ | ✓ enrolled |
| Download (nếu ALLOWED) | ✓ | ✓ | ✓ | ✓ | ✓ enrolled |
| CRUD competency framework | ✓ | ✓ CT | — | — | — |
| CRUD learning path | ✓ | ✓ CT | — | — | — |
| Duyệt lộ trình sau đổi vị trí | ✓ | ✓ CT | ✓ CT | — | — |
| Xem access log | ✓ | ✓ CT | ✓ dept | — | — |
| Báo cáo toàn tập đoàn | ✓ | — | — | — | — |
| Báo cáo nội bộ CT | ✓ | ✓ CT | ✓ CT | — | — |

---

## 4. DATABASE SCHEMA ĐẦY ĐỦ

### 4.1 Tổ chức & Users

```prisma
model Organization {
  id           String   @id @default(uuid())
  name         String
  code         String   // mã duy nhất trong company, dùng cho import
  type         OrgType  // group | company | dept | team
  parentId     String?
  companyId    String?  // root company (null nếu là group)
  displayOrder Int      @default(0)
  description  String?
  address      String?
  phone        String?
  isActive     Boolean  @default(true)
  metadata     Json?    // logo, tax_code, etc.
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  parent      Organization?  @relation("OrgHierarchy", fields: [parentId], references: [id])
  children    Organization[] @relation("OrgHierarchy")
  users       UserRole[]
  courses     Course[]
  assets      ContentAsset[]
  positions   JobPosition[]  @relation("CompanyPositions")
  deptPositions JobPosition[] @relation("DeptPositions")

  @@unique([code, companyId])
  @@index([parentId])
  @@index([companyId])
}

enum OrgType { group company dept team }

model User {
  id                   String    @id @default(uuid())
  email                String    @unique
  passwordHash         String
  fullName             String
  avatarUrl            String?
  employeeCode         String?   @unique
  jobTitle             String?
  jobLevel             String?   // staff|senior|manager|director|c_level
  jobPositionId        String?
  jobPositionChangedAt DateTime?
  isActive             Boolean   @default(true)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  roles              UserRole[]
  enrollments        Enrollment[]
  competencyProfiles UserCompetencyProfile[]
  positionChanges    PositionChangeEvent[] @relation("UserPositionChanges")
  pathEnrollments    LearningPathEnrollment[]
  jobPosition        JobPosition? @relation(fields: [jobPositionId], references: [id])
}

model UserRole {
  id             String   @id @default(uuid())
  userId         String
  role           RoleType
  organizationId String
  assignedAt     DateTime @default(now())
  assignedBy     String?

  user         User         @relation(fields: [userId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, role, organizationId])
  @@index([userId])
  @@index([organizationId])
}

enum RoleType { group_admin group_hrm company_admin hr_manager instructor learner }
```

### 4.2 Khóa học & Nội dung

```prisma
model Course {
  id                  String         @id @default(uuid())
  ownerCompanyId      String
  createdById         String
  title               String
  description         String?
  thumbnailUrl        String?
  estimatedHours      Float?
  completionMode      CompletionMode @default(ALL_LESSONS)
  minimumPassingScore Int?
  isPublished         Boolean        @default(false)
  isActive            Boolean        @default(true)
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  ownerCompany  Organization   @relation(fields: [ownerCompanyId], references: [id])
  sections      CourseSection[]
  enrollments   Enrollment[]
  pathSteps     LearningPathStep[]
  competencyLinks CompetencyCourseLink[]
}

enum CompletionMode { ALL_LESSONS REQUIRED_ONLY QUIZ_PASS }

model CourseSection {
  id                 String   @id @default(uuid())
  courseId           String
  title              String
  description        String?
  displayOrder       Int
  estimatedMinutes   Int?
  deadlineOffsetDays Int?
  isRequired         Boolean  @default(true)

  course   Course    @relation(fields: [courseId], references: [id])
  lessons  Lesson[]

  @@unique([courseId, displayOrder])
}

model Lesson {
  id                   String   @id @default(uuid())
  sectionId            String
  title                String
  displayOrder         Int
  contentType          String   // video|document|quiz|text|presentation|audio
  estimatedMinutes     Int?
  requiredMinutes      Int?
  deadlineOffsetDays   Int?
  availableAfterDays   Int?
  isRequired           Boolean  @default(true)
  prerequisiteLessonId String?

  section            CourseSection      @relation(fields: [sectionId], references: [id])
  prerequisiteLesson Lesson?            @relation("LessonPrereq", fields: [prerequisiteLessonId], references: [id])
  dependentLessons   Lesson[]           @relation("LessonPrereq")
  progresses         LessonProgress[]
  assets             ContentAsset[]
}
```

### 4.3 Content Asset & Bảo mật

```prisma
model ContentAsset {
  id               String          @id @default(uuid())
  lessonId         String?
  organizationId   String
  uploadedById     String
  title            String
  description      String?
  fileType         AssetType
  storagePath      String          // KHÔNG expose ra client
  mimeType         String
  fileSizeBytes    BigInt
  durationSeconds  Int?
  hlsPlaylistPath  String?
  thumbnailPath    String?
  downloadPolicy   DownloadPolicy  @default(BLOCKED)
  watermarkEnabled Boolean         @default(true)
  visibility       AssetVisibility @default(DEPT_ONLY)
  processingStatus ProcessingStatus @default(PENDING)
  isActive         Boolean         @default(true)
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  lesson       Lesson?      @relation(fields: [lessonId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])
  uploader     User         @relation(fields: [uploadedById], references: [id])
  accessLogs   AssetAccessLog[]
  permissions  AssetPermission[]
  watchEvents  VideoWatchEvent[]
  docEvents    DocumentViewEvent[]
  engagementStat AssetEngagementStat?
  ratings      ContentRating[]
}

enum AssetType       { video document presentation audio image }
enum DownloadPolicy  { ALLOWED BLOCKED WATERMARK_ONLY }
enum AssetVisibility { DEPT_ONLY COMPANY_WIDE GROUP_WIDE }
enum ProcessingStatus { PENDING PROCESSING READY FAILED }

model AssetPermission {
  id             String    @id @default(uuid())
  assetId        String
  organizationId String
  canView        Boolean   @default(false)
  canDownload    Boolean   @default(false)
  grantedById    String
  grantedAt      DateTime  @default(now())
  expiresAt      DateTime?

  asset        ContentAsset @relation(fields: [assetId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])
  grantedBy    User         @relation(fields: [grantedById], references: [id])
}

model AssetAccessLog {
  id          String       @id @default(uuid())
  assetId     String
  userId      String
  action      AccessAction
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime     @default(now())

  asset ContentAsset @relation(fields: [assetId], references: [id])
  @@index([assetId, createdAt])
}

enum AccessAction {
  view_request stream_start stream_heartbeat
  download_attempt download_success signed_url_expired
}
```

### 4.4 Enrollment & Progress

```prisma
model Enrollment {
  id          String           @id @default(uuid())
  userId      String
  courseId    String
  source      EnrollmentSource
  sourceRefId String?
  enrolledAt  DateTime         @default(now())
  completedAt DateTime?
  deadline    DateTime?
  isMandatory Boolean          @default(false)

  user             User              @relation(fields: [userId], references: [id])
  course           Course            @relation(fields: [courseId], references: [id])
  lessonProgresses LessonProgress[]
  quizAttempts     QuizAttempt[]
  certificate      Certificate?
  stepEnrollment   LearningPathStepEnrollment?

  @@unique([userId, courseId])
  @@index([userId])
  @@index([courseId])
}

enum EnrollmentSource { group_publish learning_group company_assign self }

model LessonProgress {
  id           String         @id @default(uuid())
  enrollmentId String
  lessonId     String
  status       ProgressStatus @default(not_started)
  progressPct  Float          @default(0)
  startedAt    DateTime?
  completedAt  DateTime?
  timeSpentSec Int            @default(0)

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  lesson     Lesson     @relation(fields: [lessonId], references: [id])

  @@unique([enrollmentId, lessonId])
}

enum ProgressStatus { not_started in_progress completed }

model Certificate {
  id           String    @id @default(uuid())
  enrollmentId String    @unique
  code         String    @unique @default(cuid())
  issuedAt     DateTime  @default(now())
  expiresAt    DateTime?
  pdfUrl       String?

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id])
}
```

### 4.5 Tracking & Analytics

```prisma
// Partition theo tháng khi data > 1 triệu rows
model VideoWatchEvent {
  id               String     @id @default(uuid())
  assetId          String
  userId           String
  enrollmentId     String?
  sessionId        String
  eventType        VideoEvent
  watchPositionSec Int?
  durationSec      Int?
  playbackSpeed    Float      @default(1.0)
  deviceType       String?
  createdAt        DateTime   @default(now())

  asset ContentAsset @relation(fields: [assetId], references: [id])
  @@index([assetId, createdAt])
  @@index([userId, assetId])
}

enum VideoEvent {
  watch_start heartbeat pause resume seek watch_end replay speed_change
}

model DocumentViewEvent {
  id            String   @id @default(uuid())
  assetId       String
  userId        String
  enrollmentId  String?
  sessionId     String
  eventType     DocEvent
  pageNumber    Int?
  totalPages    Int?
  timeOnPageSec Int?
  scrollDepthPct Float?
  createdAt     DateTime @default(now())

  asset ContentAsset @relation(fields: [assetId], references: [id])
  @@index([assetId, createdAt])
}

enum DocEvent { open page_view page_leave close download_attempt }

model AssetEngagementStat {
  id                 String   @id @default(uuid())
  assetId            String   @unique
  companyId          String
  totalViews         Int      @default(0)
  uniqueViewers      Int      @default(0)
  avgWatchPctVideo   Float?
  avgPagesRead       Float?
  completionRate     Float    @default(0)
  replayRate         Float    @default(0)
  avgRating          Float?
  ratingCount        Int      @default(0)
  dropOffPointSec    Int?
  dropOffPageNumber  Int?
  lastCalculatedAt   DateTime @default(now())
  updatedAt          DateTime @updatedAt

  asset ContentAsset @relation(fields: [assetId], references: [id])
  @@index([companyId])
}

model ContentRating {
  id           String   @id @default(uuid())
  assetId      String
  userId       String
  enrollmentId String?
  rating       Int      // 1-5
  comment      String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([assetId, userId])
}
```

### 4.6 Khung năng lực & Vị trí

```prisma
model JobPosition {
  id                    String               @id @default(uuid())
  companyId             String
  organizationId        String?
  title                 String
  level                 String?
  code                  String?
  description           String?
  competencyFrameworkId String?
  learningPathId        String?
  isActive              Boolean              @default(true)
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  company             Organization         @relation("CompanyPositions", fields: [companyId], references: [id])
  organization        Organization?        @relation("DeptPositions", fields: [organizationId], references: [id])
  competencyFramework CompetencyFramework? @relation(fields: [competencyFrameworkId], references: [id])
  learningPath        LearningPath?        @relation(fields: [learningPathId], references: [id])
  users               User[]
  positionChangesFrom PositionChangeEvent[] @relation("FromPosition")
  positionChangesTo   PositionChangeEvent[] @relation("ToPosition")

  @@unique([companyId, code])
  @@index([companyId])
}

model CompetencyFramework {
  id          String   @id @default(uuid())
  companyId   String
  name        String
  version     String   @default("1.0")
  description String?
  isActive    Boolean  @default(true)
  publishedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  company   Organization       @relation(fields: [companyId], references: [id])
  domains   CompetencyDomain[]
  positions JobPosition[]
  @@index([companyId])
}

model CompetencyDomain {
  id           String   @id @default(uuid())
  frameworkId  String
  name         String
  description  String?
  displayOrder Int
  weight       Float?

  framework    CompetencyFramework @relation(fields: [frameworkId], references: [id])
  competencies Competency[]
  @@unique([frameworkId, displayOrder])
}

model Competency {
  id                String   @id @default(uuid())
  domainId          String
  name              String
  description       String?
  requiredLevel     Int      // 1–5
  levelDescriptions Json
  displayOrder      Int

  domain        CompetencyDomain       @relation(fields: [domainId], references: [id])
  userProfiles  UserCompetencyProfile[]
  courseLinks   CompetencyCourseLink[]
  @@index([domainId])
}

model CompetencyCourseLink {
  id           String @id @default(uuid())
  competencyId String
  courseId     String
  targetLevel  Int

  competency Competency @relation(fields: [competencyId], references: [id])
  course     Course     @relation(fields: [courseId], references: [id])
  @@unique([competencyId, courseId])
}

model UserCompetencyProfile {
  id            String           @id @default(uuid())
  userId        String
  competencyId  String
  currentLevel  Int              @default(0)
  evidenceNote  String?
  assessedById  String?
  assessedAt    DateTime         @default(now())
  source        AssessmentSource @default(SELF)
  updatedAt     DateTime         @updatedAt

  user       User       @relation(fields: [userId], references: [id])
  competency Competency @relation(fields: [competencyId], references: [id])
  @@unique([userId, competencyId])
  @@index([userId])
}

enum AssessmentSource { SELF MANAGER QUIZ SYSTEM }
```

### 4.7 Learning Path

```prisma
model LearningPath {
  id                String   @id @default(uuid())
  companyId         String
  name              String
  description       String?
  totalDeadlineDays Int?
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  company     Organization           @relation(fields: [companyId], references: [id])
  steps       LearningPathStep[]
  positions   JobPosition[]
  enrollments LearningPathEnrollment[]
  @@index([companyId])
}

model LearningPathStep {
  id                 String   @id @default(uuid())
  learningPathId     String
  courseId           String
  stepOrder          Int
  stepType           StepType @default(REQUIRED)
  deadlineOffsetDays Int?
  availableAfterDays Int?
  estimatedHours     Float?
  prerequisiteStepId String?

  learningPath     LearningPath      @relation(fields: [learningPathId], references: [id])
  course           Course            @relation(fields: [courseId], references: [id])
  prerequisiteStep LearningPathStep? @relation("StepPrereq", fields: [prerequisiteStepId], references: [id])
  dependentSteps   LearningPathStep[] @relation("StepPrereq")
  stepEnrollments  LearningPathStepEnrollment[]

  @@unique([learningPathId, stepOrder])
  @@index([learningPathId])
}

enum StepType { REQUIRED ELECTIVE ADVANCED }

model LearningPathEnrollment {
  id                    String               @id @default(uuid())
  userId                String
  learningPathId        String
  positionChangeEventId String?
  enrollmentType        EnrollmentPathType   @default(MANUAL)
  status                PathEnrollmentStatus @default(IN_PROGRESS)
  startedAt             DateTime             @default(now())
  totalDeadline         DateTime?
  completedAt           DateTime?
  progressPct           Float                @default(0)
  approvedById          String?
  approvedAt            DateTime?

  user                User                        @relation(fields: [userId], references: [id])
  learningPath        LearningPath                @relation(fields: [learningPathId], references: [id])
  positionChangeEvent PositionChangeEvent?        @relation(fields: [positionChangeEventId], references: [id])
  stepEnrollments     LearningPathStepEnrollment[]

  @@unique([userId, learningPathId])
  @@index([userId])
}

enum EnrollmentPathType  { POSITION_CHANGE MANUAL SELF }
enum PathEnrollmentStatus { IN_PROGRESS COMPLETED OVERDUE PAUSED }

model LearningPathStepEnrollment {
  id                       String         @id @default(uuid())
  learningPathEnrollmentId String
  learningPathStepId       String
  enrollmentId             String?
  status                   ProgressStatus @default(not_started)
  isUnlocked               Boolean        @default(false)
  unlockedAt               DateTime?
  deadline                 DateTime?
  completedAt              DateTime?

  pathEnrollment  LearningPathEnrollment @relation(fields: [learningPathEnrollmentId], references: [id])
  step            LearningPathStep       @relation(fields: [learningPathStepId], references: [id])
  courseEnrollment Enrollment?           @relation(fields: [enrollmentId], references: [id])

  @@unique([learningPathEnrollmentId, learningPathStepId])
}

model PositionChangeEvent {
  id               String               @id @default(uuid())
  userId           String
  fromPositionId   String?
  toPositionId     String
  changedById      String
  changedAt        DateTime             @default(now())
  effectiveDate    DateTime
  status           PositionChangeStatus @default(PENDING_GAP_ANALYSIS)
  gapAnalysisResult Json?
  notes            String?

  user         User            @relation("UserPositionChanges", fields: [userId], references: [id])
  fromPosition JobPosition?    @relation("FromPosition", fields: [fromPositionId], references: [id])
  toPosition   JobPosition     @relation("ToPosition", fields: [toPositionId], references: [id])
  pathEnrollments LearningPathEnrollment[]

  @@index([userId])
  @@index([status])
}

enum PositionChangeStatus {
  PENDING_GAP_ANALYSIS GAP_ANALYZED PENDING_APPROVAL APPROVED ENROLLED COMPLETED
}
```

### 4.8 Learning Group & Quiz

```prisma
model LearningGroup {
  id          String    @id @default(uuid())
  name        String
  description String?
  type        GroupType
  ruleJson    Json?
  createdById String
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  members GroupMember[]
  courses GroupCourse[]
}

enum GroupType { manual rule_based }

model GroupMember {
  id        String    @id @default(uuid())
  groupId   String
  userId    String
  companyId String
  addedById String
  addedAt   DateTime  @default(now())
  removedAt DateTime?

  group LearningGroup @relation(fields: [groupId], references: [id])
  user  User          @relation(fields: [userId], references: [id])
  @@unique([groupId, userId])
}

model GroupCourse {
  id           String        @id @default(uuid())
  groupId      String
  courseId     String
  assignedById String
  deadline     DateTime?
  assignedAt   DateTime      @default(now())

  group  LearningGroup @relation(fields: [groupId], references: [id])
  course Course        @relation(fields: [courseId], references: [id])
  @@unique([groupId, courseId])
}

model QuestionBank {
  id             String   @id @default(uuid())
  ownerCompanyId String
  name           String
  description    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  questions Question[]
}

model Question {
  id           String       @id @default(uuid())
  bankId       String
  createdById  String
  type         QuestionType
  difficulty   Difficulty   @default(medium)
  questionText String
  options      Json         // [{key:"A", text:"..."}, ...]
  correctAnswer String      // "A" hoặc "A;C" cho multi
  explanation  String?
  scorePoints  Int          @default(1)
  tags         String[]
  status       String       @default("draft") // draft|approved
  createdAt    DateTime     @default(now())

  bank    QuestionBank @relation(fields: [bankId], references: [id])
  creator User         @relation(fields: [createdById], references: [id])
}

enum QuestionType { single_choice multi_choice true_false fill_blank }
enum Difficulty   { easy medium hard }

model QuizAttempt {
  id           String    @id @default(uuid())
  enrollmentId String
  score        Float?
  maxScore     Float?
  passedAt     DateTime?
  startedAt    DateTime  @default(now())
  submittedAt  DateTime?
  answers      Json?

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id])
}
```

### 4.9 Import & Policy

```prisma
model ImportJob {
  id          String      @id @default(uuid())
  companyId   String
  importType  String      // org_chart|users|courses|question_bank|competency
  fileName    String
  status      ImportStatus @default(PENDING)
  totalRows   Int          @default(0)
  successRows Int          @default(0)
  errorRows   Int          @default(0)
  errorLog    Json?
  snapshot    Json?        // dữ liệu cũ để rollback
  createdById String
  createdAt   DateTime     @default(now())
  completedAt DateTime?
}

enum ImportStatus { PENDING PROCESSING SUCCESS FAILED ROLLED_BACK }

model CompanyLearningPolicy {
  id                         String   @id @default(uuid())
  companyId                  String   @unique
  autoEnrollOnPositionChange Boolean  @default(false)
  requireManagerApproval     Boolean  @default(true)
  positionChangeGraceDays    Int      @default(7)
  allowSelfAssessment        Boolean  @default(true)
  reminderBeforeDeadlineDays Int[]    @default([14, 7, 1])

  company Organization @relation(fields: [companyId], references: [id])
}

model AiServiceConfig {
  id          String   @id @default(uuid())
  companyId   String?
  name        String
  endpoint    String
  modelName   String
  apiKey      String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

---

## 5. API ENDPOINTS

### 5.1 Auth
```
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

### 5.2 Organizations & Import
```
GET    /api/organizations?companyId=
POST   /api/organizations
GET    /api/organizations/:id
PATCH  /api/organizations/:id
GET    /api/organizations/:id/tree      # nested JSON cho org chart
GET    /api/organizations/:id/flat      # flat array cho React Flow
GET    /api/organizations/:id/children  # lazy load children

POST   /api/import/validate             # dry-run, trả danh sách lỗi
POST   /api/import/execute              # thực hiện import trong transaction
GET    /api/import/jobs/:jobId          # tiến độ
GET    /api/import/jobs/:jobId/log      # download file lỗi Excel
GET    /api/import/history
POST   /api/import/rollback/:jobId      # rollback trong 24h
```

### 5.3 Users
```
GET    /api/users?companyId=&deptId=&role=
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
POST   /api/users/:id/roles
DELETE /api/users/:id/roles/:roleId
POST   /api/users/import-csv            # bulk import
```

### 5.4 Assets (Content Security)
```
POST   /api/assets/upload-url           # presigned PUT URL → temp bucket
POST   /api/assets                      # confirm upload, trigger job
GET    /api/assets/:id/status           # processing status
GET    /api/assets/:id/stream-url       # signed URL cho HLS (video)
GET    /api/assets/:id/view-url         # signed URL cho PDF viewer
POST   /api/assets/:id/download         # check policy → watermark → signed URL
POST   /api/assets/:id/heartbeat        # log stream (mỗi 30s)
GET    /api/assets?orgId=&type=
PATCH  /api/assets/:id
DELETE /api/assets/:id
GET    /api/assets/:id/logs
POST   /api/assets/:id/permissions
POST   /api/assets/:id/rating
```

### 5.5 Courses & Learning
```
GET    /api/courses?companyId=
POST   /api/courses
GET    /api/courses/:id
PATCH  /api/courses/:id
DELETE /api/courses/:id
POST   /api/courses/:id/publish
POST   /api/courses/:id/sections
POST   /api/courses/:id/sections/:sId/lessons
GET    /api/my/courses                  # danh sách khóa học của learner (UNION 3 nguồn)
GET    /api/my/courses/:id
POST   /api/my/courses/:id/enroll
POST   /api/my/courses/:id/lessons/:lessonId/progress
```

### 5.6 Competency & Learning Path
```
GET    /api/positions?companyId=
POST   /api/positions
GET    /api/positions/:id
PATCH  /api/positions/:id
GET    /api/positions/:id/framework
GET    /api/positions/:id/learning-path

GET    /api/frameworks?companyId=
POST   /api/frameworks
GET    /api/frameworks/:id
PATCH  /api/frameworks/:id
POST   /api/frameworks/:id/domains
POST   /api/frameworks/:id/domains/:dId/competencies

GET    /api/learning-paths?companyId=
POST   /api/learning-paths
GET    /api/learning-paths/:id
POST   /api/learning-paths/:id/steps
PATCH  /api/learning-paths/:id/steps/:stepId
POST   /api/learning-paths/:id/steps/reorder

POST   /api/users/:id/gap-analysis
GET    /api/users/:id/competency-profile
PATCH  /api/users/:id/competency-profile/:cId
GET    /api/position-changes?userId=&status=
POST   /api/position-changes/:id/approve
POST   /api/position-changes/:id/reject
GET    /api/users/:id/learning-paths
```

### 5.7 Tracking & Reports
```
POST   /api/tracking/video              # fire-and-forget → queue
POST   /api/tracking/document           # fire-and-forget → queue

GET    /api/reports/group/overview
GET    /api/reports/company/:id/completion
GET    /api/reports/company/:id/compliance
GET    /api/reports/company/:id/engagement-heatmap
GET    /api/reports/content-quality?companyId=
GET    /api/reports/content/:assetId/detail
GET    /api/reports/learner-activity?userId=
GET    /api/reports/position/:id/readiness
```

---

## 6. BẢO MẬT NỘI DUNG

### 6.1 Storage Layout
```
MinIO: bucket lms-private (KHÔNG public)
└── {group_id}/{company_id}/{dept_id}/
    ├── videos/raw/{asset_id}.mp4
    ├── videos/hls/{asset_id}/playlist.m3u8 + segment_*.ts
    ├── documents/{asset_id}.pdf
    └── presentations/{asset_id}.pptx

MinIO: bucket lms-temp (auto-delete 24h)
└── uploads/{session_id}/{filename}
```

### 6.2 Luồng upload an toàn
```
1. POST /api/assets/upload-url  → presigned PUT (lms-temp)
2. Client upload trực tiếp lên MinIO temp
3. POST /api/assets             → confirm, trigger BullMQ job
4. Job: validate → FFmpeg HLS → extract thumbnail → move lms-private → update DB
5. GET  /api/assets/:id/status  → READY
```

### 6.3 Video protection (HLS)
- Learner nhận signed URL playlist.m3u8 (TTL 20 phút)
- Player Video.js stream từng segment TS — không thể tải về nguyên file
- Không bao giờ expose đường dẫn raw mp4

### 6.4 PDF protection
- Render qua PDF.js trong iframe — KHÔNG dùng `<iframe src="url">`
- Watermark canvas overlay: tên + email + timestamp
- Disable `contextmenu`, `Ctrl+S`, `Ctrl+P` ở component level

### 6.5 Download policy enforcement
```typescript
// LUÔN kiểm tra trước khi tạo link
if (asset.downloadPolicy === 'BLOCKED')       → 403
if (asset.downloadPolicy === 'WATERMARK_ONLY') → FastAPI watermark → stream
if (asset.downloadPolicy === 'ALLOWED')        → presigned GET URL (5 phút)
// Log mọi attempt kể cả bị chặn
```

---

## 7. PERFORMANCE & CACHING

### 7.1 Redis Cache (ưu tiên làm trước)
```typescript
// TTL mapping
orgTree:    30 phút  // query nặng, ít thay đổi
userRoles:  15 phút  // đọc mọi request
courseMeta: 1 giờ
signedUrl:  18 phút  // = TTL signed URL - 2 phút buffer

// Pattern: cache-aside, invalidate khi entity thay đổi
await redis.setex(CACHE_KEYS.orgTree(companyId), 1800, JSON.stringify(tree));
```

### 7.2 Event Queue (tracking không block API)
```typescript
// POST /api/tracking/video → queue → trả 200 ngay
await trackingQueue.add('event', event, { removeOnComplete: 100 });

// Worker: batch write mỗi 10 giây hoặc 100 events
await prisma.videoWatchEvent.createMany({ data: batchEvents });
```

### 7.3 DB Optimization
```sql
-- Index bắt buộc
CREATE INDEX ON enrollments (user_id, course_id);
CREATE INDEX ON lesson_progresses (enrollment_id, lesson_id);
CREATE INDEX ON video_watch_events (asset_id, created_at);
CREATE INDEX ON asset_access_logs (asset_id, created_at);

-- Partition video_watch_events và document_view_events theo tháng
-- (thực hiện sau khi data > 500k rows)

-- Read replica cho report queries
-- (thực hiện khi có > 5 công ty)
```

### 7.4 Middleware chain
```typescript
// Mọi protected route đều qua:
1. jwtAuth()           // verify token, inject req.user
2. tenantGuard()       // inject req.companyId từ user.companyId
3. cacheOrgContext()   // load orgTree + userRoles từ Redis
4. requireRole(...)    // check quyền
```

---

## 8. TRACKING & ANALYTICS

### 8.1 Video tracking events
```typescript
// Frontend: Video.js player
const sessionId = crypto.randomUUID();
player.on('play',    () => track('watch_start'));
player.on('pause',   () => track('pause'));
player.on('ended',   () => track('watch_end'));
setInterval(() => track('heartbeat'), 10_000); // mỗi 10s khi đang play
```

### 8.2 Document tracking events
```typescript
// Frontend: PDF.js viewer
pdfViewer.on('pagechanging', (e) => track('page_view', { pageNumber: e.pageNumber }));
```

### 8.3 Content quality signals
| Signal | Ngưỡng cảnh báo |
|--------|----------------|
| Drop-off early | > 50% thoát tại < 30% thời lượng |
| Avg watch % | < 40% |
| Rating thấp | < 3.0 với > 10 lượt |
| Re-watch cao | > 60% → nội dung khó hiểu |

### 8.4 Aggregate job
```
Cron: mỗi 1 giờ → aggregate VideoWatchEvent + DocumentViewEvent
→ upsert AssetEngagementStat (drop-off point, avg watch %, completion rate)
```

---

## 9. KHUNG NĂNG LỰC & LỘ TRÌNH

### 9.1 Luồng Gap Analysis khi đổi vị trí
```
HR cập nhật User.jobPositionId
  → Prisma middleware detect thay đổi
  → Tạo PositionChangeEvent (status: PENDING_GAP_ANALYSIS)
  → BullMQ job: runGapAnalysis()
     · Lấy CompetencyFramework của vị trí mới
     · So sánh với UserCompetencyProfile
     · Tính overallReadinessScore (0–100%)
     · Xác định LearningPath phù hợp
  → Tùy CompanyLearningPolicy:
     · autoEnroll=true  → tạo LearningPathEnrollment ngay
     · autoEnroll=false → status PENDING_APPROVAL → HR duyệt
  → Notification cho nhân sự + quản lý
```

### 9.2 Time settings — deadline tương đối
```
LearningPathStep.deadlineOffsetDays = N
→ deadline = LearningPathEnrollment.startedAt + N ngày
(Mỗi nhân sự bắt đầu khác nhau → deadline khác nhau tự động)

LearningPathStep.availableAfterDays = M
→ unlock tại startedAt + M ngày (cron hàng ngày check)
```

### 9.3 Cron unlock step
```
Mỗi ngày 06:00 AM:
→ Tìm step chưa unlock, đến ngày mở, không còn prerequisite pending
→ Unlock + tạo Enrollment cho course
→ Gửi notification
```

---

## 10. IMPORT & ORG CHART

### 10.1 Bốn file template Excel
```
01_ORG_CHART_IMPORT.xlsx
  Sheet 1_ORG_CHART       → phòng ban, cấu trúc (import cha trước con)
  Sheet 2_USERS           → nhân sự
  Sheet 3_JOB_POSITIONS   → vị trí công việc
  Sheet 4_USER_POSITIONS  → gán nhân sự → vị trí

02_COMPETENCY_LEARNING_PATH_IMPORT.xlsx
  Sheet 1_COMPETENCY_FRAMEWORK → khung năng lực theo domain
  Sheet 2_LEARNING_PATH        → lộ trình học và các bước

03_COURSES_IMPORT.xlsx
  Sheet 1_COURSES          → danh mục khóa học
  Sheet 2_COURSE_STRUCTURE → chương + bài học
  Sheet 3_COURSE_ASSIGNMENTS → phân công hàng loạt

04_QUESTION_BANK_IMPORT.xlsx
  Sheet 1_QUESTION_BANK    → câu hỏi trắc nghiệm (3 loại)
```

### 10.2 Import pipeline rules
```typescript
// Bắt buộc:
// 1. Parse → Validate toàn bộ → nếu có lỗi: KHÔNG ghi DB, trả file lỗi
// 2. Nếu hợp lệ: ghi trong 1 transaction duy nhất
// 3. topologicalSort cho org (cha trước con)
// 4. Lưu snapshot để rollback trong 24h
// 5. Trả về file Excel highlight ô lỗi khi có lỗi
```

### 10.3 Org Chart UI
```typescript
// Library: @xyflow/react + dagre (auto layout)
// Custom node card: tên, type, userCount, managerName
// Features: zoom/pan, minimap, export PNG, click → danh sách nhân sự
// Performance: lazy load 2 cấp đầu, expand on demand

GET /api/organizations/:id/children   // load khi click expand
```

---

## 11. BACKGROUND JOBS & CRON

| Job | Trigger | Mô tả |
|-----|---------|-------|
| `asset-processor` | After upload confirm | FFmpeg HLS + thumbnail + extract text |
| `tracking-batch-writer` | Every 10s | Flush tracking queue → DB |
| `position-change-handler` | On change event | Gap analysis + enrollment |
| `unlock-path-steps` | Daily 06:00 | Unlock steps đến ngày mở |
| `aggregate-stats` | Every 1h | Tổng hợp AssetEngagementStat |
| `sync-rule-groups` | Every 1h | Sync rule-based LearningGroup members |
| `deadline-reminder` | Daily 08:00 | Nhắc deadline 14/7/1 ngày trước |
| `cleanup-expired-attempts` | Nightly | Auto-submit quiz quá giờ |
| `create-partition` | Monthly | Tạo partition tháng mới cho log tables |

---

## 12. CẤU HÌNH MÔI TRƯỜNG

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/lms_db"
DATABASE_READ_URL="postgresql://user:pass@localhost:5433/lms_db"

# Auth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="https://lms.via.vn"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD="your_redis_password"

# Cache TTLs (seconds)
CACHE_TTL_ORG_TREE=1800
CACHE_TTL_USER_ROLES=900
CACHE_TTL_COURSE_META=3600
CACHE_TTL_SIGNED_URL=1080

# MinIO
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET_PRIVATE="lms-private"
MINIO_BUCKET_TEMP="lms-temp"
SIGNED_URL_TTL_MINUTES=20

# AI Service
AI_SERVICE_URL="http://localhost:8000"
OLLAMA_URL="http://localhost:11434"
AI_DEFAULT_MODEL="qwen2.5:14b"

# Tracking
TRACKING_BATCH_SIZE=100
TRACKING_FLUSH_INTERVAL_MS=10000
NEXT_PUBLIC_VIDEO_HEARTBEAT_MS=10000

# App
NODE_ENV="production"
PORT=3001
NEXT_PUBLIC_APP_URL="https://lms.via.vn"
```

---

## 13. SPRINT PLAN

### Sprint 1 — Foundation (Tuần 1–3)
- Auth: JWT, refresh, logout
- Organization: CRUD, org tree API, Org Chart UI (React Flow)
- Import Pipeline: validate + execute + error file
- Users: CRUD, role assignment, import CSV
- Course CRUD cơ bản
- ContentAsset: upload flow, Signed URL, download policy BLOCKED default
- Middleware: tenantGuard, requireRole, Redis cache orgTree+roles

### Sprint 2 — Learning Core (Tuần 4–6)
- CourseSection + Lesson với time settings
- Lesson Player: Video.js (HLS) + PDF.js (watermark overlay)
- Enrollment + LessonProgress tracking
- Quiz Engine: random từ QuestionBank, multi-type, time limit
- Certificate: auto-issue PDF, public verify page
- Tracking: VideoWatchEvent + DocumentViewEvent queue

### Sprint 3 — Management & Reports (Tuần 7–9)
- Learning Group: manual + rule-based, sync cron
- Mandatory Training + Deadline tracking
- CompanyLearningPolicy settings
- Reports: completion, compliance, content quality
- Import templates: 03_COURSES + 04_QUESTION_BANK
- Aggregate stats job (hourly)

### Sprint 4 — AI & Question Bank (Tuần 10–12)
- FastAPI AI service: kết nối Ollama Qwen2.5:14b
- AI sinh câu hỏi từ PDF/DOCX → review → approve workflow
- Course Wizard: chatbot hỏi đáp → tạo outline + script
- AiServiceConfig UI

### Sprint 5 — Competency & Learning Path (Tuần 13–15)
- JobPosition + CompetencyFramework CRUD
- LearningPath với step ordering + time settings
- Gap Analysis service
- PositionChangeEvent detection + handler job
- Unlock steps cron
- Import templates: 01 Sheet 3_JOB_POSITIONS + 02 COMPETENCY
- Dashboard readiness report

### Sprint 6+ — Scale & Optimize
- DB Partitioning cho log tables
- Read replica cho report queries
- CDN integration cho HLS
- Auto video generation (TTS + FFmpeg pipeline)
- Row-Level Security (khi > 10 công ty)

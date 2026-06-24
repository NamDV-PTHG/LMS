# PROMPT_SPRINT_2.md — Lesson Player, Progress, Quiz Engine, Certificate

> Prerequisite: Sprint 1 đã hoàn thành.
> Đọc `specs/LMS_SPEC_V1.0.md` sections 3.4, 3.5 và `CLAUDE.md` trước khi bắt đầu.

---

## Task 2.1 — Learner Dashboard & Course List

### Endpoint quan trọng nhất của toàn hệ thống
```
GET /api/my/courses
```

Implement query hợp nhất 3 nguồn từ spec section 8 (raw SQL với UNION).
Trả về kèm: `enrollment_status`, `progress_pct`, `deadline`, `source`.

### UI
- `app/(dashboard)/my-courses/page.tsx` — grid khóa học với filter: tất cả / đang học / chưa học / đã hoàn thành
- `components/course/course-card.tsx` — hiển thị thumbnail, progress bar, deadline badge
- `components/course/progress-ring.tsx` — circular progress indicator

---

## Task 2.2 — Lesson Player

### Endpoints
```
GET  /api/my/courses/:courseId           # course detail + sections + lessons + progress
POST /api/my/courses/:courseId/enroll    # tự enroll (nếu chưa có enrollment)
GET  /api/my/courses/:courseId/lessons/:lessonId
POST /api/my/courses/:courseId/lessons/:lessonId/progress
     Body: { progressPct: number, timeSpentSec: number }
```

### Logic tự động hoàn thành course
```typescript
// Sau khi update lesson progress:
// 1. Kiểm tra tất cả required lessons đã completed chưa
// 2. Nếu có, set enrollment.completedAt = now()
// 3. Trigger tạo certificate (nếu course có config cert)
```

### UI
- `app/(dashboard)/my-courses/[courseId]/page.tsx` — layout 2 cột: sidebar outline + content area
- `components/lesson/video-player.tsx` — HTML5 video với tracking thời gian xem (report progress mỗi 30s)
- `components/lesson/document-viewer.tsx` — PDF viewer dùng `react-pdf`
- `components/course/sidebar-outline.tsx` — danh sách section/lesson với icon trạng thái

---

## Task 2.3 — Quiz Engine

### Endpoints
```
POST /api/my/courses/:courseId/lessons/:lessonId/quiz/start
     # Tạo QuizAttempt, random câu hỏi từ NHCH theo QuizConfig
     # Trả về: { attemptId, questions: Question[] (không có isCorrect), timeLimitMins }

POST /api/my/courses/:courseId/lessons/:lessonId/quiz/submit
     Body: { attemptId, answers: [{ questionId, selectedOptionIds }] }
     # Chấm điểm, lưu QuizAttempt, trả về: { score, isPassed, correctAnswers, explanations }
```

### Logic random câu hỏi
```typescript
// Đọc QuizConfig của lesson
// Random từ các bankIds được chỉ định
// Phân phối theo easyCount/mediumCount/hardCount
// Shuffle questions + shuffle options (nếu config = true)
// Đảm bảo không trùng câu trong cùng attempt
// Kiểm tra maxAttempts — throw error nếu đã hết lượt
```

### UI
- `app/(dashboard)/my-courses/[courseId]/quiz/[lessonId]/page.tsx`
- `components/quiz/quiz-player.tsx` — hiển thị từng câu hỏi, navigation, countdown timer
- `components/quiz/question-mcq.tsx` — multiple choice
- `components/quiz/question-true-false.tsx`
- `components/quiz/question-fill-blank.tsx`
- `components/quiz/quiz-result.tsx` — kết quả với review đáp án

---

## Task 2.4 — Certificate

### Logic
```typescript
// Tự động trigger sau khi enrollment.completedAt được set
// Tạo Certificate record với code = cuid()
// Generate PDF (dùng @react-pdf/renderer hoặc puppeteer)
// Lưu PDF vào storage, update certificate.pdfUrl
```

### Endpoints
```
GET /api/my/certificates                    # danh sách cert của learner
GET /api/my/certificates/:code              # public URL (không cần auth) để verify
GET /api/my/certificates/:code/download     # download PDF
```

### Template certificate PDF cần có
- Tên học viên
- Tên khóa học
- Ngày hoàn thành
- Mã chứng chỉ (để verify)
- Logo công ty
- QR code trỏ đến trang verify public

### UI
- `app/(dashboard)/my-certificates/page.tsx` — danh sách chứng chỉ dạng card
- `app/verify/[code]/page.tsx` — public page verify certificate (không cần login)

---

## Task 2.5 — Cron Jobs

### File: `packages/api/jobs/index.ts`

```typescript
// Job 1: sync-rule-based-groups (chạy mỗi 1h)
// - Lấy tất cả LearningGroup type=rule_based
// - Evaluate ruleJson với user metadata
// - Update group_members (thêm mới / set removedAt)

// Job 2: deadline-reminder (chạy 08:00 mỗi ngày)
// - Tìm enrollment có deadline trong 3 ngày tới, chưa completed
// - Gửi notification (email hoặc in-app)

// Job 3: cleanup-expired-quiz-attempts (chạy mỗi đêm)
// - QuizAttempt chưa submit sau 2x timeLimitMins → auto submit rỗng
```

Dùng `node-cron` cho scheduler.

---

## Thứ tự thực hiện

```
2.1 (Learner Dashboard) → 2.2 (Lesson Player) → 2.3 (Quiz Engine) → 2.4 (Certificate) → 2.5 (Cron)
```

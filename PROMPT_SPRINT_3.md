# PROMPT_SPRINT_3.md — Learning Groups, Mandatory Training, Reports, AI Config

> Prerequisite: Sprint 1 & 2 đã hoàn thành.

---

## Task 3.1 — Learning Group (xuyên công ty)

### Quy tắc nghiệp vụ quan trọng
- Learning Group owned by tập đoàn (không có `ownerCompanyId`)
- Chỉ `group_admin` và `group_hrm` được tạo và quản lý
- Group HRM **không thấy** danh sách nhân viên của công ty — chỉ thấy user đã được add vào group
- Completion của group course: chỉ `group_hrm` và `group_admin` xem được
- Khi add member thủ công: tìm user theo email hoặc employee_code (không expose danh sách)

### Endpoints
```
GET    /api/learning-groups
POST   /api/learning-groups
       Body: { name, description, type: 'manual'|'rule_based', ruleJson? }
GET    /api/learning-groups/:id
PATCH  /api/learning-groups/:id
DELETE /api/learning-groups/:id

POST   /api/learning-groups/:id/members
       Body: { identifier: string }  # email HOẶC employee_code — không expose danh sách CT
DELETE /api/learning-groups/:id/members/:userId

GET    /api/learning-groups/:id/courses
POST   /api/learning-groups/:id/courses
       Body: { courseId, deadline? }
DELETE /api/learning-groups/:id/courses/:courseId
```

### Rule-based JSON format
```typescript
interface RuleJson {
  logic: 'AND' | 'OR'
  conditions: Array<{
    field: 'job_level' | 'job_title' | 'company_id' | 'department_id'
    op: 'eq' | 'in' | 'gte' | 'contains'
    value: string | string[]
  }>
}

// Ví dụ: tất cả Manager trở lên thuộc CT A và CT B
{
  "logic": "AND",
  "conditions": [
    { "field": "job_level", "op": "in", "value": ["manager", "director", "c_level"] },
    { "field": "company_id", "op": "in", "value": ["uuid-ct-a", "uuid-ct-b"] }
  ]
}
```

### UI
- `app/(dashboard)/learning-groups/page.tsx`
- `app/(dashboard)/learning-groups/[id]/page.tsx` — detail: thành viên + khóa học + tiến độ
- `components/learning-group/member-search.tsx` — search by email/code (không list toàn bộ)
- `components/learning-group/rule-builder.tsx` — UI drag-drop để build ruleJson

---

## Task 3.2 — Mandatory Training & Deadline Tracking

### Khái niệm
Course có thể được assign là `isMandatory = true` với `deadline`. Hệ thống track compliance.

### Endpoints
```
GET /api/company/:companyId/compliance
    # Trả về: danh sách mandatory courses + tỷ lệ hoàn thành theo phòng ban
    # Query params: deptId?, courseId?, overdueOnly?

GET /api/company/:companyId/users/:userId/compliance
    # Compliance của 1 nhân viên cụ thể
```

### Logic compliance status
```typescript
type ComplianceStatus = 
  | 'completed'           // completedAt != null
  | 'in_progress'         // enrolledAt != null, completedAt == null, deadline chưa qua
  | 'overdue'             // deadline đã qua, chưa completed
  | 'not_started'         // chưa enroll, deadline chưa qua
  | 'overdue_not_started' // chưa enroll, deadline đã qua
```

### UI
- `app/(dashboard)/reports/compliance/page.tsx`
- `components/reports/compliance-table.tsx` — table với color-coded status
- `components/reports/compliance-heatmap.tsx` — phòng ban x khóa học

---

## Task 3.3 — Reports & Analytics

### Endpoints

**Group Admin reports**
```
GET /api/reports/group/overview
    # { totalCompanies, totalUsers, totalCourses, avgCompletionRate, activeLearnersThisMonth }

GET /api/reports/group/company-comparison
    # So sánh completion rate giữa các công ty
```

**Group HRM reports**
```
GET /api/reports/learning-groups/:id/progress
    # Tiến độ từng thành viên, từng khóa học trong group
    # Isolation: chỉ group_hrm và group_admin
```

**Company Admin / HR Manager reports**
```
GET /api/reports/company/:companyId/overview
    # { totalUsers, totalCourses, completionRate, mandatoryComplianceRate }

GET /api/reports/company/:companyId/by-department
    # Breakdown theo phòng ban

GET /api/reports/company/:companyId/by-course
    # Từng khóa học: enrolled, completed, avgScore, avgTimeHours

GET /api/reports/company/:companyId/users/:userId
    # Individual: danh sách khóa học, tiến độ, cert, quiz scores
```

**Export**
```
GET /api/reports/company/:companyId/export?format=xlsx&type=compliance
    # Export báo cáo ra Excel
```

### UI
- `app/(dashboard)/reports/page.tsx` — dashboard tổng quan (khác nhau theo role)
- `components/reports/kpi-cards.tsx` — metric cards
- `components/reports/completion-chart.tsx` — dùng recharts
- `components/reports/user-progress-table.tsx`
- `components/reports/export-button.tsx` — trigger export + download

---

## Task 3.4 — AI Config Management UI (hoàn thiện)

Hoàn thiện UI từ Sprint 1 Task 1.7 với thêm:

### Tính năng bổ sung
- Hiển thị danh sách models available từ Ollama server (sau khi test connection)
- Dropdown chọn model từ danh sách thực tế
- Lịch sử test connection (success/fail + timestamp)
- Health check indicator: badge màu green/red realtime

### UI layout gợi ý
```
AI Service Configuration
├── Card: Question Generator
│   ├── Status: 🟢 Connected (Qwen2.5:14b)
│   ├── URL: http://192.168.1.100:11434
│   ├── [Test Connection] [Edit]
│   └── Last tested: 5 phút trước
├── Card: Script Generator (Sprint 4)
│   └── Status: 🔴 Not configured
```

---

## Thứ tự thực hiện

```
3.1 (Learning Groups) → 3.2 (Mandatory Training) → 3.3 (Reports) → 3.4 (AI Config)
```

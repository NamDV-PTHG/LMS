# Claude CLI — LMS Web Redesign Prompt (FULL SYSTEM)
# Option A: Clean Professional — Sidebar trắng + Header xanh #185FA5
#
# Cách dùng:
#   1. Chạy: claude (trong thư mục project)
#   2. Paste toàn bộ file này làm prompt đầu tiên

---

## NHIỆM VỤ

Redesign toàn bộ giao diện LMS web (35 trang) theo design system Option A.
KHÔNG thay đổi business logic, API calls, TypeScript types, data fetching.
CHỈ thay đổi JSX structure và Tailwind classes.

---

## BƯỚC ĐẦU TIÊN — ĐỌC CODEBASE

Trước khi làm bất cứ điều gì:

```bash
# 1. Xem cấu trúc thư mục
find app -name "*.tsx" | sort

# 2. Kiểm tra tailwind config
cat tailwind.config.ts

# 3. Kiểm tra root layout
cat app/layout.tsx

# 4. Tìm CSS/style cần xoá
grep -r "style={{" components/ app/ --include="*.tsx" | grep -v node_modules | head -40
grep -rn "bg-blue\|bg-gray\|bg-slate\|bg-zinc" components/ app/ --include="*.tsx" | grep -v node_modules | head -40

# 5. Kiểm tra layout hiện tại của dashboard
cat app/\(dashboard\)/layout.tsx 2>/dev/null || cat app/dashboard/layout.tsx 2>/dev/null
```

Báo cáo trước khi bắt đầu:
- Layout shell hiện tại đang dùng file nào
- CSS conflict nào cần xử lý
- Danh sách file cần thay đổi

---

## DESIGN SYSTEM TOKEN

### Bước 1 — Cập nhật tailwind.config.ts

Merge vào `theme.extend`:

```typescript
colors: {
  primary: {
    DEFAULT: '#185FA5',
    dark:    '#0C447C',
    light:   '#378ADD',
    tint:    '#E6F1FB',
  },
  success: { DEFAULT: '#3B6D11', tint: '#EAF3DE' },
  warning: { DEFAULT: '#854F0B', tint: '#FAEEDA' },
  danger:  { DEFAULT: '#993C1D', tint: '#FAECE7' },
  surface: '#FFFFFF',
  muted:   '#F1EFE8',
  content: '#111827',
  subtle:  '#4B5563',
  faint:   '#9CA3AF',
},
borderColor: (theme) => ({
  ...theme('colors'),
  default: 'rgba(0,0,0,0.08)',
}),
boxShadow: {
  card: '0 0 0 0.5px rgba(0,0,0,0.08)',
  nav:  '0 -1px 0 rgba(0,0,0,0.06)',
},
```

### Bước 2 — Cập nhật app/globals.css

Thêm vào cuối file:

```css
/* Scrollbar ẩn cho sidebar */
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }

/* Border default */
.border-default { border-color: rgba(0,0,0,0.08); }
.divide-default > * + * { border-color: rgba(0,0,0,0.08) !important; }
```

---

## WEB SHELL — TẠO ĐẦU TIÊN

File: `components/web/web-shell.tsx`

Đây là layout áp dụng cho **tất cả 35 trang** (trừ auth pages).
Khi xong file này, toàn bộ sidebar + header thay đổi ngay.

```
Layout:
┌──────────────────────────────────────────────┐
│ Sidebar (w-52, fixed, bg-surface)            │
│ ├── Logo: icon + "Phú Thái LMS"              │
│ ├── Nav groups (theo role)                   │
│ └── User footer (avatar + name + role)       │
├─────────────────────────────────────────────-│
│ Header (h-[52px], bg-primary #185FA5)        │
│ ├── Page title (text-white)                  │
│ └── Search + Bell icon                       │
├──────────────────────────────────────────────│
│ Content (flex-1, overflow-y-auto, p-4)       │
│ bg-muted (#F1EFE8)                           │
└──────────────────────────────────────────────┘
```

### Navigation theo role (dùng auth context thực tế của project)

```typescript
// NAV_GROUPS — map theo role từ session/auth
const NAV_BY_ROLE = {

  // group_admin thấy tất cả
  group_admin: [
    {
      label: 'Tổng quan',
      items: [
        { label: 'Dashboard',        href: '/dashboard',         icon: LayoutDashboard },
        { label: 'Báo cáo',          href: '/reports',           icon: BarChart2 },
      ],
    },
    {
      label: 'Người dùng & Tổ chức',
      items: [
        { label: 'Người dùng',       href: '/users',             icon: Users },
        { label: 'Tổ chức',          href: '/organizations',     icon: Building2 },
        { label: 'Nhập liệu',        href: '/import',            icon: Upload },
      ],
    },
    {
      label: 'Học tập',
      items: [
        { label: 'Khóa học',         href: '/courses',           icon: BookOpen },
        { label: 'Nhóm học tập',     href: '/learning-groups',   icon: Users2 },
        { label: 'Lộ trình học',     href: '/learning-paths',    icon: Map },
        { label: 'Thư viện tài liệu',href: '/media-library',     icon: Library },
      ],
    },
    {
      label: 'Năng lực & HR',
      items: [
        { label: 'Khung năng lực',   href: '/competency-frameworks', icon: Target },
        { label: 'Vị trí công việc', href: '/positions',         icon: Briefcase },
        { label: 'Thay đổi vị trí',  href: '/position-changes',  icon: ArrowLeftRight },
        { label: 'Ngân hàng câu hỏi',href: '/question-banks',    icon: ClipboardList },
      ],
    },
    {
      label: 'Hệ thống',
      items: [
        { label: 'Cài đặt',          href: '/settings',          icon: Settings },
        { label: 'Cấu hình AI',      href: '/ai-config',         icon: Bot },
        { label: 'Vận hành',         href: '/operations',        icon: Server },
      ],
    },
  ],

  // company_admin — không thấy ai-config, operations, organizations
  company_admin: [
    {
      label: 'Tổng quan',
      items: [
        { label: 'Dashboard',        href: '/dashboard',         icon: LayoutDashboard },
        { label: 'Báo cáo',          href: '/reports',           icon: BarChart2 },
      ],
    },
    {
      label: 'Người dùng',
      items: [
        { label: 'Người dùng',       href: '/users',             icon: Users },
        { label: 'Nhập liệu',        href: '/import',            icon: Upload },
      ],
    },
    {
      label: 'Học tập',
      items: [
        { label: 'Khóa học',         href: '/courses',           icon: BookOpen },
        { label: 'Nhóm học tập',     href: '/learning-groups',   icon: Users2 },
        { label: 'Lộ trình học',     href: '/learning-paths',    icon: Map },
        { label: 'Thư viện tài liệu',href: '/media-library',     icon: Library },
      ],
    },
    {
      label: 'Năng lực & HR',
      items: [
        { label: 'Khung năng lực',   href: '/competency-frameworks', icon: Target },
        { label: 'Vị trí công việc', href: '/positions',         icon: Briefcase },
        { label: 'Ngân hàng câu hỏi',href: '/question-banks',    icon: ClipboardList },
      ],
    },
    {
      label: 'Hệ thống',
      items: [
        { label: 'Cài đặt',          href: '/settings',          icon: Settings },
      ],
    },
  ],

  // hr_manager — không có settings, ai-config, operations
  hr_manager: [
    {
      label: 'Tổng quan',
      items: [
        { label: 'Dashboard',        href: '/dashboard',         icon: LayoutDashboard },
        { label: 'Báo cáo',          href: '/reports',           icon: BarChart2 },
      ],
    },
    {
      label: 'Người dùng',
      items: [
        { label: 'Người dùng',       href: '/users',             icon: Users },
        { label: 'Nhập liệu',        href: '/import',            icon: Upload },
      ],
    },
    {
      label: 'Học tập',
      items: [
        { label: 'Khóa học',         href: '/courses',           icon: BookOpen },
        { label: 'Nhóm học tập',     href: '/learning-groups',   icon: Users2 },
        { label: 'Lộ trình học',     href: '/learning-paths',    icon: Map },
        { label: 'Thư viện tài liệu',href: '/media-library',     icon: Library },
      ],
    },
    {
      label: 'Năng lực & HR',
      items: [
        { label: 'Khung năng lực',   href: '/competency-frameworks', icon: Target },
        { label: 'Vị trí công việc', href: '/positions',         icon: Briefcase },
        { label: 'Thay đổi vị trí',  href: '/position-changes',  icon: ArrowLeftRight },
        { label: 'Ngân hàng câu hỏi',href: '/question-banks',    icon: ClipboardList },
      ],
    },
  ],

  // instructor — chỉ thấy courses + media
  instructor: [
    {
      label: 'Học tập',
      items: [
        { label: 'Dashboard',        href: '/dashboard',         icon: LayoutDashboard },
        { label: 'Khóa học',         href: '/courses',           icon: BookOpen },
        { label: 'Thư viện tài liệu',href: '/media-library',     icon: Library },
        { label: 'Ngân hàng câu hỏi',href: '/question-banks',    icon: ClipboardList },
      ],
    },
  ],

  // learner — chỉ thấy my-courses, my-learning-paths
  learner: [
    {
      label: 'Học tập của tôi',
      items: [
        { label: 'Dashboard',          href: '/dashboard',          icon: LayoutDashboard },
        { label: 'Khóa học của tôi',   href: '/my-courses',         icon: BookOpen },
        { label: 'Lộ trình của tôi',   href: '/my-learning-paths',  icon: Map },
      ],
    },
  ],
}
```

---

## DANH SÁCH 35 TRANG — REDESIGN ĐẦY ĐỦ

### PHASE 0 — Nền tảng (bắt buộc làm trước, không skip)
```
[ ] tailwind.config.ts              ← thêm token colors
[ ] app/globals.css                 ← scrollbar-none, border-default
[ ] components/web/web-shell.tsx    ← layout shell toàn bộ hệ thống
[ ] components/web/status-badge.tsx ← badge dùng lại nhiều trang
[ ] components/web/page-header.tsx  ← header trang: title + actions
[ ] components/web/data-table.tsx   ← table tái sử dụng
[ ] components/web/empty-state.tsx  ← empty state chuẩn
[ ] components/web/skeleton.tsx     ← loading skeleton
```

### PHASE 1 — Auth pages (không dùng WebShell)
```
[ ] app/(auth)/login/page.tsx
    Layout: centered, max-w-sm, card trắng rounded-xl shadow-card
    Logo + tên công ty phía trên
    Form: email + password + nút đăng nhập bg-primary
    Link quên mật khẩu

[ ] app/(auth)/forgot-password/page.tsx
[ ] app/(auth)/reset-password/page.tsx
[ ] app/(auth)/change-password/page.tsx
[ ] app/(auth)/verify/[code]/page.tsx
```

### PHASE 2 — Dashboard & Core
```
[ ] app/(dashboard)/dashboard/page.tsx
    Stat cards 4 cột (số liệu theo role)
    Bảng khóa học đang học / được giao
    Panel thông báo mới
    Hoạt động gần đây

[ ] app/(dashboard)/profile/page.tsx
    Avatar + thông tin cá nhân
    Form chỉnh sửa (name, email, phone)
    Đổi mật khẩu inline hoặc tab riêng

[ ] app/(dashboard)/settings/page.tsx          ← group_admin, company_admin
    Tabs: Chung / Email / Bảo mật / Tích hợp

[ ] app/(dashboard)/ai-config/page.tsx         ← group_admin
[ ] app/(dashboard)/operations/page.tsx        ← group_admin
```

### PHASE 3 — Người dùng & Tổ chức
```
[ ] app/(dashboard)/users/page.tsx
    Search + filter (role, công ty, trạng thái)
    Table: avatar | tên | email | role | công ty | trạng thái | actions
    Pagination
    Button "Thêm người dùng" + "Nhập CSV"

[ ] app/(dashboard)/users/[id]/page.tsx
    Header: avatar lớn + tên + role + badge trạng thái
    Tabs: Thông tin | Khóa học | Tiến độ | Lịch sử

[ ] app/(dashboard)/organizations/page.tsx
    Table: logo | tên | số nhân viên | số khóa học | trạng thái

[ ] app/(dashboard)/organizations/[id]/page.tsx
    Tabs: Tổng quan | Người dùng | Khóa học | Cài đặt

[ ] app/(dashboard)/import/page.tsx
    Upload zone (drag & drop CSV)
    Preview table trước khi import
    Progress bar khi đang import
    Kết quả: thành công / lỗi theo row
```

### PHASE 4 — Khóa học
```
[ ] app/(dashboard)/courses/page.tsx
    Filter: trạng thái | danh mục | tổ chức
    Grid view (card) + List view (table) toggle
    Card: thumbnail | tên | số bài | % hoàn thành trung bình | badge status

[ ] app/(dashboard)/courses/[id]/page.tsx
    Hero: thumbnail lớn + tên + mô tả + stats
    Tabs: Nội dung | Học viên | Cài đặt | Thống kê
    Tab Nội dung: danh sách lesson có thể drag reorder

[ ] app/(dashboard)/courses/wizard/page.tsx
    Stepper: Thông tin → Nội dung → Cài đặt → Xem trước → Xuất bản
    AI-assisted fields (đánh dấu icon ✨)

[ ] app/(dashboard)/courses/[id]/lessons/[lessonId]/content/page.tsx
    Fullscreen editor layout (không có sidebar, header tối giản)
    Toolbar: định dạng | video | ảnh | quiz | lưu

[ ] app/(dashboard)/courses/[id]/lessons/[lessonId]/quiz/page.tsx
    Preview quiz hoặc chế độ làm bài cho learner
```

### PHASE 5 — Học viên (Learner views)
```
[ ] app/(dashboard)/my-courses/page.tsx
    Grid khóa học đã đăng ký
    Progress ring / bar trên mỗi card
    Filter: đang học | hoàn thành | chưa bắt đầu

[ ] app/(dashboard)/my-courses/[id]/page.tsx
    Course hero + progress tổng
    Danh sách lesson: icon type | tên | duration | trạng thái (done/active/locked)

[ ] app/(dashboard)/my-courses/[id]/lessons/[lessonId]/page.tsx
    Video player full-width phía trên
    Tab: Nội dung | Ghi chú | Hỏi đáp
    Sidebar bên phải: danh sách lesson

[ ] app/(dashboard)/my-learning-paths/page.tsx
    Timeline lộ trình học
    Progress theo từng giai đoạn
```

### PHASE 6 — Quản lý học tập
```
[ ] app/(dashboard)/learning-groups/page.tsx
    Table: tên nhóm | số thành viên | khóa học | trạng thái
    Button tạo nhóm mới

[ ] app/(dashboard)/learning-groups/[id]/page.tsx
    Tabs: Thành viên | Khóa học | Tiến độ | Cài đặt

[ ] app/(dashboard)/learning-paths/page.tsx
    Grid/list lộ trình học
    Card: tên | số giai đoạn | số người đang học

[ ] app/(dashboard)/learning-paths/[id]/page.tsx
    Timeline view các giai đoạn
    Assign cho user/group
```

### PHASE 7 — Năng lực & HR
```
[ ] app/(dashboard)/competency-frameworks/page.tsx
    Table: tên framework | số năng lực | số vị trí áp dụng

[ ] app/(dashboard)/competency-frameworks/[id]/page.tsx
    Tree view năng lực (group > competency > level)
    Mapping với khóa học

[ ] app/(dashboard)/positions/page.tsx
    Table: tên vị trí | phòng ban | framework áp dụng | số nhân viên

[ ] app/(dashboard)/position-changes/page.tsx
    Table: nhân viên | vị trí cũ | vị trí mới | ngày | trạng thái

[ ] app/(dashboard)/question-banks/page.tsx
    Table: tên ngân hàng | số câu hỏi | danh mục | tổ chức

[ ] app/(dashboard)/question-banks/[id]/page.tsx
    List câu hỏi: loại (MCQ/essay/true-false) | nội dung | độ khó
    Button thêm câu hỏi / import
```

### PHASE 8 — Báo cáo & Media
```
[ ] app/(dashboard)/reports/page.tsx
    Stat tổng quan (4 card)
    Chart: completion rate theo thời gian
    Table top khóa học / top học viên

[ ] app/(dashboard)/reports/compliance/page.tsx
    Filter: tổ chức | khoảng thời gian | loại báo cáo
    Table: nhân viên | khóa học bắt buộc | hoàn thành | deadline | trạng thái
    Export CSV button

[ ] app/(dashboard)/media-library/page.tsx
    Grid: thumbnail | tên file | loại | kích thước | ngày upload
    Upload button (drag & drop)
    Filter: video | PDF | ảnh
```

---

## QUY TẮC CODE BẮT BUỘC

### ✅ Màu — chỉ dùng token
```tsx
bg-primary       bg-primary-dark    bg-primary-tint
bg-success       bg-success-tint
bg-warning       bg-warning-tint
bg-danger        bg-danger-tint
bg-surface       bg-muted
text-content     text-subtle        text-faint
text-primary     text-success       text-warning     text-danger
border-default
```

### ✅ Typography
```tsx
text-[20px] font-medium   // stat số lớn
text-[14px] font-medium   // page title trong header
text-[13px] font-medium   // card heading, nav active
text-[12px]               // body, nav item, button
text-[11px]               // table cell, mô tả
text-[10px] font-medium   // badge, caption
text-[9px] uppercase tracking-widest  // nav group label
// font-weight TỐI ĐA: font-medium (500) — không dùng font-semibold/bold
```

### ✅ Card pattern
```tsx
<div className="bg-surface rounded-xl border border-default shadow-card">
  <div className="flex items-center justify-between px-4 py-3 border-b border-default">
    <h2 className="text-[13px] font-medium text-content">Tiêu đề</h2>
    <button className="text-[11px] text-primary">Action</button>
  </div>
  <div className="p-4">...</div>
</div>
```

### ✅ Table pattern
```tsx
<table className="w-full">
  <thead>
    <tr className="border-b border-default">
      <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Cột</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-default last:border-0 hover:bg-muted transition-colors">
      <td className="px-4 py-3 text-[12px] font-medium text-content">...</td>
      <td className="px-4 py-3 text-[11px] text-subtle">...</td>
    </tr>
  </tbody>
</table>
```

### ✅ Status badge
```tsx
const BADGE = {
  done:     'bg-success-tint text-success',
  progress: 'bg-primary-tint text-primary',
  warning:  'bg-warning-tint text-warning',
  danger:   'bg-danger-tint  text-danger',
}
<span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${BADGE[status]}`}>
  {label}
</span>
```

### ✅ Primary button
```tsx
<button className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white
                   text-[12px] font-medium rounded-lg px-3 py-2 transition-colors
                   active:scale-[0.98]">
  <Plus size={14} /> Thêm mới
</button>
```

### ✅ Icon — chỉ lucide-react
```tsx
// Nav: size={16}
// Button: size={14}
// Stat card icon: size={15}
// Action icon: size={16}
```

### ❌ KHÔNG được làm
```
- Không hardcode màu hex hoặc dùng Tailwind default (bg-blue-600, text-gray-900...)
- Không dùng font-semibold, font-bold
- Không dùng shadow-lg, shadow-xl, shadow-md
- Không dùng rounded-2xl cho card (chỉ rounded-xl)
- Không dùng inline style={{ }}
- Không xoá API calls, data fetching, TypeScript types
- Không thay đổi file trong app/(pwa)/ — đó là PWA riêng
- Không thay đổi auth middleware
```

---

## TRANG ĐẶC BIỆT — LESSON CONTENT EDITOR

`/courses/[id]/lessons/[lessonId]/content` là trang editor fullscreen.
Layout khác với các trang còn lại — KHÔNG dùng WebShell:

```tsx
// Layout riêng cho editor
<div className="h-screen flex flex-col bg-surface">
  {/* Minimal header */}
  <header className="h-12 bg-primary flex items-center justify-between px-4 flex-shrink-0">
    <div className="flex items-center gap-2">
      <button className="text-white/80 hover:text-white"><ArrowLeft size={18} /></button>
      <span className="text-[13px] font-medium text-white">Chỉnh sửa: {lessonTitle}</span>
    </div>
    <div className="flex items-center gap-2">
      <button className="text-[11px] text-white/70 hover:text-white px-2 py-1">Lưu nháp</button>
      <button className="bg-white text-primary text-[11px] font-medium px-3 py-1 rounded-lg">
        Xuất bản
      </button>
    </div>
  </header>
  {/* Editor area */}
  <main className="flex-1 overflow-hidden">...</main>
</div>
```

---

## CONFIRMATION GATE — BẮT BUỘC

Sau mỗi phase, DỪNG LẠI và báo cáo theo format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ PHASE [N] HOÀN THÀNH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files đã tạo/sửa:
  + components/web/web-shell.tsx     (mới)
  ~ tailwind.config.ts               (sửa)

Kiểm tra tại:
  http://localhost:3000/dashboard

Vấn đề phát hiện:
  ⚠ [mô tả nếu có]

Tiếp tục Phase [N+1]: [tên phase]?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

KHÔNG tự động sang phase tiếp theo khi chưa có xác nhận "yes".

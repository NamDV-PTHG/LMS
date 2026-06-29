# LMS PWA — Design System
> Nguồn sự thật duy nhất cho UI. Mọi component phải tuân theo file này.
> Dùng cho: Claude CLI (code generation) và claude.ai Artifact (design preview).

---

## 1. Color Tokens

### Brand
| Token | Tailwind class | Hex | Dùng cho |
|---|---|---|---|
| Primary | `bg-primary` / `text-primary` | #185FA5 | Button chính, active nav, link |
| Primary Dark | `bg-primary-dark` | #0C447C | Gradient start, hover state |
| Primary Light | `bg-primary-light` | #378ADD | Gradient end, accent nhẹ |
| Primary Tint | `bg-primary-tint` | #E6F1FB | Background badge, selected option, highlight row |

### Semantic
| Token | Tailwind class | Hex | Dùng cho |
|---|---|---|---|
| Success | `bg-success` / `text-success` | #3B6D11 | Hoàn thành, correct answer |
| Success Tint | `bg-success-tint` | #EAF3DE | Background badge success |
| Warning | `bg-warning` / `text-warning` | #854F0B | Deadline, cảnh báo |
| Warning Tint | `bg-warning-tint` | #FAEEDA | Background badge warning |
| Danger | `bg-danger` / `text-danger` | #993C1D | Sai, lỗi, xoá |
| Danger Tint | `bg-danger-tint` | #FAECE7 | Background badge danger |

### Neutral (Surface)
| Token | Tailwind class | Hex | Dùng cho |
|---|---|---|---|
| Surface White | `bg-surface` | #FFFFFF | Card, bottom nav, header |
| Surface Muted | `bg-muted` | #F1EFE8 | Page background |
| Border Default | `border-default` | rgba(0,0,0,0.08) | Card border, divider |
| Text Primary | `text-content` | #111827 | Tiêu đề, nội dung chính |
| Text Secondary | `text-subtle` | #4B5563 | Mô tả, label |
| Text Muted | `text-faint` | #9CA3AF | Placeholder, time, caption |

---

## 2. Typography

Font: **Inter** (Google Fonts — tự động load qua next/font)

```
Heading 1   : text-xl    font-medium   (20px / 500) — Tên màn hình
Heading 2   : text-[17px] font-medium  (17px / 500) — Tên card, section
Heading 3   : text-sm    font-medium   (14px / 500) — Label nhóm
Body        : text-[13px] font-normal  (13px / 400) — Nội dung chính
Caption     : text-xs    font-normal   (12px / 400) — Mô tả phụ
Micro       : text-[10px] font-normal  (10px / 400) — Time, badge label
```

**Quy tắc:**
- Sentence case toàn bộ — không dùng Title Case hay ALL CAPS
- Không dùng font-weight > 500 (tránh quá nặng trên mobile)
- Line-height mặc định: 1.5 cho body, 1.3 cho heading

---

## 3. Spacing

```
Page padding horizontal : px-4   (16px)
Page padding vertical   : py-4   (16px)
Card padding            : p-4    (16px) hoặc p-3 (12px) cho compact
Section gap             : gap-3  (12px)
Element gap trong card  : gap-2  (8px) hoặc gap-2.5 (10px)
```

---

## 4. Border Radius

```
Card, Modal, Bottom sheet : rounded-xl   (12px)
Button, Input, Badge      : rounded-lg   (10px) hoặc rounded-[10px]
Chip, Tag nhỏ             : rounded-full (pill)
Avatar                    : rounded-full
```

---

## 5. Shadows

```
Card         : shadow-card   → 0 0 0 0.5px rgba(0,0,0,0.08)
Bottom nav   : shadow-nav    → 0 -1px 0 rgba(0,0,0,0.06)
Video player : không dùng shadow
```

Không dùng shadow nặng — chỉ dùng border 0.5px thay thế.

---

## 6. Component Patterns

### Bottom Navigation
```
Height       : h-16 (64px) + safe-area-inset-bottom
Background   : bg-surface
Border top   : border-t border-default (0.5px)
Item active  : text-primary + dot indicator (w-1 h-1 rounded-full bg-primary)
Item inactive: text-faint
Icon size    : text-[22px] (dùng lucide-react)
Label size   : text-[10px]
Tabs         : 5 tab (Home, Courses, Progress, Notifications, Profile)
```

### Header / Top Bar
```
Height       : h-14 (56px)
Background   : bg-surface
Border bottom: border-b border-default (0.5px)
Title        : text-[17px] font-medium text-content
Back button  : lucide ArrowLeft, size 22px, text-subtle
```

### Card
```
Background   : bg-surface
Border       : border border-default (0.5px solid)
Border radius: rounded-xl (12px)
Padding      : p-4 (16px)
```

### Button Primary
```
bg-primary text-white font-medium text-[13px]
rounded-[10px] px-4 py-2.5
active:scale-[0.98] transition-transform
```

### Button Secondary
```
border border-default bg-transparent text-subtle font-medium text-[13px]
rounded-[10px] px-4 py-2.5
```

### Input / Textarea
```
border border-default rounded-lg px-3 py-2 text-[13px] text-content
placeholder:text-faint bg-muted
focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
```

### Badge / Status Chip
```
COMPLETED  : bg-success-tint text-success   rounded-full px-2.5 py-0.5 text-[10px] font-medium
IN_PROGRESS: bg-primary-tint text-primary   rounded-full px-2.5 py-0.5 text-[10px] font-medium
NOT_STARTED: bg-warning-tint text-warning   rounded-full px-2.5 py-0.5 text-[10px] font-medium
OVERDUE    : bg-danger-tint  text-danger    rounded-full px-2.5 py-0.5 text-[10px] font-medium
```

### Progress Bar
```
Track : h-1 bg-border rounded-full (thin, subtle)
Fill  : bg-primary rounded-full
Thick : h-1.5 (cho course hero)
```

### Lesson Type Icons (lucide-react)
```
VIDEO : Video     — text-primary
PDF   : FileText  — text-danger
QUIZ  : ClipboardCheck — text-success
```

### Lesson Status Indicators
```
DONE    : w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center → <Check size={12} />
ACTIVE  : w-7 h-7 rounded-full bg-primary-tint border border-primary text-primary → số thứ tự
LOCKED  : w-7 h-7 rounded-full border border-default text-faint → số thứ tự
```

### Chat Bubble
```
Incoming: bg-muted border border-default text-content rounded-2xl rounded-bl-sm px-3 py-2
Outgoing: bg-primary text-white rounded-2xl rounded-br-sm px-3 py-2
Font    : text-[13px] leading-relaxed
```

### Video Hero (Course Detail)
```
Height     : aspect-video hoặc h-40 (160px) cố định
Background : bg-gradient-to-br from-primary-dark via-primary to-primary-light
Back button: absolute top-3 left-3, w-8 h-8 rounded-full bg-white/20 text-white
```

---

## 7. Icons

Dùng **lucide-react** (đã có sẵn trong shadcn/ui).

```
Home          : Home
Courses       : BookOpen
Progress      : TrendingUp
Notifications : Bell
Profile       : User
Back          : ArrowLeft
Play          : Play
Video lesson  : Video
PDF lesson    : FileText
Quiz lesson   : ClipboardCheck
Done check    : Check
Download      : Download
Send (chat)   : Send
Clock (timer) : Clock
Flame (streak): Flame
Trophy        : Trophy
Star          : Star
Certificate   : Award
Settings      : Settings
```

---

## 8. PWA-specific

### Layout wrapper (áp dụng cho mọi màn hình)
```
Container tối đa: max-w-md mx-auto  (448px — giống phone frame)
Chiều cao        : min-h-screen
Padding bottom   : pb-16 (chừa chỗ cho bottom nav cố định)
Background       : bg-muted
```

### Bottom Nav — cố định
```
position: fixed
bottom: 0, left: 0, right: 0
z-index: 50
padding-bottom: env(safe-area-inset-bottom)  ← quan trọng cho iPhone notch
```

### Hero gradient (Home, Progress)
```
background: linear-gradient(135deg, #0C447C 0%, #185FA5 60%, #378ADD 100%)
```

---

## 9. Animation

```
Button tap     : active:scale-[0.98] transition-transform duration-100
Page transition: opacity-0 → opacity-100, duration-200
Skeleton loader: animate-pulse bg-muted
Progress fill  : transition-all duration-500 ease-out
```

---

## 10. Screens & Routes (PWA tại /app)

| Route | Màn hình | Component |
|---|---|---|
| /app | Home / Dashboard | `HomScreen` |
| /app/courses | Danh sách khóa học | `CoursesScreen` |
| /app/courses/[id] | Chi tiết khóa học | `CourseDetailScreen` |
| /app/courses/[id]/lessons/[lessonId] | Xem bài giảng video | `LessonPlayerScreen` |
| /app/courses/[id]/quiz/[quizId] | Làm bài kiểm tra | `QuizScreen` |
| /app/progress | Tiến độ học tập | `ProgressScreen` |
| /app/notifications | Thông báo | `NotificationsScreen` |
| /app/chat | Danh sách chat | `ChatListScreen` |
| /app/chat/[roomId] | Chat với giảng viên | `ChatRoomScreen` |
| /app/profile | Hồ sơ học viên | `ProfileScreen` |

---

## 11. Không được làm

- ❌ Không dùng `font-bold` hay `font-semibold` (dùng `font-medium` max)
- ❌ Không dùng shadow nặng (`shadow-lg`, `shadow-xl`)
- ❌ Không dùng màu gradient trên text (chỉ dùng trên background)
- ❌ Không dùng `px-6` hay `px-8` trong card nội dung
- ❌ Không dùng `rounded-2xl` cho card (chỉ `rounded-xl`)
- ❌ Không hardcode màu hex inline — luôn dùng Tailwind class từ config
- ❌ Không dùng `position: fixed` cho modal (dùng sheet từ shadcn/ui)
- ❌ Không thêm border-radius cho bottom nav (flat, full-width)

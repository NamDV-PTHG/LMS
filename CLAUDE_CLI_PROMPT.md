# Claude CLI — PWA Learner App Build Prompt
> Copy toàn bộ file này làm prompt khởi đầu khi bắt đầu session Claude CLI mới.
> Kết hợp với: DESIGN_SYSTEM.md + tailwind.config.ts đã có trong project.

---

## CONTEXT

Bạn là senior frontend engineer xây dựng **PWA học viên** cho hệ thống LMS tập đoàn.

**Stack:**
- Next.js 14 App Router + TypeScript
- Tailwind CSS (config tại `tailwind.config.ts` trong project)
- shadcn/ui (đã cài sẵn)
- lucide-react (icon — đã có qua shadcn)
- next/font/google → Inter

**PWA chạy tại:** `/app/*` — cùng domain với LMS web chính
**Không có portal riêng** — dùng chung admin LMS

**Auth:** JWT (accessToken + refreshToken) — cùng hệ thống với LMS web

---

## DESIGN SYSTEM (BẮT BUỘC TUÂN THEO)

Đọc file `DESIGN_SYSTEM.md` trong project trước khi generate bất kỳ component nào.

### Màu cốt lõi (từ tailwind.config.ts)
```
primary          = #185FA5  → class: text-primary, bg-primary
primary-dark     = #0C447C  → class: bg-primary-dark
primary-light    = #378ADD  → class: bg-primary-light
primary-tint     = #E6F1FB  → class: bg-primary-tint
success          = #3B6D11  → class: text-success
success-tint     = #EAF3DE  → class: bg-success-tint
warning          = #854F0B  → class: text-warning
warning-tint     = #FAEEDA  → class: bg-warning-tint
danger           = #993C1D  → class: text-danger
danger-tint      = #FAECE7  → class: bg-danger-tint
surface          = #FFFFFF  → class: bg-surface
muted            = #F1EFE8  → class: bg-muted (page bg)
content          = #111827  → class: text-content
subtle           = #4B5563  → class: text-subtle
faint            = #9CA3AF  → class: text-faint
```

### Typography rules
- Font: Inter qua `next/font/google`, apply vào `<html>` qua `className`
- Weight tối đa: `font-medium` (500) — không dùng `font-semibold` hay `font-bold`
- Sentence case toàn bộ text UI

### Layout rules (PWA)
- Mọi page wrap trong: `<div className="max-w-phone mx-auto min-h-screen bg-muted">`
- Padding bottom bắt buộc: `pb-16` (chừa chỗ bottom nav)
- Bottom nav: `fixed bottom-0 left-0 right-0 z-50 max-w-phone mx-auto`

---

## CẤU TRÚC THƯ MỤC

```
app/
├── (pwa)/                         ← Route group cho PWA
│   ├── layout.tsx                 ← PWA layout: font + bottom nav + PWA meta
│   ├── page.tsx                   → redirect đến /app/home
│   ├── home/
│   │   └── page.tsx               ← Màn hình trang chủ
│   ├── courses/
│   │   ├── page.tsx               ← Danh sách khóa học
│   │   └── [courseId]/
│   │       ├── page.tsx           ← Chi tiết khóa học
│   │       ├── lessons/
│   │       │   └── [lessonId]/
│   │       │       └── page.tsx   ← Video player
│   │       └── quiz/
│   │           └── [quizId]/
│   │               └── page.tsx   ← Quiz
│   ├── progress/
│   │   └── page.tsx               ← Tiến độ học tập
│   ├── notifications/
│   │   └── page.tsx               ← Thông báo
│   ├── chat/
│   │   ├── page.tsx               ← Danh sách chat
│   │   └── [roomId]/
│   │       └── page.tsx           ← Chat room
│   └── profile/
│       └── page.tsx               ← Hồ sơ
├── components/
│   └── pwa/                       ← Components riêng cho PWA
│       ├── bottom-nav.tsx
│       ├── pwa-header.tsx
│       ├── course-card.tsx
│       ├── lesson-item.tsx
│       ├── progress-bar.tsx
│       ├── quiz-option.tsx
│       ├── chat-bubble.tsx
│       ├── notif-item.tsx
│       └── skeleton/
│           ├── course-skeleton.tsx
│           └── lesson-skeleton.tsx
└── public/
    ├── manifest.json              ← PWA manifest
    ├── sw.js                      ← Service worker
    └── icons/
        ├── icon-192.png
        └── icon-512.png
```

---

## RULES BẮT BUỘC KHI GENERATE CODE

### 1. Không được vi phạm design system
```typescript
// ✅ ĐÚNG
<div className="bg-surface rounded-xl shadow-card p-4">
<button className="bg-primary text-white text-13 font-medium rounded-lg px-4 py-2.5">

// ❌ SAI
<div className="bg-white rounded-2xl shadow-lg p-6">
<button className="bg-blue-600 text-white text-sm font-semibold rounded-xl px-6 py-3">
```

### 2. Icon — chỉ dùng lucide-react
```typescript
// ✅ ĐÚNG
import { Home, BookOpen, TrendingUp, Bell, User } from 'lucide-react'
<Home size={22} />

// ❌ SAI — không dùng heroicons, phosphor, hay SVG inline tự vẽ
```

### 3. Layout PWA wrapper — bắt buộc
```typescript
// Mọi page.tsx trong (pwa)/ phải có wrapper này
export default function SomePage() {
  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">
      {/* content */}
    </main>
  )
}
```

### 4. Bottom Nav — fixed, safe area aware
```typescript
// components/pwa/bottom-nav.tsx — không thay đổi structure này
<nav className="fixed bottom-0 left-0 right-0 max-w-phone mx-auto z-50
                bg-surface shadow-nav h-16
                pb-[env(safe-area-inset-bottom)]">
```

### 5. Server vs Client component
```typescript
// Page mặc định là Server Component — chỉ thêm 'use client' khi cần:
// - useState, useEffect, useRouter
// - Event handlers (onClick, onChange)
// - Browser APIs (localStorage, window)
// Data fetching: dùng async/await trong Server Component
```

### 6. API calls — pattern chuẩn
```typescript
// Dùng fetch với base URL từ env
const BASE_URL = process.env.NEXT_PUBLIC_API_URL

// Client component
const { data } = await fetch(`${BASE_URL}/api/learner/courses`, {
  headers: { Authorization: `Bearer ${token}` },
  next: { revalidate: 60 }  // cache 60s
})
```

### 7. Loading state — dùng skeleton, không dùng spinner
```typescript
// Mỗi page phải có loading.tsx kèm theo
// Skeleton dùng: animate-pulse bg-muted rounded
<div className="animate-pulse bg-muted rounded-xl h-24 w-full" />
```

### 8. Error state
```typescript
// Mỗi page phải có error.tsx
'use client'
export default function Error({ reset }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 px-4">
      <p className="text-content text-15 font-medium">Không tải được dữ liệu</p>
      <p className="text-faint text-13">Kiểm tra kết nối và thử lại</p>
      <button onClick={reset} className="bg-primary text-white text-13 font-medium
                                         rounded-lg px-4 py-2.5 mt-2">
        Thử lại
      </button>
    </div>
  )
}
```

---

## PWA MANIFEST & SERVICE WORKER

### public/manifest.json
```json
{
  "name": "LMS — Học viên",
  "short_name": "LMS",
  "description": "Ứng dụng học tập nội bộ",
  "start_url": "/app/home",
  "scope": "/app",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F1EFE8",
  "theme_color": "#185FA5",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### app/(pwa)/layout.tsx — PWA meta tags
```typescript
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LMS',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#185FA5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function PWALayout({ children }) {
  return (
    <div className={`${inter.variable} font-sans`}>
      {children}
      <BottomNav />
    </div>
  )
}
```

---

## PHASE BUILD (chạy từng phase, xác nhận trước khi tiếp)

### Phase 1 — Scaffold + Layout
```
1. Tạo cấu trúc thư mục app/(pwa)/
2. app/(pwa)/layout.tsx — PWA meta + Inter font + BottomNav
3. components/pwa/bottom-nav.tsx — 5 tabs, active state, safe area
4. components/pwa/pwa-header.tsx — back button + title variant
5. public/manifest.json
6. Kiểm tra: chạy /app/home → thấy layout + bottom nav đúng design
```

### Phase 2 — Home Screen
```
1. app/(pwa)/home/page.tsx
2. components/pwa/course-card.tsx (continue card + list item)
3. Stat cards (3 cột: khóa học / % hoàn thành / chứng chỉ)
4. Streak badge
5. loading.tsx + skeleton
```

### Phase 3 — Course Detail + Lesson List
```
1. app/(pwa)/courses/[courseId]/page.tsx
2. components/pwa/lesson-item.tsx (3 trạng thái: done/active/locked)
3. Tab bar (Nội dung / Tài liệu / Kiểm tra)
4. Course hero gradient
5. Progress bar tổng
```

### Phase 4 — Video Player
```
1. app/(pwa)/courses/[courseId]/lessons/[lessonId]/page.tsx
2. HLS player với expo-video hoặc video.js
3. Auto-renew Signed URL mỗi 18 phút (TTL backend 20 phút)
4. Tracking progress batch mỗi 10 giây → POST /api/learner/tracking/events/batch
5. Ghi chú cá nhân
6. Next lesson bar
```

### Phase 5 — Quiz Engine
```
1. app/(pwa)/courses/[courseId]/quiz/[quizId]/page.tsx
2. Progress steps (1..10)
3. Timer đếm ngược
4. Option states: default / selected / correct / wrong
5. Submit + kết quả cuối
```

### Phase 6 — Progress Screen
```
1. app/(pwa)/progress/page.tsx
2. Hero summary (% tổng, số khóa, streak)
3. Per-course progress bars
4. Achievement chips
```

### Phase 7 — Notifications
```
1. app/(pwa)/notifications/page.tsx
2. Unread badge trên nav icon
3. Group theo ngày (Hôm nay / Hôm qua / Trước đó)
4. Mark all as read
```

### Phase 8 — Chat
```
1. app/(pwa)/chat/page.tsx — danh sách conversation
2. app/(pwa)/chat/[roomId]/page.tsx — chat room
3. Socket.io client (useEffect, không SSR)
4. Bubble states: incoming / outgoing / read receipt
```

---

## CONFIRMATION GATE

Sau mỗi phase, dừng lại và hỏi:
> "Phase [N] hoàn thành. Kết quả:
> ✅ [liệt kê file đã tạo]
> 🔍 Kiểm tra tại: [URL]
> Tiếp tục Phase [N+1]?"

Không tự động sang phase tiếp theo khi chưa được xác nhận.

---

## LƯU Ý ĐẶC BIỆT

1. **Signed URL HLS** — TTL 20 phút. Video player phải tự renew trước 2 phút khi hết hạn.
2. **Tracking batch** — không gọi API sau mỗi giây. Queue sự kiện, flush mỗi 10 giây hoặc khi unmount.
3. **Safe area** — bottom nav phải có `pb-[env(safe-area-inset-bottom)]` cho iPhone notch.
4. **PWA install** — thêm "Add to Home Screen" banner cho user lần đầu vào /app trên mobile.
5. **Offline** — Service worker cache shell app + static assets. Khi offline hiện "Đang ngoại tuyến" thay vì crash.
6. **shadcn/ui** — chỉ dùng Sheet (bottom sheet), Skeleton, Toast từ shadcn. Không dùng shadcn Button/Card vì đã có custom class riêng.

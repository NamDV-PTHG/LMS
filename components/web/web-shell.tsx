'use client'

/**
 * LMS Web Shell — Option A: Clean Professional
 * Layout: Sidebar trắng (w-52) + Header xanh (#185FA5) + Content area
 * Dùng cho: tất cả role (group_admin, company_admin, hr_manager, instructor, learner)
 *
 * Import:
 *   import { WebShell } from '@/../components/web/web-shell'   ← từ pages
 *   // hoặc dùng qua (dashboard)/layout.tsx — không cần import trực tiếp
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, BarChart2, Users, Building2, Upload,
  BookOpen, Users2, Map, Library, Target, Briefcase,
  ArrowLeftRight, ClipboardList, Settings, Bot, Server,
  Bell, Search, Menu, X, ChevronDown, LogOut, KeyRound, User,
  LayoutList,
} from 'lucide-react'
import { useAuth } from '../../src/components/providers/auth-provider'

// ─── Types ───────────────────────────────────────────────────────
type LucideIcon = React.ComponentType<{ size?: number; className?: string }>

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

interface NavGroup {
  label: string
  items: NavItem[]
}

interface CompanyInfo {
  name: string
  logoUrl: string | null
  primaryColor: string | null
  siteTitle: string | null
  siteDescription: string | null
}

// ─── Route Title Map ─────────────────────────────────────────────
const ROUTE_TITLES: Record<string, string> = {
  '/dashboard':               'Dashboard',
  '/reports/compliance':      'Báo cáo tuân thủ',
  '/reports/ai-usage':        'Báo cáo sử dụng AI',
  '/reports':                 'Báo cáo',
  '/users':                   'Người dùng',
  '/organizations':           'Tổ chức',
  '/import':                  'Nhập liệu',
  '/courses':                 'Khóa học',
  '/learning-groups':         'Nhóm học tập',
  '/learning-paths':          'Lộ trình học',
  '/media-library':           'Thư viện tài liệu',
  '/competency-frameworks':   'Khung năng lực',
  '/job-title-catalog':       'Danh mục Chức danh',
  '/positions':               'Vị trí công việc',
  '/competency-reports':      'Báo cáo Năng lực',
  '/position-changes':        'Thay đổi vị trí',
  '/question-banks':          'Ngân hàng câu hỏi',
  '/settings':                'Cài đặt',
  '/ai-config':               'Cấu hình AI',
  '/operations':              'Vận hành hệ thống',
  '/profile':                 'Hồ sơ',
  '/my-courses':              'Khóa học của tôi',
  '/my-learning-paths':       'Lộ trình của tôi',
}

function getPageTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  const match = Object.entries(ROUTE_TITLES)
    .filter(([k]) => pathname.startsWith(k) && k !== '/')
    .sort((a, b) => b[0].length - a[0].length)[0]
  return match ? match[1] : 'LMS'
}

// ─── Role Labels ─────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  group_admin:   'Quản trị tập đoàn',
  company_admin: 'Quản trị công ty',
  hr_manager:    'HR Manager',
  group_hrm:     'HR Tập đoàn',
  instructor:    'Giảng viên',
  learner:       'Học viên',
}

// ─── Navigation per role ─────────────────────────────────────────
const NAV_BY_ROLE: Record<string, NavGroup[]> = {

  group_admin: [
    {
      label: 'Tổng quan',
      items: [
        { label: 'Dashboard',          href: '/dashboard',              icon: LayoutDashboard },
        { label: 'Báo cáo',            href: '/reports',                icon: BarChart2 },
        { label: 'Báo cáo AI',         href: '/reports/ai-usage',       icon: Bot },
      ],
    },
    {
      label: 'Người dùng & Tổ chức',
      items: [
        { label: 'Người dùng',         href: '/users',                  icon: Users },
        { label: 'Tổ chức',            href: '/organizations',          icon: Building2 },
        { label: 'Nhập liệu',          href: '/import',                 icon: Upload },
      ],
    },
    {
      label: 'Học tập',
      items: [
        { label: 'Khóa học',           href: '/courses',                icon: BookOpen },
        { label: 'Nhóm học tập',       href: '/learning-groups',        icon: Users2 },
        { label: 'Lộ trình học',       href: '/learning-paths',         icon: Map },
        { label: 'Thư viện tài liệu',  href: '/media-library',          icon: Library },
      ],
    },
    {
      label: 'Năng lực & HR',
      items: [
        { label: 'Khung năng lực',     href: '/competency-frameworks',  icon: Target },
        { label: 'Danh mục Chức danh', href: '/job-title-catalog',      icon: LayoutList },
        { label: 'Vị trí công việc',   href: '/positions',              icon: Briefcase },
        { label: 'Thay đổi vị trí',    href: '/position-changes',       icon: ArrowLeftRight },
        { label: 'Báo cáo Năng lực',   href: '/competency-reports',     icon: BarChart2 },
        { label: 'Ngân hàng câu hỏi',  href: '/question-banks',         icon: ClipboardList },
      ],
    },
    {
      label: 'Thông báo',
      items: [
        { label: 'Thông báo',          href: '/notifications',          icon: Bell },
      ],
    },
    {
      label: 'Hệ thống',
      items: [
        { label: 'Cài đặt',            href: '/settings',               icon: Settings },
        { label: 'Cấu hình AI',        href: '/ai-config',              icon: Bot },
        { label: 'Vận hành',           href: '/operations',             icon: Server },
      ],
    },
  ],

  company_admin: [
    {
      label: 'Tổng quan',
      items: [
        { label: 'Dashboard',          href: '/dashboard',              icon: LayoutDashboard },
        { label: 'Báo cáo',            href: '/reports',                icon: BarChart2 },
        { label: 'Báo cáo AI',         href: '/reports/ai-usage',       icon: Bot },
      ],
    },
    {
      label: 'Người dùng & Tổ chức',
      items: [
        { label: 'Người dùng',         href: '/users',                  icon: Users },
        { label: 'Tổ chức',            href: '/organizations',          icon: Building2 },
        { label: 'Nhập liệu',          href: '/import',                 icon: Upload },
      ],
    },
    {
      label: 'Học tập',
      items: [
        { label: 'Khóa học',           href: '/courses',                icon: BookOpen },
        { label: 'Nhóm học tập',       href: '/learning-groups',        icon: Users2 },
        { label: 'Lộ trình học',       href: '/learning-paths',         icon: Map },
        { label: 'Thư viện tài liệu',  href: '/media-library',          icon: Library },
      ],
    },
    {
      label: 'Năng lực & HR',
      items: [
        { label: 'Khung năng lực',     href: '/competency-frameworks',  icon: Target },
        { label: 'Danh mục Chức danh', href: '/job-title-catalog',      icon: LayoutList },
        { label: 'Vị trí công việc',   href: '/positions',              icon: Briefcase },
        { label: 'Báo cáo Năng lực',   href: '/competency-reports',     icon: BarChart2 },
        { label: 'Ngân hàng câu hỏi',  href: '/question-banks',         icon: ClipboardList },
      ],
    },
    {
      label: 'Thông báo',
      items: [
        { label: 'Thông báo',          href: '/notifications',          icon: Bell },
      ],
    },
    {
      label: 'Hệ thống',
      items: [
        { label: 'Cài đặt',            href: '/settings',               icon: Settings },
        { label: 'Nhật ký hoạt động',  href: '/operations',             icon: ClipboardList },
      ],
    },
  ],

  hr_manager: [
    {
      label: 'Tổng quan',
      items: [
        { label: 'Dashboard',          href: '/dashboard',              icon: LayoutDashboard },
        { label: 'Báo cáo',            href: '/reports',                icon: BarChart2 },
      ],
    },
    {
      label: 'Người dùng & Tổ chức',
      items: [
        { label: 'Người dùng',         href: '/users',                  icon: Users },
        { label: 'Tổ chức',            href: '/organizations',          icon: Building2 },
        { label: 'Nhập liệu',          href: '/import',                 icon: Upload },
      ],
    },
    {
      label: 'Học tập',
      items: [
        { label: 'Khóa học',           href: '/courses',                icon: BookOpen },
        { label: 'Nhóm học tập',       href: '/learning-groups',        icon: Users2 },
        { label: 'Lộ trình học',       href: '/learning-paths',         icon: Map },
        { label: 'Thư viện tài liệu',  href: '/media-library',          icon: Library },
      ],
    },
    {
      label: 'Năng lực & HR',
      items: [
        { label: 'Khung năng lực',     href: '/competency-frameworks',  icon: Target },
        { label: 'Danh mục Chức danh', href: '/job-title-catalog',      icon: LayoutList },
        { label: 'Vị trí công việc',   href: '/positions',              icon: Briefcase },
        { label: 'Thay đổi vị trí',    href: '/position-changes',       icon: ArrowLeftRight },
        { label: 'Báo cáo Năng lực',   href: '/competency-reports',     icon: BarChart2 },
        { label: 'Ngân hàng câu hỏi',  href: '/question-banks',         icon: ClipboardList },
      ],
    },
    {
      label: 'Thông báo',
      items: [
        { label: 'Thông báo',          href: '/notifications',          icon: Bell },
      ],
    },
  ],

  instructor: [
    {
      label: 'Học tập',
      items: [
        { label: 'Dashboard',          href: '/dashboard',              icon: LayoutDashboard },
        { label: 'Khóa học',           href: '/courses',                icon: BookOpen },
        { label: 'Lộ trình học',       href: '/learning-paths',         icon: Map },
        { label: 'Thư viện tài liệu',  href: '/media-library',          icon: Library },
        { label: 'Ngân hàng câu hỏi',  href: '/question-banks',         icon: ClipboardList },
      ],
    },
    {
      label: 'Thông báo',
      items: [
        { label: 'Thông báo',          href: '/notifications',          icon: Bell },
      ],
    },
  ],

  learner: [
    {
      label: 'Học tập của tôi',
      items: [
        { label: 'Dashboard',           href: '/dashboard',             icon: LayoutDashboard },
        { label: 'Khóa học của tôi',    href: '/my-courses',            icon: BookOpen },
        { label: 'Lộ trình của tôi',    href: '/my-learning-paths',     icon: Map },
        { label: 'Thông báo',           href: '/notifications',         icon: Bell },
      ],
    },
  ],
}

// group_hrm có nav tương tự hr_manager
NAV_BY_ROLE.group_hrm = NAV_BY_ROLE.hr_manager

// Thứ tự ưu tiên role khi user có nhiều roles
const ROLE_PRIORITY = ['group_admin', 'company_admin', 'group_hrm', 'hr_manager', 'instructor', 'learner']

// Mục học tập cá nhân — thêm vào sidebar khi user có role learner + role khác
const LEARNER_EXTRA: NavGroup = {
  label: 'Học tập của tôi',
  items: [
    { label: 'Khóa học của tôi',  href: '/my-courses',       icon: BookOpen },
    { label: 'Lộ trình của tôi',  href: '/my-learning-paths', icon: Map },
  ],
}

// ─── Sidebar ─────────────────────────────────────────────────────
function Sidebar({
  open,
  onClose,
  navGroups,
  company,
}: {
  open: boolean
  onClose: () => void
  navGroups: NavGroup[]
  company: CompanyInfo | null
}) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          'fixed top-0 left-0 h-full w-52 bg-surface z-40 flex flex-col',
          'border-r border-default transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:static lg:z-auto',
        ].join(' ')}
      >
        {/* Logo / Company branding */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-default flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-white" />
          </div>
          {company?.logoUrl ? (
            <div className="relative h-7 flex-1 min-w-0">
              <Image
                src={company.logoUrl}
                alt={company.name}
                fill
                className="object-contain object-left"
                unoptimized
              />
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-content leading-none truncate">
                {company?.name || 'Phú Thái LMS'}
              </p>
              <p className="text-[10px] text-faint mt-0.5">Holdings Group</p>
            </div>
          )}
          {/* Mobile close */}
          <button onClick={onClose} className="ml-auto lg:hidden text-faint hover:text-subtle">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-none">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-1">
              <p className="text-[9px] font-medium text-faint tracking-widest uppercase px-4 pt-3 pb-1.5">
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={[
                      'relative flex items-center gap-2.5 px-4 py-[7px] text-[12px] transition-colors',
                      active
                        ? 'text-primary bg-primary-tint font-medium'
                        : 'text-subtle hover:bg-muted hover:text-content',
                    ].join(' ')}
                  >
                    {active && (
                      <span className="absolute left-0 top-1 bottom-1 w-[3px] bg-primary rounded-r-full" />
                    )}
                    <Icon size={16} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-default p-3 flex-shrink-0">
          <UserMenu />
        </div>
      </aside>
    </>
  )
}

// ─── User Menu ───────────────────────────────────────────────────
function UserMenu() {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()

  if (!user) return null

  const initials = user.fullName
    .split(' ')
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  const primaryRole = ROLE_PRIORITY.find((r) =>
    user.roles.some((ur) => (typeof ur === 'string' ? ur : (ur as { role: string }).role) === r),
  ) ?? 'learner'
  const roleLabel = ROLE_LABELS[primaryRole] ?? primaryRole

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 hover:bg-muted transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-primary text-white text-[11px] font-medium flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[11px] font-medium text-content truncate">{user.fullName}</p>
          <p className="text-[10px] text-faint">{roleLabel}</p>
        </div>
        <ChevronDown
          size={14}
          className={`text-faint transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface border border-default rounded-xl shadow-card overflow-hidden z-20">
            <div className="px-3 py-2 border-b border-default">
              <p className="text-[11px] font-medium text-content">{user.fullName}</p>
              <p className="text-[10px] text-faint truncate">{user.email}</p>
            </div>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-[12px] text-subtle hover:bg-muted transition-colors"
            >
              <User size={14} /> Hồ sơ cá nhân
            </Link>
            <Link
              href="/change-password"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-[12px] text-subtle hover:bg-muted transition-colors"
            >
              <KeyRound size={14} /> Đổi mật khẩu
            </Link>
            <button
              onClick={() => { setOpen(false); logout() }}
              className="flex items-center gap-2 px-3 py-2 text-[12px] text-danger hover:bg-danger-tint transition-colors w-full border-t border-default"
            >
              <LogOut size={14} /> Đăng xuất
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────
function Header({ pageTitle, onMenuOpen, unreadCount }: { pageTitle: string; onMenuOpen: () => void; unreadCount: number }) {
  const router = useRouter()
  return (
    <header className="h-[52px] bg-primary flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuOpen} className="lg:hidden text-white/80 hover:text-white">
          <Menu size={20} />
        </button>
        <h1 className="text-[14px] font-medium text-white">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="hidden sm:flex items-center gap-2 bg-white/15 rounded-lg px-3 py-1.5 w-44 cursor-pointer hover:bg-white/20 transition-colors">
          <Search size={13} className="text-white/70" />
          <span className="text-[11px] text-white/60">Tìm kiếm...</span>
          <kbd className="ml-auto text-[9px] text-white/40 bg-white/10 px-1 py-px rounded">⌘K</kbd>
        </div>

        {/* Notification bell */}
        <button
          onClick={() => router.push('/notifications')}
          className="relative w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
        >
          <Bell size={16} className="text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-danger text-white text-[9px] font-medium flex items-center justify-center px-1 border border-primary">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}

// ─── Loading screen ──────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-muted">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[12px] text-subtle">Đang tải...</p>
      </div>
    </div>
  )
}

// ─── Web Shell (main export) ─────────────────────────────────────
export function WebShell({ children }: { children: React.ReactNode }) {
  const { user, accessToken, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [company, setCompany] = useState<CompanyInfo | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  // Auth redirect
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [isLoading, user, router])

  // Fetch company branding
  useEffect(() => {
    if (!accessToken) return
    fetch('/api/me/company', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => { if (res.success) setCompany(res.data as CompanyInfo) })
      .catch(() => {})
  }, [accessToken])

  // Poll unread notification count every 60s
  useEffect(() => {
    if (!accessToken) return
    const fetchCount = () => {
      fetch('/api/notifications?limit=50', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => r.json())
        .then((res) => { if (res.success) setUnreadCount(res.meta?.unreadCount ?? 0) })
        .catch(() => {})
    }
    fetchCount()
    const timer = setInterval(fetchCount, 60000)
    return () => clearInterval(timer)
  }, [accessToken])

  // Apply company primary color as CSS variable
  useEffect(() => {
    if (company?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', company.primaryColor)
    }
  }, [company?.primaryColor])

  // Set document title and meta description from company branding
  useEffect(() => {
    const title = company?.siteTitle || company?.name
    if (title) {
      document.title = title
    }
    const desc = company?.siteDescription
    if (desc) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
      }
      meta.content = desc
    }
  }, [company?.siteTitle, company?.name, company?.siteDescription])

  if (isLoading) return <LoadingScreen />
  if (!user) return null

  // roles có thể là string[] (từ login) hoặc {role: string}[] (từ /api/auth/me)
  const userRoles = user.roles.map((r) =>
    typeof r === 'string' ? r : (r as { role: string }).role
  )
  const primaryRole = ROLE_PRIORITY.find((r) => userRoles.includes(r)) ?? 'learner'
  const baseNavGroups = NAV_BY_ROLE[primaryRole] ?? NAV_BY_ROLE.learner

  // Nếu user có learner role nhưng primary role là instructor/admin → thêm section học tập cá nhân
  const navGroups =
    primaryRole !== 'learner' && userRoles.includes('learner')
      ? [...baseNavGroups, LEARNER_EXTRA]
      : baseNavGroups

  const pageTitle = getPageTitle(pathname)

  return (
    <div className="flex h-screen overflow-hidden bg-muted">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navGroups={navGroups}
        company={company}
      />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header
          pageTitle={pageTitle}
          onMenuOpen={() => setSidebarOpen(true)}
          unreadCount={unreadCount}
        />
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  )
}

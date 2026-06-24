'use client';

import { AuthProvider, useAuth } from '@/components/providers/auth-provider';
import { ToastProvider } from '@/components/ui/toast';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// ── Role helper ────────────────────────────────────────────────
const getRole = (r: unknown): string =>
  typeof r === 'string' ? r : (r as { role: string }).role;

// ── Nav config ─────────────────────────────────────────────────
const NAV_LINKS = [
  { href: '/dashboard',             label: 'Dashboard',           roles: ['group_admin','group_hrm','company_admin','hr_manager','instructor','learner'] },
  { href: '/reports',               label: 'Báo cáo',             roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/learning-groups',       label: 'Nhóm học tập',        roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/competency-frameworks', label: 'Khung năng lực',      roles: ['group_admin','group_hrm','company_admin'] },
  { href: '/learning-paths',        label: 'Lộ trình học',        roles: ['group_admin','group_hrm','company_admin'] },
  { href: '/positions',             label: 'Vị trí',              roles: ['group_admin','group_hrm','company_admin'] },
  { href: '/position-changes',      label: 'Thay đổi vị trí',    roles: ['group_admin','group_hrm'] },
  { href: '/ai-config',             label: 'Cấu hình AI',         roles: ['group_admin'] },
  { href: '/courses',               label: 'Khóa học',            roles: ['group_admin','group_hrm','company_admin','hr_manager','instructor'] },
  { href: '/users',                 label: 'Người dùng',          roles: ['company_admin','hr_manager'] },
  { href: '/import',                label: 'Nhập liệu',           roles: ['company_admin','hr_manager'] },
  { href: '/reports/compliance',    label: 'Tuân thủ',            roles: ['company_admin','hr_manager'] },
  { href: '/question-banks',        label: 'Ngân hàng câu hỏi',  roles: ['company_admin', 'hr_manager', 'instructor'] },
  { href: '/organizations',         label: 'Tổ chức',             roles: ['group_admin', 'company_admin'] },
  { href: '/my-courses',            label: 'Khóa học của tôi',    roles: ['learner'] },
  { href: '/my-learning-paths',     label: 'Lộ trình của tôi',   roles: ['learner'] },
  { href: '/settings',               label: 'Cài đặt',             roles: ['group_admin', 'company_admin'] },
];

// ── Inner shell (uses useAuth inside AuthProvider) ─────────────
function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const userRoles = user.roles?.map(getRole) ?? [];

  const visibleLinks = NAV_LINKS.filter((l) =>
    l.roles.some((r) => userRoles.includes(r)),
  );

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-60 bg-white border-r flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b shrink-0">
          <span className="font-bold text-blue-600 text-lg tracking-tight">LMS</span>
          <span className="ml-1 text-gray-500 text-sm font-medium">Tập đoàn</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {visibleLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                ${isActive(l.href)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* User info */}
        <div className="border-t p-3 shrink-0">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-semibold shrink-0">
              {user.fullName?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{user.fullName}</p>
              <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <Link
            href="/profile"
            className="block w-full text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md px-2 py-1.5 text-left transition-colors mb-1"
          >
            Đổi mật khẩu
          </Link>
          <button
            onClick={() => logout()}
            className="w-full text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md px-2 py-1.5 text-left transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="h-14 bg-white border-b flex items-center px-4 gap-3 lg:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-gray-100"
            aria-label="Mở menu"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-gray-800 text-sm">LMS Tập đoàn</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Layout export (wraps with AuthProvider) ────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <DashboardShell>{children}</DashboardShell>
      </ToastProvider>
    </AuthProvider>
  );
}

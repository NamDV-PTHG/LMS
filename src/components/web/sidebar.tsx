'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import {
  LayoutDashboard, Building2, Users, BookOpen, Map,
  Target, Briefcase, ArrowRightLeft, BarChart2,
  Settings, Cpu, ClipboardList, LogOut, ChevronLeft,
  ChevronRight, Bell, User,
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
  exact?: boolean;
  mobileVisible?: boolean;
  group?: 'manage' | 'learn';
}

const NAV_ITEMS: NavItem[] = [
  // Dashboard — không thuộc nhóm nào, luôn hiển thị đầu
  { href: '/dashboard',             label: 'Dashboard',           icon: LayoutDashboard, mobileVisible: true,  exact: true,
    roles: ['group_admin','group_hrm','company_admin','hr_manager','instructor','learner','dept_head'] },

  // ── Nhóm Quản lý ──
  { href: '/organizations',         label: 'Tổ chức',             icon: Building2,       mobileVisible: false, group: 'manage',
    roles: ['group_admin','group_hrm'] },
  { href: '/users',                 label: 'Người dùng',          icon: Users,           mobileVisible: false, group: 'manage',
    roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/courses',               label: 'Khóa học',            icon: BookOpen,        mobileVisible: false, group: 'manage',
    roles: ['group_admin','group_hrm','company_admin','hr_manager','instructor'] },
  { href: '/learning-groups',       label: 'Nhóm học tập',        icon: Users,           mobileVisible: false, group: 'manage',
    roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/learning-paths',        label: 'Lộ trình học',        icon: Map,             mobileVisible: false, group: 'manage',
    roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/positions',             label: 'Vị trí công việc',    icon: Briefcase,       mobileVisible: false, group: 'manage',
    roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/competency-frameworks', label: 'Khung năng lực',      icon: Target,          mobileVisible: false, group: 'manage',
    roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/position-changes',      label: 'Thay đổi vị trí',    icon: ArrowRightLeft,  mobileVisible: false, group: 'manage',
    roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/question-banks',        label: 'Ngân hàng câu hỏi',  icon: ClipboardList,   mobileVisible: false, group: 'manage',
    roles: ['instructor','company_admin','hr_manager','group_admin','group_hrm'] },
  { href: '/reports',               label: 'Báo cáo',             icon: BarChart2,       mobileVisible: false, group: 'manage',
    roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/reports/ai-usage',      label: 'Báo cáo AI',          icon: Cpu,             mobileVisible: false, group: 'manage',
    roles: ['group_admin'] },
  { href: '/my-department',         label: 'Bộ phận của tôi',     icon: Building2,       mobileVisible: false, group: 'manage',
    roles: ['dept_head','company_admin','hr_manager'] },
  { href: '/ai-config',             label: 'Cấu hình AI',         icon: Cpu,             mobileVisible: false, group: 'manage',
    roles: ['group_admin'] },
  { href: '/settings',              label: 'Cài đặt',             icon: Settings,        mobileVisible: false, group: 'manage',
    roles: ['group_admin','company_admin'] },

  // ── Nhóm Học tập ──
  { href: '/my-courses',            label: 'Khóa học của tôi',    icon: BookOpen,        mobileVisible: true,  group: 'learn',
    roles: ['learner','instructor','dept_head','hr_manager','company_admin'] },
  { href: '/my-learning-paths',     label: 'Lộ trình của tôi',    icon: Map,             mobileVisible: true,  group: 'learn',
    roles: ['learner','instructor','dept_head','hr_manager','company_admin'] },
];

// Bottom nav items on mobile (fixed set, no role filtering beyond existing)
const MOBILE_BOTTOM_ITEMS: NavItem[] = [
  { href: '/dashboard',        label: 'Trang chủ',   icon: LayoutDashboard, roles: [] },
  { href: '/my-courses',       label: 'Khóa học',    icon: BookOpen,        roles: [] },
  { href: '/my-learning-paths',label: 'Lộ trình',    icon: Map,             roles: [] },
  { href: '/notifications',    label: 'Thông báo',   icon: Bell,            roles: [] },
  { href: '/profile',          label: 'Hồ sơ',       icon: User,            roles: [] },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role;
  const userRoles = user?.roles?.map(getRole) ?? [];

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  // ── Mobile: bottom navigation bar ─────────────────────────────
  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex justify-around items-center h-14 safe-area-inset-bottom">
        {MOBILE_BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${
                active ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[9px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  // ── Desktop: left sidebar ──────────────────────────────────────
  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.some((r) => userRoles.includes(r))
  );

  // Check if both manage and learn groups are visible (for divider rendering)
  const hasManage = visibleItems.some((i) => i.group === 'manage');
  const hasLearn  = visibleItems.some((i) => i.group === 'learn');
  const showGroups = hasManage && hasLearn;

  const GROUP_LABEL: Record<string, string> = {
    manage: 'Quản lý',
    learn:  'Học tập',
  };

  return (
    <aside
      className={`
        flex flex-col h-screen bg-white border-r border-default sticky top-0
        transition-all duration-200 ease-in-out flex-shrink-0
        ${collapsed ? 'w-14' : 'w-56'}
      `}
    >
      {/* Logo / Brand */}
      <div className={`flex items-center h-14 border-b border-default px-3 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-2'}`}>
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <BookOpen size={14} className="text-white" />
        </div>
        {!collapsed && (
          <span className="text-[13px] font-semibold text-content truncate">LMS Tập đoàn</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-none py-2 px-2">
        <ul className="space-y-0.5">
          {visibleItems.map((item, idx) => {
            const Icon = item.icon;
            const active = isActive(item);
            const prevItem = visibleItems[idx - 1];
            // Show section label when group changes (and both groups exist)
            const showLabel = showGroups && item.group && item.group !== prevItem?.group;

            return (
              <li key={item.href}>
                {showLabel && (
                  <div className={`${collapsed ? 'mx-1 my-1.5 border-t border-default' : 'px-2 pt-3 pb-1'}`}>
                    {!collapsed && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                        {GROUP_LABEL[item.group!]}
                      </span>
                    )}
                    {collapsed && <div />}
                  </div>
                )}
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`
                    flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium
                    transition-colors group
                    ${active
                      ? 'bg-primary text-white'
                      : 'text-subtle hover:bg-muted hover:text-content'
                    }
                    ${collapsed ? 'justify-center' : ''}
                  `}
                >
                  <Icon
                    size={15}
                    className={`flex-shrink-0 ${active ? 'text-white' : 'text-faint group-hover:text-primary'}`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom: profile + collapse toggle */}
      <div className="border-t border-default px-2 py-2 flex-shrink-0 space-y-0.5">
        {/* Notifications */}
        <Link
          href="/notifications"
          title={collapsed ? 'Thông báo' : undefined}
          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-subtle hover:bg-muted hover:text-content transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <Bell size={15} className="flex-shrink-0 text-faint" />
          {!collapsed && <span>Thông báo</span>}
        </Link>

        {/* Profile */}
        <Link
          href="/profile"
          title={collapsed ? (user?.fullName || user?.email || '') : undefined}
          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-subtle hover:bg-muted hover:text-content transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <User size={15} className="flex-shrink-0 text-faint" />
          {!collapsed && (
            <span className="truncate">{user?.fullName || user?.email || 'Tài khoản'}</span>
          )}
        </Link>

        {/* Logout */}
        <button
          onClick={() => logout()}
          title={collapsed ? 'Đăng xuất' : undefined}
          className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium text-subtle hover:bg-red-50 hover:text-red-600 transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={15} className="flex-shrink-0" />
          {!collapsed && <span>Đăng xuất</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11px] text-faint hover:bg-muted hover:text-subtle transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed ? <ChevronRight size={14} /> : (
            <>
              <ChevronLeft size={14} />
              <span>Thu gọn</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

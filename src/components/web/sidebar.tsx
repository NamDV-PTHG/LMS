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
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  // All roles
  { href: '/dashboard',              label: 'Dashboard',            icon: LayoutDashboard, roles: ['group_admin','group_hrm','company_admin','hr_manager','instructor','learner'], exact: true },
  // Group-level
  { href: '/organizations',          label: 'Tổ chức',              icon: Building2,       roles: ['group_admin','group_hrm'] },
  { href: '/users',                  label: 'Người dùng',           icon: Users,           roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/courses',                label: 'Khóa học',             icon: BookOpen,        roles: ['group_admin','group_hrm','company_admin','hr_manager','instructor'] },
  { href: '/learning-groups',        label: 'Nhóm học tập',         icon: Users,           roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/learning-paths',         label: 'Lộ trình học',         icon: Map,             roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/positions',              label: 'Vị trí công việc',     icon: Briefcase,       roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/competency-frameworks',  label: 'Khung năng lực',       icon: Target,          roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/position-changes',       label: 'Thay đổi vị trí',     icon: ArrowRightLeft,  roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/question-banks',         label: 'Ngân hàng câu hỏi',   icon: ClipboardList,   roles: ['instructor','company_admin','hr_manager'] },
  { href: '/reports',                label: 'Báo cáo',              icon: BarChart2,       roles: ['group_admin','group_hrm','company_admin','hr_manager'] },
  { href: '/ai-config',              label: 'Cấu hình AI',          icon: Cpu,             roles: ['group_admin'] },
  { href: '/settings',               label: 'Cài đặt',              icon: Settings,        roles: ['group_admin','company_admin'] },
  // Learner
  { href: '/my-courses',             label: 'Khóa học của tôi',     icon: BookOpen,        roles: ['learner'] },
  { href: '/my-learning-paths',      label: 'Lộ trình của tôi',     icon: Map,             roles: ['learner'] },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role;
  const userRoles = user?.roles?.map(getRole) ?? [];

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.some((r) => userRoles.includes(r))
  );

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
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
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <li key={item.href}>
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

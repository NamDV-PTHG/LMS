'use client';

import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  BarChart2, BookOpen, Map, Users, Target, ClipboardList,
  ArrowRight, TrendingUp,
} from 'lucide-react';

interface QuickStat {
  label: string;
  value: string | number;
}

interface CompanyComparison {
  companyId: string;
  companyName: string;
  totalEnrollments: number;
  completed: number;
  completionRate: number;
}

interface CourseEnrollStat {
  courseId: string;
  courseTitle: string;
  estimatedHours: number | null;
  enrolled: number;
  completed: number;
  completionRate: number;
  avgScorePct: number | null;
  avgTimeHours: number;
}

export default function DashboardPage() {
  const { user, accessToken } = useAuth();
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [activeLearnersThisMonth, setActiveLearnersThisMonth] = useState<number | null>(null);
  const [companyComparison, setCompanyComparison] = useState<CompanyComparison[]>([]);
  const [courseStats, setCourseStats] = useState<CourseEnrollStat[]>([]);
  const [hasLearningPaths, setHasLearningPaths] = useState(false);

  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role;

  const userRoles = user?.roles?.map(getRole) ?? [];
  const isGroupAdmin   = userRoles.includes('group_admin');
  const isCompanyAdmin = userRoles.includes('company_admin') || userRoles.includes('hr_manager');
  const isLearner      = userRoles.includes('learner');

  useEffect(() => {
    if (!user || !accessToken) return;
    const headers = { Authorization: `Bearer ${accessToken}` };

    if (isGroupAdmin) {
      fetch('/api/reports/group/overview', { headers })
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            const d = res.data;
            setStats([
              { label: 'Công ty',       value: d.totalCompanies ?? 0 },
              { label: 'Người dùng',    value: d.totalUsers ?? 0 },
              { label: 'Khóa học',      value: d.totalCourses ?? 0 },
              { label: 'Lượt đăng ký', value: d.totalEnrollments ?? 0 },
              { label: 'Hoàn thành TB', value: `${Math.round(d.avgCompletionRate ?? 0)}%` },
            ]);
            setActiveLearnersThisMonth(d.activeLearnersThisMonth ?? null);
          }
        })
        .catch(() => {});

      fetch('/api/reports/group/company-comparison', { headers })
        .then((r) => r.json())
        .then((res) => { if (res.success) setCompanyComparison(res.data ?? []); })
        .catch(() => {});
    } else if (isCompanyAdmin) {
      fetch(`/api/reports/company/${user.companyId}/overview`, { headers })
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            const d = res.data;
            setStats([
              { label: 'Người dùng',       value: d.totalUsers ?? 0 },
              { label: 'Khóa học',          value: d.totalCourses ?? 0 },
              { label: 'Lượt đăng ký',      value: d.totalEnrollments ?? 0 },
              { label: 'Tỉ lệ hoàn thành',  value: `${Math.round(d.completionRate ?? 0)}%` },
              { label: 'Tuân thủ bắt buộc', value: `${Math.round(d.mandatoryComplianceRate ?? 0)}%` },
            ]);
          }
        })
        .catch(() => {});

      fetch(`/api/reports/company/${user.companyId}/by-course`, { headers })
        .then((r) => r.json())
        .then((res) => { if (res.success) setCourseStats(res.data ?? []); })
        .catch(() => {});
    } else if (isLearner) {
      fetch('/api/my/courses', { headers })
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            const courses: { completedAt?: string }[] = res.data ?? [];
            const done = courses.filter((c) => c.completedAt).length;
            setStats([
              { label: 'Khóa học của tôi', value: courses.length },
              { label: 'Đã hoàn thành',    value: done },
              { label: 'Đang học',          value: courses.length - done },
            ]);
          }
        })
        .catch(() => {});

      fetch('/api/my/learning-paths', { headers })
        .then((r) => r.json())
        .then((res) => {
          if (res.success && (res.data ?? []).length > 0) setHasLearningPaths(true);
        })
        .catch(() => {});
    }
  }, [user, accessToken, isGroupAdmin, isCompanyAdmin, isLearner]);

  // Quick nav links per role
  const navLinks = [
    { href: '/reports',               label: 'Báo cáo tổng quan',  icon: BarChart2,    roles: ['group_admin', 'group_hrm'] },
    { href: '/reports/compliance',    label: 'Tuân thủ đào tạo',   icon: ClipboardList, roles: ['company_admin', 'hr_manager'] },
    { href: '/learning-groups',       label: 'Nhóm học tập',        icon: Users,        roles: ['group_admin', 'group_hrm'] },
    { href: '/courses/wizard',        label: 'Tạo khóa học AI',     icon: BookOpen,     roles: ['instructor', 'company_admin'] },
    { href: '/question-banks',        label: 'Ngân hàng câu hỏi',   icon: ClipboardList, roles: ['instructor', 'company_admin'] },
    { href: '/competency-frameworks', label: 'Khung năng lực',      icon: Target,       roles: ['group_admin', 'group_hrm', 'company_admin'] },
    { href: '/positions',             label: 'Vị trí công việc',    icon: Users,        roles: ['group_admin', 'group_hrm', 'company_admin'] },
    { href: '/learning-paths',        label: 'Lộ trình học',        icon: Map,          roles: ['group_admin', 'group_hrm', 'company_admin'] },
    { href: '/position-changes',      label: 'Thay đổi vị trí',    icon: ArrowRight,   roles: ['group_admin', 'group_hrm', 'company_admin'] },
    { href: '/my-learning-paths',     label: 'Lộ trình của tôi',   icon: Map,          roles: ['learner'] },
  ];

  const visibleLinks = navLinks.filter((l) => l.roles.some((r) => userRoles.includes(r)));
  const displayName = user?.fullName || user?.email || '';

  // Completion rate bar color
  const rateColor = (rate: number) =>
    rate >= 75 ? 'bg-success' : rate >= 40 ? 'bg-primary' : 'bg-danger';

  return (
    <div className="max-w-5xl mx-auto space-y-4">

      {/* Greeting */}
      <div className="bg-primary rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-white">Xin chào, {displayName} 👋</p>
          <p className="text-[11px] text-white/70 mt-0.5">Chào mừng bạn trở lại hệ thống LMS</p>
        </div>
        <TrendingUp size={20} className="text-white/50" />
      </div>

      {/* Stat cards */}
      {stats.length > 0 && (
        <div className={`grid gap-3 ${stats.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
          {stats.map((s) => (
            <div key={s.label} className="bg-surface rounded-xl border border-default shadow-card p-4">
              <p className="text-[20px] font-medium text-primary leading-none">{s.value}</p>
              <p className="text-[11px] text-subtle mt-1">{s.label}</p>
            </div>
          ))}
          {isGroupAdmin && activeLearnersThisMonth !== null && (
            <div className="bg-surface rounded-xl border border-default shadow-card p-4">
              <p className="text-[20px] font-medium text-success leading-none">{activeLearnersThisMonth}</p>
              <p className="text-[11px] text-subtle mt-1">Học viên tháng này</p>
            </div>
          )}
        </div>
      )}

      {/* group_admin: Company comparison */}
      {isGroupAdmin && companyComparison.length > 0 && (
        <div className="bg-surface rounded-xl border border-default shadow-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-default">
            <h2 className="text-[13px] font-medium text-content">So sánh các công ty</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Công ty</th>
                  <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Đăng ký</th>
                  <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Hoàn thành</th>
                  <th className="text-[10px] text-faint font-medium px-4 py-2.5 min-w-[160px]">Tỉ lệ</th>
                </tr>
              </thead>
              <tbody>
                {companyComparison.map((row) => (
                  <tr key={row.companyId} className="border-b border-default last:border-0 hover:bg-muted transition-colors">
                    <td className="px-4 py-3 text-[12px] font-medium text-content">{row.companyName}</td>
                    <td className="px-4 py-3 text-[11px] text-subtle text-right">{row.totalEnrollments.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[11px] text-subtle text-right">{row.completed.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${rateColor(row.completionRate)}`}
                            style={{ width: `${row.completionRate}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-content w-9 text-right">{row.completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* company_admin / hr_manager: Per-course table */}
      {isCompanyAdmin && courseStats.length > 0 && (
        <div className="bg-surface rounded-xl border border-default shadow-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-default">
            <h2 className="text-[13px] font-medium text-content">Thống kê theo khóa học</h2>
            <span className="text-[11px] text-faint">
              {courseStats.reduce((s, c) => s + c.enrolled, 0).toLocaleString()} lượt đăng ký
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Khóa học</th>
                  <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Đăng ký</th>
                  <th className="text-right text-[10px] text-faint font-medium px-4 py-2.5">Hoàn thành</th>
                  <th className="text-[10px] text-faint font-medium px-4 py-2.5 min-w-[140px]">Tỉ lệ</th>
                </tr>
              </thead>
              <tbody>
                {courseStats.map((row) => (
                  <tr key={row.courseId} className="border-b border-default last:border-0 hover:bg-muted transition-colors">
                    <td className="px-4 py-3 text-[12px] font-medium text-content max-w-[240px] truncate">
                      {row.courseTitle}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-subtle text-right">{row.enrolled.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[11px] text-subtle text-right">{row.completed.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${rateColor(row.completionRate)}`}
                            style={{ width: `${row.completionRate}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-content w-9 text-right">{row.completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Learner: learning path banner */}
      {isLearner && hasLearningPaths && (
        <div className="bg-primary-tint border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-[12px] font-medium text-primary">Bạn có lộ trình học đang chờ</span>
          <Link
            href="/my-learning-paths"
            className="flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary-dark transition-colors"
          >
            Xem lộ trình <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* Quick navigation */}
      {visibleLinks.length > 0 && (
        <div>
          <p className="text-[9px] font-medium text-faint uppercase tracking-widest mb-2.5">Truy cập nhanh</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {visibleLinks.map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-2.5 bg-surface rounded-xl border border-default shadow-card px-3 py-2.5 text-[12px] text-subtle hover:bg-muted hover:text-content hover:border-primary/30 transition-colors group"
                >
                  <Icon size={14} className="text-primary group-hover:text-primary flex-shrink-0" />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

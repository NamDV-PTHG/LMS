'use client';

import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import { useEffect, useState } from 'react';

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

  // roles có thể là string[] (sau login) hoặc {role:string}[] (sau fetchMe)
  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role;

  const userRoles = user?.roles?.map(getRole) ?? [];
  const isGroupAdmin = userRoles.includes('group_admin');
  const isCompanyAdmin =
    userRoles.includes('company_admin') || userRoles.includes('hr_manager');
  const isLearner = userRoles.includes('learner');

  useEffect(() => {
    if (!user || !accessToken) return;
    const headers = { Authorization: `Bearer ${accessToken}` };

    if (isGroupAdmin) {
      // Top stats
      fetch('/api/reports/group/overview', { headers })
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            const d = res.data;
            setStats([
              { label: 'Công ty', value: d.totalCompanies ?? 0 },
              { label: 'Người dùng', value: d.totalUsers ?? 0 },
              { label: 'Khóa học', value: d.totalCourses ?? 0 },
              { label: 'Lượt đăng ký', value: d.totalEnrollments ?? 0 },
              { label: 'Hoàn thành TB', value: `${Math.round(d.avgCompletionRate ?? 0)}%` },
            ]);
            setActiveLearnersThisMonth(d.activeLearnersThisMonth ?? null);
          }
        })
        .catch(() => {});

      // Company comparison table
      fetch('/api/reports/group/company-comparison', { headers })
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setCompanyComparison(res.data ?? []);
        })
        .catch(() => {});
    } else if (isCompanyAdmin) {
      // Top stats
      fetch(`/api/reports/company/${user.companyId}/overview`, { headers })
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            const d = res.data;
            setStats([
              { label: 'Người dùng', value: d.totalUsers ?? 0 },
              { label: 'Khóa học', value: d.totalCourses ?? 0 },
              { label: 'Lượt đăng ký', value: d.totalEnrollments ?? 0 },
              { label: 'Tỉ lệ hoàn thành', value: `${Math.round(d.completionRate ?? 0)}%` },
              { label: 'Tuân thủ bắt buộc', value: `${Math.round(d.mandatoryComplianceRate ?? 0)}%` },
            ]);
          }
        })
        .catch(() => {});

      // Per-course table
      fetch(`/api/reports/company/${user.companyId}/by-course`, { headers })
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setCourseStats(res.data ?? []);
        })
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
              { label: 'Đã hoàn thành', value: done },
              { label: 'Đang học', value: courses.length - done },
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

  // Enrollment trend: count enrollments with enrolledAt in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentEnrollments = courseStats.reduce((sum, c) => {
    // We don't have per-enrollment dates in by-course; show total enrolled as proxy
    return sum + c.enrolled;
  }, 0);

  const navLinks = [
    { href: '/reports', label: 'Báo cáo tổng quan', roles: ['group_admin', 'group_hrm'] },
    { href: '/reports/compliance', label: 'Tuân thủ đào tạo', roles: ['company_admin', 'hr_manager'] },
    { href: '/learning-groups', label: 'Nhóm học tập', roles: ['group_admin', 'group_hrm'] },
    { href: '/courses/wizard', label: 'Tạo khóa học AI', roles: ['instructor', 'company_admin'] },
    { href: '/question-banks', label: 'Ngân hàng câu hỏi', roles: ['instructor', 'company_admin'] },
    { href: '/competency-frameworks', label: 'Khung năng lực', roles: ['group_admin', 'group_hrm', 'company_admin'] },
    { href: '/positions', label: 'Vị trí công việc', roles: ['group_admin', 'group_hrm', 'company_admin'] },
    { href: '/learning-paths', label: 'Lộ trình học', roles: ['group_admin', 'group_hrm', 'company_admin'] },
    { href: '/position-changes', label: 'Thay đổi vị trí', roles: ['group_admin', 'group_hrm', 'company_admin'] },
    { href: '/my-learning-paths', label: 'Lộ trình của tôi', roles: ['learner'] },
    { href: '/ai-config', label: 'Cấu hình AI', roles: ['group_admin'] },
  ];

  const visibleLinks = navLinks.filter((l) =>
    l.roles.some((r) => userRoles.includes(r)),
  );

  const displayName = user?.fullName || user?.email || '';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Xin chào, {displayName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {userRoles.join(', ')}
          {user?.companyId ? ` · ${user.companyId}` : ''}
        </p>
      </div>

      {/* Quick stats */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border p-4 space-y-1">
              <div className="text-2xl font-bold text-blue-600">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
          {isGroupAdmin && activeLearnersThisMonth !== null && (
            <div className="bg-white rounded-xl border p-4 space-y-1">
              <div className="text-2xl font-bold text-emerald-600">{activeLearnersThisMonth}</div>
              <div className="text-xs text-gray-500">Học viên tháng này</div>
            </div>
          )}
        </div>
      )}

      {/* group_admin: Company comparison table */}
      {isGroupAdmin && companyComparison.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">So sánh các công ty</h2>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Công ty</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Lượt đăng ký</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Hoàn thành</th>
                  <th className="px-4 py-3 font-medium text-gray-600 min-w-[180px]">Tỉ lệ hoàn thành</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companyComparison.map((row) => (
                  <tr key={row.companyId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.companyName}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.totalEnrollments.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.completed.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${row.completionRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-9 text-right">
                          {row.completionRate}%
                        </span>
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
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Thống kê theo khóa học</h2>
            <span className="text-xs text-gray-400">
              Tổng {courseStats.reduce((s, c) => s + c.enrolled, 0).toLocaleString()} lượt đăng ký
            </span>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Khóa học</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Đăng ký</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Hoàn thành</th>
                  <th className="px-4 py-3 font-medium text-gray-600 min-w-[160px]">Hoàn thành %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {courseStats.map((row) => (
                  <tr key={row.courseId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[260px] truncate">
                      {row.courseTitle}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.enrolled.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.completed.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              row.completionRate >= 75
                                ? 'bg-emerald-500'
                                : row.completionRate >= 40
                                ? 'bg-yellow-500'
                                : 'bg-red-400'
                            }`}
                            style={{ width: `${row.completionRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-9 text-right">
                          {row.completionRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* learner: Learning path link */}
      {isLearner && hasLearningPaths && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-blue-800 font-medium">Bạn có lộ trình học đang chờ</span>
          <Link
            href="/my-learning-paths"
            className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Xem lộ trình →
          </Link>
        </div>
      )}

      {/* Quick navigation */}
      {visibleLinks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Truy cập nhanh</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visibleLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { KpiCards } from '@/components/reports/kpi-cards';
import { CompletionChart } from '@/components/reports/completion-chart';
import { ExportButton } from '@/components/reports/export-button';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────

interface GroupOverview {
  totalCompanies: number;
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  avgCompletionRate: number;
  activeLearnersThisMonth: number;
}

interface CompanyOverview {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  completionRate: number;
  mandatoryComplianceRate: number;
}

interface CompanyComparison {
  companyId: string;
  companyName: string;
  completionRate: number;
  totalEnrollments: number;
  completed: number;
}

interface DeptReport {
  deptId: string;
  deptName: string;
  userCount: number;
  totalEnrollments: number;
  completed: number;
  completionRate: number;
}

interface RatingReport {
  summary: {
    totalRatings: number;
    avgRating: number | null;
    ratedCoursesCount: number;
    totalCoursesCount: number;
  } | null;
  topRated: { courseId: string; courseTitle: string; avgRating: number; ratingCount: number; companyName?: string }[];
  bottomRated: { courseId: string; courseTitle: string; avgRating: number; ratingCount: number }[];
}

// Hiển thị sao đánh giá
function StarRating({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= Math.round(value) ? 'text-yellow-400' : 'text-gray-200'}>★</span>
      ))}
      <span className="ml-1 text-sm font-medium text-gray-700">{value.toFixed(1)}</span>
    </span>
  );
}

export default function ReportsPage() {
  const { user, accessToken } = useAuth();
  const isGroupAdmin = user?.roles?.some(r => r.role === 'group_admin');
  const isGroupHrm = user?.roles?.some(r => r.role === 'group_hrm');
  const isCompanyAdmin = user?.roles?.some(r => r.role === 'company_admin') || user?.roles?.some(r => r.role === 'hr_manager');

  const [groupOverview, setGroupOverview] = useState<GroupOverview | null>(null);
  const [companyOverview, setCompanyOverview] = useState<CompanyOverview | null>(null);
  const [companyComparison, setCompanyComparison] = useState<CompanyComparison[]>([]);
  const [deptBreakdown, setDeptBreakdown] = useState<DeptReport[]>([]);
  const [groupRatings, setGroupRatings] = useState<RatingReport | null>(null);
  const [companyRatings, setCompanyRatings] = useState<RatingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const headers = { Authorization: `Bearer ${accessToken}` };

      if (isGroupAdmin) {
        const [overviewRes, comparisonRes, ratingsRes] = await Promise.all([
          fetch('/api/reports/group/overview', { headers }),
          fetch('/api/reports/group/company-comparison', { headers }),
          fetch('/api/reports/group/ratings', { headers }),
        ]);
        const [ov, cmp, rat] = await Promise.all([overviewRes.json(), comparisonRes.json(), ratingsRes.json()]);
        if (ov.success) setGroupOverview(ov.data);
        if (cmp.success) setCompanyComparison(cmp.data);
        if (rat.success) setGroupRatings(rat.data);
      }

      if (isCompanyAdmin && user?.companyId) {
        const [overviewRes, deptRes, ratingsRes] = await Promise.all([
          fetch(`/api/reports/company/${user.companyId}/overview`, { headers }),
          fetch(`/api/reports/company/${user.companyId}/by-department`, { headers }),
          fetch(`/api/reports/company/${user.companyId}/ratings`, { headers }),
        ]);
        const [ov, dept, rat] = await Promise.all([overviewRes.json(), deptRes.json(), ratingsRes.json()]);
        if (ov.success) setCompanyOverview(ov.data);
        if (dept.success) setDeptBreakdown(dept.data);
        if (rat.success) setCompanyRatings(rat.data);
      }

      setIsLoading(false);
    };
    load();
  }, [isGroupAdmin, isCompanyAdmin, user?.companyId, accessToken]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Đang tải...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Báo cáo & Phân tích</h1>
          <p className="text-sm text-muted-foreground mt-1">Tổng quan tiến độ học tập</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/reports/compliance"
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            Báo cáo Compliance →
          </Link>
          {isCompanyAdmin && user?.companyId && (
            <ExportButton companyId={user.companyId} accessToken={accessToken!} />
          )}
        </div>
      </div>

      {/* Group Admin section */}
      {isGroupAdmin && groupOverview && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-700">Toàn tập đoàn</h2>
          <KpiCards cards={[
            { label: 'Số công ty', value: groupOverview.totalCompanies, color: 'blue' },
            { label: 'Tổng người dùng', value: groupOverview.totalUsers.toLocaleString() },
            { label: 'Khóa học', value: groupOverview.totalCourses },
            { label: 'Lượt đăng ký', value: groupOverview.totalEnrollments.toLocaleString() },
            { label: 'Tỷ lệ hoàn thành', value: `${groupOverview.avgCompletionRate}%`, color: groupOverview.avgCompletionRate >= 70 ? 'green' : 'orange' },
            { label: 'Học viên hoạt động (30 ngày)', value: groupOverview.activeLearnersThisMonth.toLocaleString(), color: 'blue' },
          ]} />

          {companyComparison.length > 0 && (
            <CompletionChart
              title="So sánh tỷ lệ hoàn thành giữa các công ty"
              data={companyComparison.map((c) => ({ label: c.companyName, rate: c.completionRate, total: c.totalEnrollments }))}
            />
          )}

          {/* Rating report - group level */}
          {groupRatings && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Đánh giá chất lượng khóa học</h3>
              {groupRatings.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500">Tổng đánh giá</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{groupRatings.summary.totalRatings.toLocaleString()}</p>
                  </div>
                  <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500">Điểm TB toàn hệ thống</p>
                    <div className="mt-1">
                      {groupRatings.summary.avgRating !== null
                        ? <StarRating value={groupRatings.summary.avgRating} />
                        : <span className="text-gray-400 text-sm">Chưa có</span>}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500">Khóa học có đánh giá</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {groupRatings.summary.ratedCoursesCount}
                      <span className="text-sm font-normal text-gray-400"> / {groupRatings.summary.totalCoursesCount}</span>
                    </p>
                  </div>
                </div>
              )}
              {groupRatings.topRated.length > 0 && (
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <p className="text-sm font-medium text-gray-700">Top khóa học được đánh giá cao nhất</p>
                  </div>
                  <div className="divide-y">
                    {groupRatings.topRated.map((r, i) => (
                      <div key={r.courseId} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-800 line-clamp-1">{r.courseTitle}</p>
                            {r.companyName && <p className="text-xs text-gray-400">{r.companyName}</p>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <StarRating value={r.avgRating} />
                          <p className="text-xs text-gray-400 mt-0.5">{r.ratingCount} đánh giá</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Company Admin section */}
      {isCompanyAdmin && companyOverview && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-700">Tổng quan công ty</h2>
          <KpiCards cards={[
            { label: 'Nhân viên', value: companyOverview.totalUsers.toLocaleString() },
            { label: 'Khóa học', value: companyOverview.totalCourses },
            { label: 'Lượt đăng ký', value: companyOverview.totalEnrollments.toLocaleString() },
            { label: 'Tỷ lệ hoàn thành', value: `${companyOverview.completionRate}%`, color: companyOverview.completionRate >= 70 ? 'green' : 'orange' },
            { label: 'Compliance bắt buộc', value: `${companyOverview.mandatoryComplianceRate}%`, color: companyOverview.mandatoryComplianceRate >= 80 ? 'green' : 'red' },
          ]} />

          {deptBreakdown.length > 0 && (
            <CompletionChart
              title="Tỷ lệ hoàn thành theo phòng ban"
              data={deptBreakdown.map((d) => ({ label: d.deptName, rate: d.completionRate, total: d.totalEnrollments }))}
            />
          )}

          {/* Rating report - company level */}
          {companyRatings && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Đánh giá chất lượng khóa học</h3>
              {companyRatings.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500">Tổng đánh giá</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{companyRatings.summary.totalRatings.toLocaleString()}</p>
                  </div>
                  <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500">Điểm trung bình</p>
                    <div className="mt-1">
                      {companyRatings.summary.avgRating !== null
                        ? <StarRating value={companyRatings.summary.avgRating} />
                        : <span className="text-gray-400 text-sm">Chưa có đánh giá</span>}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500">Khóa học có đánh giá</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {companyRatings.summary.ratedCoursesCount}
                      <span className="text-sm font-normal text-gray-400"> / {companyRatings.summary.totalCoursesCount}</span>
                    </p>
                  </div>
                </div>
              )}
              {(companyRatings.topRated.length > 0 || companyRatings.bottomRated.length > 0) && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {companyRatings.topRated.length > 0 && (
                    <div className="bg-white rounded-xl border overflow-hidden">
                      <div className="px-4 py-3 border-b bg-green-50">
                        <p className="text-sm font-medium text-green-800">Khóa học được đánh giá cao</p>
                      </div>
                      <div className="divide-y">
                        {companyRatings.topRated.map((r, i) => (
                          <div key={r.courseId} className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-bold text-gray-400 shrink-0">{i + 1}.</span>
                              <p className="text-sm text-gray-800 truncate">{r.courseTitle}</p>
                            </div>
                            <div className="shrink-0 ml-2">
                              <StarRating value={r.avgRating} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {companyRatings.bottomRated.length > 0 && (
                    <div className="bg-white rounded-xl border overflow-hidden">
                      <div className="px-4 py-3 border-b bg-red-50">
                        <p className="text-sm font-medium text-red-800">Khóa học cần cải thiện</p>
                      </div>
                      <div className="divide-y">
                        {companyRatings.bottomRated.map((r, i) => (
                          <div key={r.courseId} className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-bold text-gray-400 shrink-0">{i + 1}.</span>
                              <p className="text-sm text-gray-800 truncate">{r.courseTitle}</p>
                            </div>
                            <div className="shrink-0 ml-2">
                              <StarRating value={r.avgRating} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Group HRM — only sees comparison */}
      {isGroupHrm && !isGroupAdmin && companyComparison.length === 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-4">So sánh công ty</h2>
          <p className="text-sm text-muted-foreground">Không có dữ liệu</p>
        </section>
      )}
    </div>
  );
}

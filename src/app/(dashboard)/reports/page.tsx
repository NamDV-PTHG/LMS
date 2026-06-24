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

export default function ReportsPage() {
  const { user, accessToken } = useAuth();
  const isGroupAdmin = user?.roles?.some(r => r.role === 'group_admin');
  const isGroupHrm = user?.roles?.some(r => r.role === 'group_hrm');
  const isCompanyAdmin = user?.roles?.some(r => r.role === 'company_admin') || user?.roles?.some(r => r.role === 'hr_manager');

  const [groupOverview, setGroupOverview] = useState<GroupOverview | null>(null);
  const [companyOverview, setCompanyOverview] = useState<CompanyOverview | null>(null);
  const [companyComparison, setCompanyComparison] = useState<CompanyComparison[]>([]);
  const [deptBreakdown, setDeptBreakdown] = useState<DeptReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const headers = { Authorization: `Bearer ${accessToken}` };

      if (isGroupAdmin) {
        const [overviewRes, comparisonRes] = await Promise.all([
          fetch('/api/reports/group/overview', { headers }),
          fetch('/api/reports/group/company-comparison', { headers }),
        ]);
        const [ov, cmp] = await Promise.all([overviewRes.json(), comparisonRes.json()]);
        if (ov.success) setGroupOverview(ov.data);
        if (cmp.success) setCompanyComparison(cmp.data);
      }

      if (isCompanyAdmin && user?.companyId) {
        const [overviewRes, deptRes] = await Promise.all([
          fetch(`/api/reports/company/${user.companyId}/overview`, { headers }),
          fetch(`/api/reports/company/${user.companyId}/by-department`, { headers }),
        ]);
        const [ov, dept] = await Promise.all([overviewRes.json(), deptRes.json()]);
        if (ov.success) setCompanyOverview(ov.data);
        if (dept.success) setDeptBreakdown(dept.data);
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

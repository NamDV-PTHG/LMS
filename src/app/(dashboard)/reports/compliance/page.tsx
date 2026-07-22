'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { ComplianceTable } from '@/components/reports/compliance-table';
import { ExportButton } from '@/components/reports/export-button';
import { ShieldCheck } from 'lucide-react';

interface ComplianceData {
  rows: {
    userId: string;
    userName: string;
    userEmail: string;
    employeeCode: string | null;
    department: { id: string; name: string } | null;
    courseId: string;
    courseTitle: string;
    enrolledAt: string;
    completedAt: string | null;
    deadline: string | null;
    status: string;
  }[];
  summary: { deptId: string; deptName: string; total: number; completed: number; rate: number }[];
  totals: { total: number; completed: number; overdue: number };
}

export default function CompliancePage() {
  const { user, accessToken } = useAuth();
  const [data, setData] = useState<ComplianceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [overdueOnly, setOverdueOnly] = useState(false);

  const fetchData = async (overdue: boolean) => {
    if (!user?.companyId) return;
    setIsLoading(true);
    const res = await fetch(
      `/api/company/${user.companyId}/compliance?overdueOnly=${overdue}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const json = await res.json();
    if (json.success) setData(json.data);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(overdueOnly); }, [overdueOnly, user?.companyId]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-semibold text-content">Báo cáo Tuân thủ</h1>
          <p className="text-[12px] text-subtle mt-0.5">Khóa học bắt buộc &amp; tiến độ tuân thủ</p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-[12px] text-content cursor-pointer select-none">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="rounded border-default"
            />
            Chỉ trễ hạn
          </label>
          {user?.companyId && (
            <ExportButton companyId={user.companyId} accessToken={accessToken!} />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-surface rounded-xl border border-default shadow-card py-16 text-center text-[12px] text-faint">
          Đang tải...
        </div>
      ) : !data ? (
        <div className="bg-surface rounded-xl border border-default shadow-card py-16 text-center text-[12px] text-faint">
          <ShieldCheck size={32} className="mx-auto mb-2 text-faint/40" />
          Không có dữ liệu
        </div>
      ) : (
        <ComplianceTable rows={data.rows} summary={data.summary} totals={data.totals} />
      )}
    </div>
  );
}

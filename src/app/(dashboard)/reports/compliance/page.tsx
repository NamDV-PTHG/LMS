'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { ComplianceTable } from '@/components/reports/compliance-table';
import { ExportButton } from '@/components/reports/export-button';

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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Báo cáo Compliance</h1>
          <p className="text-sm text-muted-foreground mt-1">Khóa học bắt buộc & tiến độ tuân thủ</p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="rounded"
            />
            Chỉ trễ hạn
          </label>
          {user?.companyId && (
            <ExportButton companyId={user.companyId} accessToken={accessToken!} />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Đang tải...</div>
      ) : !data ? (
        <div className="py-16 text-center text-muted-foreground">Không có dữ liệu</div>
      ) : (
        <ComplianceTable rows={data.rows} summary={data.summary} totals={data.totals} />
      )}
    </div>
  );
}

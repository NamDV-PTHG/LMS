'use client';

import React from 'react';
import { UserProgressTable } from './user-progress-table';

type ComplianceRow = {
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
};

interface ComplianceTableProps {
  rows: ComplianceRow[];
  summary: { deptId: string; deptName: string; total: number; completed: number; rate: number }[];
  totals: { total: number; completed: number; overdue: number };
}

export function ComplianceTable({ rows, summary, totals }: ComplianceTableProps) {
  return (
    <div className="space-y-6">
      {/* Totals */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totals.total}</p>
          <p className="text-xs text-muted-foreground mt-1">Tổng lượt bắt buộc</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-green-50 border-green-200">
          <p className="text-2xl font-bold text-green-700">{totals.completed}</p>
          <p className="text-xs text-muted-foreground mt-1">Đã hoàn thành</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-red-50 border-red-200">
          <p className="text-2xl font-bold text-red-700">{totals.overdue}</p>
          <p className="text-xs text-muted-foreground mt-1">Trễ hạn</p>
        </div>
      </div>

      {/* Department summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Theo phòng ban</h3>
        <div className="space-y-2">
          {summary.map((s) => (
            <div key={s.deptId} className="flex items-center gap-3">
              <span className="text-sm w-40 truncate">{s.deptName}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${s.rate >= 80 ? 'bg-green-500' : s.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${s.rate}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-16 text-right">{s.completed}/{s.total} ({s.rate}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Chi tiết</h3>
        <UserProgressTable
          rows={rows.map((r) => ({
            userName: r.userName,
            userEmail: r.userEmail,
            courseTitle: r.courseTitle,
            completedAt: r.completedAt,
            deadline: r.deadline,
            status: r.status,
          }))}
          columns={['user', 'course', 'completed', 'deadline', 'status']}
        />
      </div>
    </div>
  );
}

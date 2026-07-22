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
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-default rounded-xl shadow-card p-4 text-center">
          <p className="text-[22px] font-bold text-content">{totals.total}</p>
          <p className="text-[11px] text-subtle mt-1">Tổng lượt bắt buộc</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl shadow-card p-4 text-center">
          <p className="text-[22px] font-bold text-green-700">{totals.completed}</p>
          <p className="text-[11px] text-green-600 mt-1">Đã hoàn thành</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl shadow-card p-4 text-center">
          <p className="text-[22px] font-bold text-red-600">{totals.overdue}</p>
          <p className="text-[11px] text-red-500 mt-1">Trễ hạn</p>
        </div>
      </div>

      {/* Department summary */}
      <div className="bg-surface rounded-xl border border-default shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-default">
          <h3 className="text-[13px] font-medium text-content">Theo phòng ban</h3>
        </div>
        <div className="p-4 space-y-3">
          {summary.length === 0 ? (
            <p className="text-[12px] text-faint text-center py-4">Không có dữ liệu</p>
          ) : summary.map((s) => (
            <div key={s.deptId} className="flex items-center gap-3">
              <span className="text-[12px] text-content w-40 truncate shrink-0">{s.deptName}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    s.rate >= 80 ? 'bg-green-500' : s.rate >= 50 ? 'bg-amber-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${s.rate}%` }}
                />
              </div>
              <span className="text-[11px] text-subtle w-20 text-right shrink-0">
                {s.completed}/{s.total} ({s.rate}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail table */}
      <div className="bg-surface rounded-xl border border-default shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-default">
          <h3 className="text-[13px] font-medium text-content">Chi tiết</h3>
        </div>
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

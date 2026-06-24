import React from 'react';

interface Row {
  userId?: string;
  userName: string;
  userEmail?: string;
  courseTitle?: string;
  progressPct?: number;
  completedAt?: string | null;
  deadline?: string | null;
  status?: string;
  timeSpentHours?: number;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  completed:            { label: 'Hoàn thành',   className: 'bg-green-100 text-green-700' },
  in_progress:          { label: 'Đang học',      className: 'bg-blue-100 text-blue-700' },
  overdue:              { label: 'Trễ hạn',       className: 'bg-red-100 text-red-700' },
  not_started:          { label: 'Chưa bắt đầu', className: 'bg-gray-100 text-gray-600' },
  overdue_not_started:  { label: 'Chưa học - trễ', className: 'bg-red-100 text-red-800' },
};

interface UserProgressTableProps {
  rows: Row[];
  columns?: ('user' | 'course' | 'progress' | 'completed' | 'deadline' | 'status' | 'time')[];
}

export function UserProgressTable({
  rows,
  columns = ['user', 'course', 'progress', 'completed', 'deadline', 'status'],
}: UserProgressTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Không có dữ liệu</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {columns.includes('user')      && <th className="pb-2 pr-4 font-medium">Học viên</th>}
            {columns.includes('course')    && <th className="pb-2 pr-4 font-medium">Khóa học</th>}
            {columns.includes('progress')  && <th className="pb-2 pr-4 font-medium text-right">Tiến độ</th>}
            {columns.includes('time')      && <th className="pb-2 pr-4 font-medium text-right">Thời gian</th>}
            {columns.includes('completed') && <th className="pb-2 pr-4 font-medium">Hoàn thành</th>}
            {columns.includes('deadline')  && <th className="pb-2 pr-4 font-medium">Hạn chót</th>}
            {columns.includes('status')    && <th className="pb-2 font-medium">Trạng thái</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.includes('user') && (
                <td className="py-2 pr-4">
                  <p className="font-medium text-gray-900">{r.userName}</p>
                  {r.userEmail && <p className="text-xs text-muted-foreground">{r.userEmail}</p>}
                </td>
              )}
              {columns.includes('course') && (
                <td className="py-2 pr-4 max-w-[200px]">
                  <p className="truncate">{r.courseTitle ?? '—'}</p>
                </td>
              )}
              {columns.includes('progress') && (
                <td className="py-2 pr-4 text-right">
                  {r.progressPct !== undefined ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${r.progressPct}%` }}
                        />
                      </div>
                      <span className="text-xs w-8">{r.progressPct}%</span>
                    </div>
                  ) : '—'}
                </td>
              )}
              {columns.includes('time') && (
                <td className="py-2 pr-4 text-right text-xs">
                  {r.timeSpentHours !== undefined ? `${r.timeSpentHours}h` : '—'}
                </td>
              )}
              {columns.includes('completed') && (
                <td className="py-2 pr-4 text-xs">
                  {r.completedAt ? new Date(r.completedAt).toLocaleDateString('vi-VN') : '—'}
                </td>
              )}
              {columns.includes('deadline') && (
                <td className="py-2 pr-4 text-xs">
                  {r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '—'}
                </td>
              )}
              {columns.includes('status') && (
                <td className="py-2">
                  {r.status ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_LABELS[r.status]?.className ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[r.status]?.label ?? r.status}
                    </span>
                  ) : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  completed:            { label: 'Hoàn thành',     className: 'bg-green-100 text-green-700' },
  in_progress:          { label: 'Đang học',        className: 'bg-blue-100 text-blue-700' },
  overdue:              { label: 'Trễ hạn',         className: 'bg-red-100 text-red-700' },
  not_started:          { label: 'Chưa bắt đầu',   className: 'bg-gray-100 text-gray-600' },
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
    return (
      <p className="text-[12px] text-faint py-8 text-center">Không có dữ liệu</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-muted border-b border-default text-left">
            {columns.includes('user')      && <th className="px-4 py-2.5 text-subtle font-medium">Học viên</th>}
            {columns.includes('course')    && <th className="px-4 py-2.5 text-subtle font-medium">Khóa học</th>}
            {columns.includes('progress')  && <th className="px-4 py-2.5 text-subtle font-medium text-right">Tiến độ</th>}
            {columns.includes('time')      && <th className="px-4 py-2.5 text-subtle font-medium text-right">Thời gian</th>}
            {columns.includes('completed') && <th className="px-4 py-2.5 text-subtle font-medium">Hoàn thành</th>}
            {columns.includes('deadline')  && <th className="px-4 py-2.5 text-subtle font-medium">Hạn chót</th>}
            {columns.includes('status')    && <th className="px-4 py-2.5 text-subtle font-medium">Trạng thái</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-default">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/40 transition-colors">
              {columns.includes('user') && (
                <td className="px-4 py-2.5">
                  <p className="font-medium text-content">{r.userName}</p>
                  {r.userEmail && <p className="text-[11px] text-subtle mt-0.5">{r.userEmail}</p>}
                </td>
              )}
              {columns.includes('course') && (
                <td className="px-4 py-2.5 max-w-[200px]">
                  <p className="truncate text-content">{r.courseTitle ?? '—'}</p>
                </td>
              )}
              {columns.includes('progress') && (
                <td className="px-4 py-2.5 text-right">
                  {r.progressPct !== undefined ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full"
                          style={{ width: `${r.progressPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-subtle w-8">{Math.round(r.progressPct)}%</span>
                    </div>
                  ) : <span className="text-faint">—</span>}
                </td>
              )}
              {columns.includes('time') && (
                <td className="px-4 py-2.5 text-right text-subtle">
                  {r.timeSpentHours !== undefined ? `${r.timeSpentHours}h` : '—'}
                </td>
              )}
              {columns.includes('completed') && (
                <td className="px-4 py-2.5 text-subtle">
                  {r.completedAt ? new Date(r.completedAt).toLocaleDateString('vi-VN') : <span className="text-faint">—</span>}
                </td>
              )}
              {columns.includes('deadline') && (
                <td className="px-4 py-2.5 text-subtle">
                  {r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : <span className="text-faint">—</span>}
                </td>
              )}
              {columns.includes('status') && (
                <td className="px-4 py-2.5">
                  {r.status ? (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_LABELS[r.status]?.className ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[r.status]?.label ?? r.status}
                    </span>
                  ) : <span className="text-faint">—</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

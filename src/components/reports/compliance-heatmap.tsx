'use client';

import React from 'react';

interface HeatmapCell {
  status: string;
}

interface HeatmapRow {
  deptName: string;
  courses: Record<string, HeatmapCell>;
}

interface ComplianceHeatmapProps {
  courseIds: string[];
  courseTitles: string[];
  rows: HeatmapRow[];
}

const STATUS_COLOR: Record<string, string> = {
  completed:            'bg-green-500',
  in_progress:          'bg-blue-400',
  overdue:              'bg-red-500',
  not_started:          'bg-gray-200',
  overdue_not_started:  'bg-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  completed:            'Hoàn thành',
  in_progress:          'Đang học',
  overdue:              'Trễ hạn',
  not_started:          'Chưa bắt đầu',
  overdue_not_started:  'Chưa học - trễ',
};

export function ComplianceHeatmap({ courseIds, courseTitles, rows }: ComplianceHeatmapProps) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left pr-4 pb-2 font-medium text-muted-foreground min-w-[120px]">Phòng ban</th>
            {courseTitles.map((title, i) => (
              <th key={i} className="pb-2 px-1 font-medium text-muted-foreground max-w-[80px]">
                <span className="block truncate" title={title}>{title}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="pr-4 py-1 font-medium text-gray-700 truncate max-w-[120px]">{row.deptName}</td>
              {courseIds.map((cId, j) => {
                const cell = row.courses[cId];
                const status = cell?.status ?? 'not_started';
                return (
                  <td key={j} className="px-1 py-1">
                    <div
                      className={`w-7 h-7 rounded ${STATUS_COLOR[status] ?? 'bg-gray-100'}`}
                      title={`${row.deptName} · ${courseTitles[j]}: ${STATUS_LABEL[status] ?? status}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex gap-4 mt-3 flex-wrap">
        {Object.entries(STATUS_LABEL).map(([s, label]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${STATUS_COLOR[s]}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

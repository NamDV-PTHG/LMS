'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import useSWR from 'swr';

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

interface StepEnrollment {
  id: string;
  isUnlocked: boolean;
  status: string;
  completedAt?: string;
  deadline?: string;
  step: {
    id: string;
    stepOrder: number;
    stepType: string;
    course: { id: string; title: string; estimatedHours?: number; thumbnailUrl?: string };
    prerequisiteStep?: { stepOrder: number };
  };
  courseEnrollment?: { id: string; progressPct: number; completedAt?: string };
}

interface PathEnrollment {
  id: string;
  status: string;
  progressPct: number;
  startedAt: string;
  totalDeadline?: string;
  completedAt?: string;
  learningPath: { id: string; name: string; description?: string };
  stepEnrollments: StepEnrollment[];
}

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'Đang học',
  COMPLETED: 'Hoàn thành',
  OVERDUE: 'Trễ hạn',
  PAUSED: 'Tạm dừng',
};

export default function MyLearningPathsPage() {
  const { accessToken } = useAuth();
  const { data } = useSWR(
    accessToken ? ['/api/my/learning-paths', accessToken] : null,
    ([url, token]) => fetcher(url, token),
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const enrollments: PathEnrollment[] = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lộ trình học tập của tôi</h1>
        <p className="text-sm text-muted-foreground mt-1">Các lộ trình học bạn đang tham gia</p>
      </div>

      {enrollments.length === 0 && !data && (
        <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
      )}
      {enrollments.length === 0 && data && (
        <div className="text-center py-12 text-muted-foreground">Bạn chưa có lộ trình học tập nào.</div>
      )}

      <div className="space-y-4">
        {enrollments.map((pe) => (
          <div key={pe.id} className="border rounded-xl overflow-hidden">
            {/* Path header */}
            <div
              className="p-5 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedId(expandedId === pe.id ? null : pe.id)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{pe.learningPath.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${pe.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : pe.status === 'OVERDUE' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'}`}>
                      {STATUS_LABELS[pe.status]}
                    </span>
                  </div>
                  {pe.learningPath.description && (
                    <p className="text-sm text-muted-foreground mt-1">{pe.learningPath.description}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Bắt đầu: {new Date(pe.startedAt).toLocaleDateString('vi-VN')}</span>
                    {pe.totalDeadline && (
                      <span>Hạn: {new Date(pe.totalDeadline).toLocaleDateString('vi-VN')}</span>
                    )}
                    {pe.completedAt && (
                      <span>Hoàn thành: {new Date(pe.completedAt).toLocaleDateString('vi-VN')}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold text-blue-600">{Math.round(pe.progressPct)}%</div>
                  <div className="text-xs text-muted-foreground">Tiến độ</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pe.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${pe.progressPct}%` }}
                />
              </div>
            </div>

            {/* Steps expanded */}
            {expandedId === pe.id && (
              <div className="border-t divide-y">
                {pe.stepEnrollments.map((se, idx) => {
                  const locked = !se.isUnlocked;
                  const done = !!se.completedAt;
                  return (
                    <div key={se.id} className={`p-4 flex items-start gap-4 ${locked ? 'opacity-60' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done ? 'bg-green-100 text-green-700' : locked ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-700'}`}>
                        {done ? '✓' : locked ? '🔒' : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{se.step.course.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${se.step.stepType === 'REQUIRED' ? 'bg-blue-100 text-blue-700' : se.step.stepType === 'ELECTIVE' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                            {se.step.stepType === 'REQUIRED' ? 'Bắt buộc' : se.step.stepType === 'ELECTIVE' ? 'Tự chọn' : 'Nâng cao'}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          {se.step.course.estimatedHours && <span>{se.step.course.estimatedHours}h</span>}
                          {se.deadline && <span>Hạn: {new Date(se.deadline).toLocaleDateString('vi-VN')}</span>}
                          {se.courseEnrollment && !done && (
                            <span>Tiến độ: {Math.round(se.courseEnrollment.progressPct)}%</span>
                          )}
                        </div>
                      </div>
                      {!locked && !done && (
                        <a href={`/courses/${se.step.course.id}`}
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 shrink-0">
                          Học →
                        </a>
                      )}
                      {done && (
                        <span className="text-xs text-green-600 font-medium shrink-0">Hoàn thành</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

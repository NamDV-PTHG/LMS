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
  pausedAt?: string;
  pausedReason?: string;
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
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-[18px] font-medium text-content">Lộ trình học tập của tôi</h1>
        <p className="text-[12px] text-subtle mt-1">Các lộ trình học bạn đang tham gia</p>
      </div>

      {enrollments.length === 0 && !data && (
        <div className="text-center py-12 text-[12px] text-faint">Đang tải...</div>
      )}
      {enrollments.length === 0 && data && (
        <div className="text-center py-12 text-[12px] text-faint">Bạn chưa có lộ trình học tập nào.</div>
      )}

      <div className="space-y-3">
        {enrollments.map((pe) => (
          <div key={pe.id} className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
            {/* Path header */}
            <div
              className="p-5 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => setExpandedId(expandedId === pe.id ? null : pe.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[13px] font-medium text-content">{pe.learningPath.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      pe.status === 'COMPLETED'
                        ? 'bg-success-tint text-success'
                        : pe.status === 'OVERDUE'
                        ? 'bg-danger-tint text-danger'
                        : pe.status === 'PAUSED'
                        ? 'bg-warning-tint text-warning'
                        : 'bg-primary-tint text-primary'
                    }`}>
                      {STATUS_LABELS[pe.status] ?? pe.status}
                    </span>
                    {pe.status === 'PAUSED' && pe.pausedReason === 'POSITION_CHANGE' && (
                      <span className="text-[10px] text-warning/80 bg-warning-tint px-2 py-0.5 rounded-full">
                        ⏸ Tạm dừng do thay đổi vị trí
                      </span>
                    )}
                  </div>
                  {pe.learningPath.description && (
                    <p className="text-[12px] text-subtle mt-1">{pe.learningPath.description}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-[11px] text-faint">
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
                  <div className="text-[20px] font-medium text-primary">{Math.round(pe.progressPct)}%</div>
                  <div className="text-[11px] text-faint">Tiến độ</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pe.status === 'COMPLETED' ? 'bg-success' : 'bg-primary'}`}
                  style={{ width: `${pe.progressPct}%` }}
                />
              </div>
            </div>

            {/* Steps expanded */}
            {expandedId === pe.id && (
              <div className="border-t border-default divide-y divide-default">
                {pe.stepEnrollments.map((se, idx) => {
                  const locked = !se.isUnlocked;
                  const done = !!se.completedAt;
                  return (
                    <div key={se.id} className={`p-4 flex items-start gap-4 ${locked ? 'opacity-60' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-medium shrink-0 ${
                        done
                          ? 'bg-success-tint text-success'
                          : locked
                          ? 'bg-muted text-faint'
                          : 'bg-primary-tint text-primary'
                      }`}>
                        {done ? '✓' : locked ? '🔒' : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-[12px] text-content">{se.step.course.title}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            se.step.stepType === 'REQUIRED'
                              ? 'bg-primary-tint text-primary'
                              : se.step.stepType === 'ELECTIVE'
                              ? 'bg-success-tint text-success'
                              : 'bg-muted text-subtle'
                          }`}>
                            {se.step.stepType === 'REQUIRED' ? 'Bắt buộc' : se.step.stepType === 'ELECTIVE' ? 'Tự chọn' : 'Nâng cao'}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-1 text-[11px] text-faint">
                          {se.step.course.estimatedHours && <span>{se.step.course.estimatedHours}h</span>}
                          {se.deadline && <span>Hạn: {new Date(se.deadline).toLocaleDateString('vi-VN')}</span>}
                          {se.courseEnrollment && !done && (
                            <span>Tiến độ: {Math.round(se.courseEnrollment.progressPct)}%</span>
                          )}
                        </div>
                      </div>
                      {!locked && !done && (
                        <a
                          href={`/courses/${se.step.course.id}`}
                          className="text-[11px] px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-lg shrink-0 transition-colors"
                        >
                          Học →
                        </a>
                      )}
                      {done && (
                        <span className="text-[11px] text-success font-medium shrink-0">Hoàn thành</span>
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

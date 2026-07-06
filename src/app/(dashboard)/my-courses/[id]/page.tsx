'use client';

import { useAuth } from '@/components/providers/auth-provider';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface LessonProgress {
  completedAt: string | null;
}

interface Lesson {
  id: string;
  title: string;
  contentType: string;
  order: number;
  durationSeconds: number | null;
  progress: LessonProgress | null;
}

interface Section {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface CourseDetail {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  estimatedHours: number | null;
  enrollmentId: string;
  progressPercent: number;
  completedAt: string | null;
  sections: Section[];
}

const CONTENT_ICON: Record<string, string> = {
  video: '▶',
  pdf: '📄',
  quiz: '✎',
  text: '≡',
};

export default function MyCourseDetailPage() {
  const { accessToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!accessToken || !id) return;
    fetch(`/api/my/courses/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setCourse(res.data);
          const allIds = new Set<string>((res.data.sections ?? []).map((s: Section) => s.id));
          setExpanded(allIds);
        } else {
          setError(res.error ?? 'Lỗi tải khóa học');
        }
      })
      .catch(() => setError('Không thể kết nối server'))
      .finally(() => setIsLoading(false));
  }, [accessToken, id]);

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="bg-danger-tint border border-danger/20 rounded-xl p-4 text-[12px] text-danger">{error}</div>
  );
  if (!course) return null;

  const sections = [...(course.sections ?? [])].sort((a, b) => a.order - b.order);

  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const completedLessons = sections.reduce(
    (acc, s) => acc + s.lessons.filter((l) => l.progress?.completedAt).length,
    0,
  );

  const toggleSection = (sId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sId)) next.delete(sId);
      else next.add(sId);
      return next;
    });
  };

  let firstIncomplete: { sectionId: string; lessonId: string } | null = null;
  for (const sec of sections) {
    const lessons = [...sec.lessons].sort((a, b) => a.order - b.order);
    for (const l of lessons) {
      if (!l.progress?.completedAt) {
        firstIncomplete = { sectionId: sec.id, lessonId: l.id };
        break;
      }
    }
    if (firstIncomplete) break;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/my-courses')}
          className="text-[12px] text-subtle hover:text-content mb-2 inline-flex items-center gap-1 transition-colors"
        >
          ← Khóa học của tôi
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-medium text-content">{course.title}</h1>
            {course.description && (
              <p className="text-[12px] text-subtle mt-1">{course.description}</p>
            )}
          </div>
          {firstIncomplete && (
            <Link
              href={`/my-courses/${id}/lessons/${firstIncomplete.lessonId}`}
              className="shrink-0 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg transition-colors"
            >
              {completedLessons > 0 ? 'Tiếp tục học' : 'Bắt đầu học'} →
            </Link>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-surface border border-default rounded-xl shadow-card p-4 space-y-2">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-content font-medium">Tiến độ học tập</span>
          <span className="text-primary font-medium">{course.progressPercent ?? 0}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${course.progressPercent ?? 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-faint">
          <span>{completedLessons}/{totalLessons} bài hoàn thành</span>
          {course.completedAt && (
            <span className="text-success font-medium">
              Hoàn thành {new Date(course.completedAt).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        <h2 className="text-[13px] font-medium text-content">Nội dung khóa học</h2>
        {sections.map((sec) => {
          const lessons = [...sec.lessons].sort((a, b) => a.order - b.order);
          const doneCount = lessons.filter((l) => l.progress?.completedAt).length;
          const isOpen = expanded.has(sec.id);

          return (
            <div key={sec.id} className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
              <button
                onClick={() => toggleSection(sec.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-content text-[12px]">{sec.title}</span>
                  {doneCount === lessons.length && lessons.length > 0 && (
                    <span className="text-[11px] text-success">✓</span>
                  )}
                </div>
                <span className="text-faint text-[11px]">
                  {doneCount}/{lessons.length} · {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-default divide-y divide-default">
                  {lessons.map((lesson) => {
                    const isDone = !!lesson.progress?.completedAt;
                    return (
                      <Link
                        key={lesson.id}
                        href={`/my-courses/${id}/lessons/${lesson.id}`}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted transition-colors group"
                      >
                        <span className="text-faint w-4 text-center text-[13px]">
                          {CONTENT_ICON[lesson.contentType] ?? '•'}
                        </span>
                        <span className={`flex-1 text-[12px] ${isDone ? 'text-faint' : 'text-subtle'}`}>
                          {lesson.title}
                        </span>
                        {lesson.durationSeconds != null && (
                          <span className="text-[11px] text-faint">
                            {Math.ceil(lesson.durationSeconds / 60)}p
                          </span>
                        )}
                        {isDone ? (
                          <span className="text-success text-[11px] font-medium">✓</span>
                        ) : (
                          <span className="text-primary text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

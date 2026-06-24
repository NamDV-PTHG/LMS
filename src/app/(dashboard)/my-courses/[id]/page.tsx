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

  if (isLoading) return <div className="p-8 text-center text-gray-400">Đang tải...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
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

  // Find first incomplete lesson for "continue" button
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
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/my-courses')}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1"
        >
          ← Khóa học của tôi
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-gray-500 mt-1">{course.description}</p>
            )}
          </div>
          {firstIncomplete && (
            <Link
              href={`/my-courses/${id}/lessons/${firstIncomplete.lessonId}`}
              className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              {completedLessons > 0 ? 'Tiếp tục học' : 'Bắt đầu học'} →
            </Link>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-xl border p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700 font-medium">Tiến độ học tập</span>
          <span className="text-blue-600 font-semibold">{course.progressPercent ?? 0}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${course.progressPercent ?? 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{completedLessons}/{totalLessons} bài hoàn thành</span>
          {course.completedAt && (
            <span className="text-green-600 font-medium">
              Hoàn thành {new Date(course.completedAt).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800">Nội dung khóa học</h2>
        {sections.map((sec) => {
          const lessons = [...sec.lessons].sort((a, b) => a.order - b.order);
          const doneCount = lessons.filter((l) => l.progress?.completedAt).length;
          const isOpen = expanded.has(sec.id);

          return (
            <div key={sec.id} className="bg-white rounded-xl border overflow-hidden">
              <button
                onClick={() => toggleSection(sec.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800 text-sm">{sec.title}</span>
                  {doneCount === lessons.length && lessons.length > 0 && (
                    <span className="text-xs text-green-600">✓</span>
                  )}
                </div>
                <span className="text-gray-400 text-xs">
                  {doneCount}/{lessons.length} · {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {isOpen && (
                <div className="border-t divide-y">
                  {lessons.map((lesson) => {
                    const isDone = !!lesson.progress?.completedAt;
                    return (
                      <Link
                        key={lesson.id}
                        href={`/my-courses/${id}/lessons/${lesson.id}`}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors group"
                      >
                        <span className="text-gray-400 w-4 text-center text-sm">
                          {CONTENT_ICON[lesson.contentType] ?? '•'}
                        </span>
                        <span className={`flex-1 text-sm ${isDone ? 'text-gray-400' : 'text-gray-700'}`}>
                          {lesson.title}
                        </span>
                        {lesson.durationSeconds != null && (
                          <span className="text-xs text-gray-400">
                            {Math.ceil(lesson.durationSeconds / 60)}p
                          </span>
                        )}
                        {isDone ? (
                          <span className="text-green-500 text-xs font-medium">✓</span>
                        ) : (
                          <span className="text-blue-500 text-xs opacity-0 group-hover:opacity-100">→</span>
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

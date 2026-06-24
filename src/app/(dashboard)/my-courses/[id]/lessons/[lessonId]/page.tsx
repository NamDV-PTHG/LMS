'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ssr: false — cả video.js lẫn pdfjs-dist dùng browser-only APIs (DOMMatrix v.v.)
// nên không thể render ở server. Dynamic import tránh crash SSR.
const VideoPlayer = dynamic(
  () => import('@/components/lesson/VideoPlayer').then((m) => m.VideoPlayer),
  { ssr: false, loading: () => <div className="bg-black aspect-video rounded-xl flex items-center justify-center text-gray-400 text-sm">Đang tải player...</div> },
);
const PdfViewer = dynamic(
  () => import('@/components/lesson/PdfViewer').then((m) => m.PdfViewer),
  { ssr: false, loading: () => <div className="bg-gray-100 rounded-xl h-64 flex items-center justify-center text-gray-400 text-sm">Đang tải viewer...</div> },
);
import { useEffect, useState } from 'react';

interface QuizQuestion {
  id: string;
  content: string;
  type: string;
  options: { id: string; label: string; content: string }[];
}

interface QuizAttempt {
  attemptId: string;
  questions: QuizQuestion[];
  timeLimit: number | null;
}

interface LessonDetail {
  id: string;
  title: string;
  contentType: string;
  textContent: string | null;
  assetId: string | null;
  quizId: string | null;
  order: number;
  enrollmentId: string;
  progress: { completedAt: string | null } | null;
  // Navigation
  prevLessonId: string | null;
  nextLessonId: string | null;
  courseId: string;
}

export default function LessonPlayerPage() {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Quiz state
  const [quizAttempt, setQuizAttempt] = useState<QuizAttempt | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean; totalQuestions: number } | null>(null);

  const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (!accessToken || !courseId || !lessonId) return;
    setIsLoading(true);
    setLesson(null);
    setQuizAttempt(null);
    setQuizResult(null);
    setQuizAnswers({});
    setCompleted(false);

    fetch(`/api/my/courses/${courseId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) { setError(res.error ?? 'Lỗi tải khóa học'); return; }
        const course = res.data;
        const sections: { lessons: LessonDetail[] }[] = course.sections ?? [];
        const allLessons: LessonDetail[] = sections
          .flatMap((s: { lessons: LessonDetail[] }) => s.lessons)
          .sort((a: LessonDetail, b: LessonDetail) => a.order - b.order);

        const idx = allLessons.findIndex((l) => l.id === lessonId);
        if (idx === -1) { setError('Không tìm thấy bài học'); return; }

        const found = allLessons[idx] as LessonDetail;
        const enriched: LessonDetail = {
          ...found,
          enrollmentId: course.enrollmentId,
          courseId,
          prevLessonId: idx > 0 ? allLessons[idx - 1].id : null,
          nextLessonId: idx < allLessons.length - 1 ? allLessons[idx + 1].id : null,
        };
        setLesson(enriched);
        setCompleted(!!found.progress?.completedAt);
      })
      .catch(() => setError('Không thể kết nối server'))
      .finally(() => setIsLoading(false));
  }, [accessToken, courseId, lessonId]); // eslint-disable-line

  const handleComplete = async () => {
    if (!lesson || completing) return;
    setCompleting(true);
    try {
      await fetch(`/api/my/courses/${courseId}/lessons/${lessonId}/progress`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ progressPct: 100, status: 'completed' }),
      });
      setCompleted(true);
    } catch {
      // silent
    } finally {
      setCompleting(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!lesson?.quizId) return;
    setQuizLoading(true);
    try {
      const res = await fetch(
        `/api/quizzes/${lesson.quizId}/start?enrollmentId=${lesson.enrollmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ).then((r) => r.json());
      if (res.success) setQuizAttempt(res.data);
      else toast('error', res.error ?? 'Không thể bắt đầu quiz');
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!lesson?.quizId || !quizAttempt) return;
    setQuizSubmitting(true);
    try {
      const answers = Object.entries(quizAnswers).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));
      const res = await fetch(`/api/quizzes/${lesson.quizId}/submit`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ attemptId: quizAttempt.attemptId, answers }),
      }).then((r) => r.json());
      if (res.success) {
        setQuizResult(res.data);
        if (res.data.passed) handleComplete();
      } else {
        toast('error', res.error ?? 'Nộp bài thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setQuizSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Đang tải...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!lesson) return null;

  const renderContent = () => {
    switch (lesson.contentType) {
      case 'video':
        return lesson.assetId ? (
          <VideoPlayer
            assetId={lesson.assetId}
            enrollmentId={lesson.enrollmentId}
            accessToken={accessToken!}
            onComplete={handleComplete}
            className="rounded-xl overflow-hidden"
          />
        ) : (
          <div className="bg-black aspect-video rounded-xl flex items-center justify-center text-gray-400">
            Không có video
          </div>
        );

      case 'pdf':
        return lesson.assetId ? (
          <PdfViewer
            assetId={lesson.assetId}
            enrollmentId={lesson.enrollmentId}
            accessToken={accessToken!}
            userFullName={user?.fullName ?? ''}
            userEmail={user?.email ?? ''}
            onComplete={handleComplete}
          />
        ) : (
          <div className="bg-gray-100 rounded-xl h-64 flex items-center justify-center text-gray-400">
            Không có tài liệu PDF
          </div>
        );

      case 'quiz':
        return (
          <div className="bg-white rounded-xl border p-6 space-y-5">
            {!quizAttempt && !quizResult && (
              <div className="text-center space-y-4">
                <div className="text-4xl">✎</div>
                <h3 className="text-lg font-semibold text-gray-800">Bài kiểm tra</h3>
                <p className="text-sm text-gray-500">Làm bài kiểm tra để hoàn thành bài học này</p>
                <button
                  onClick={handleStartQuiz}
                  disabled={quizLoading}
                  className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {quizLoading ? 'Đang tải...' : 'Bắt đầu làm bài'}
                </button>
              </div>
            )}

            {quizAttempt && !quizResult && (
              <div className="space-y-6">
                <h3 className="text-base font-semibold text-gray-800">
                  Bài kiểm tra ({quizAttempt.questions.length} câu)
                </h3>
                {quizAttempt.questions.map((q, qi) => (
                  <div key={q.id} className="space-y-3">
                    <p className="text-sm font-medium text-gray-800">
                      <span className="text-blue-600 mr-1">Câu {qi + 1}.</span>
                      {q.content}
                    </p>
                    <div className="space-y-2 pl-4">
                      {q.options.map((opt) => (
                        <label
                          key={opt.id}
                          className="flex items-center gap-2.5 cursor-pointer group"
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            value={opt.id}
                            checked={quizAnswers[q.id] === opt.id}
                            onChange={() => setQuizAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                            className="accent-blue-600"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">
                            <span className="font-medium text-gray-500 mr-1">{opt.label}.</span>
                            {opt.content}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSubmitQuiz}
                  disabled={quizSubmitting || Object.keys(quizAnswers).length < quizAttempt.questions.length}
                  className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {quizSubmitting ? 'Đang nộp bài...' : 'Nộp bài'}
                </button>
              </div>
            )}

            {quizResult && (
              <div className="text-center space-y-4">
                <div className={`text-5xl font-bold ${quizResult.passed ? 'text-green-600' : 'text-red-500'}`}>
                  {quizResult.score}%
                </div>
                <p className={`text-base font-medium ${quizResult.passed ? 'text-green-700' : 'text-red-600'}`}>
                  {quizResult.passed ? 'Chúc mừng! Bạn đã qua bài kiểm tra.' : 'Chưa đạt. Hãy thử lại.'}
                </p>
                <p className="text-sm text-gray-500">
                  {quizResult.score}% / {quizResult.totalQuestions} câu
                </p>
                {!quizResult.passed && (
                  <button
                    onClick={() => { setQuizAttempt(null); setQuizAnswers({}); setQuizResult(null); }}
                    className="px-5 py-2 border border-blue-600 text-blue-600 text-sm rounded-lg hover:bg-blue-50"
                  >
                    Làm lại
                  </button>
                )}
              </div>
            )}
          </div>
        );

      case 'text':
      default:
        return (
          <div className="bg-white rounded-xl border p-6 prose prose-sm max-w-none">
            {lesson.textContent ? (
              <div dangerouslySetInnerHTML={{ __html: lesson.textContent }} />
            ) : (
              <p className="text-gray-400">Không có nội dung</p>
            )}
          </div>
        );
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Breadcrumb nav */}
      <div className="flex items-center justify-between">
        <Link
          href={`/my-courses/${courseId}`}
          className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
        >
          ← Danh sách bài học
        </Link>
        <div className="flex items-center gap-2">
          {lesson.prevLessonId && (
            <Link
              href={`/my-courses/${courseId}/lessons/${lesson.prevLessonId}`}
              className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
            >
              ← Bài trước
            </Link>
          )}
          {lesson.nextLessonId && (
            <Link
              href={`/my-courses/${courseId}/lessons/${lesson.nextLessonId}`}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Bài tiếp →
            </Link>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{lesson.title}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400 capitalize">{lesson.contentType}</span>
          {completed && (
            <span className="text-xs text-green-600 font-medium">✓ Đã hoàn thành</span>
          )}
        </div>
      </div>

      {/* Content */}
      {renderContent()}

      {/* Complete button for text/manual */}
      {(lesson.contentType === 'text' || lesson.contentType === 'pdf') && !completed && (
        <div className="pt-2">
          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {completing ? 'Đang lưu...' : 'Đánh dấu hoàn thành'}
          </button>
        </div>
      )}

      {/* Completed state */}
      {completed && lesson.contentType !== 'quiz' && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="text-sm text-green-700 font-medium">Bài học đã hoàn thành!</span>
          {lesson.nextLessonId && (
            <Link
              href={`/my-courses/${courseId}/lessons/${lesson.nextLessonId}`}
              className="text-sm text-blue-600 font-medium hover:text-blue-800"
            >
              Bài tiếp theo →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

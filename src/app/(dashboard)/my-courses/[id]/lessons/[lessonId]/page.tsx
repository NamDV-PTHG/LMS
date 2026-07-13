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
  { ssr: false, loading: () => <div className="bg-black aspect-video rounded-xl flex items-center justify-center text-faint text-[12px]">Đang tải player...</div> },
);
const PdfViewer = dynamic(
  () => import('@/components/lesson/PdfViewer').then((m) => m.PdfViewer),
  { ssr: false, loading: () => <div className="bg-muted rounded-xl h-64 flex items-center justify-center text-faint text-[12px]">Đang tải viewer...</div> },
);
import { useEffect, useState } from 'react';

interface QuizQuestion {
  id: string;
  questionText: string;
  type: string;
  options: { key: string; text: string }[];
}

interface QuizAttempt {
  attemptId: string;
  questions: QuizQuestion[];
  timeLimit: number | null;
}

interface LessonAttachment {
  id: string;
  title: string;
  fileType: string;  // 'document' | 'video' | 'audio' | 'image' | 'presentation'
  mimeType: string;
}

interface LessonDetail {
  id: string;
  title: string;
  contentType: string;
  textContent: string | null;
  assetId: string | null;
  attachments: LessonAttachment[];
  quizId: string | null;
  order: number;
  enrollmentId: string;
  progress: { completedAt: string | null } | null;
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

  // Rating modal
  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Quiz state
  const [quizAttempt, setQuizAttempt] = useState<QuizAttempt | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; maxScore: number; scorePct: number; isPassed: boolean; passingScore: number } | null>(null);

  // HTML preview cho DOCX: assetId → { html, loading, error }
  const [docHtml, setDocHtml] = useState<Record<string, { html: string | null; loading: boolean; error: string | null }>>({});

  const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  // Fetch HTML preview từ DOCX qua mammoth (server-side convert)
  const loadDocHtml = async (assetId: string) => {
    if (docHtml[assetId]) return; // đã load rồi
    setDocHtml((prev) => ({ ...prev, [assetId]: { html: null, loading: true, error: null } }));
    try {
      const res = await fetch(`/api/assets/${assetId}/html-preview`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setDocHtml((prev) => ({ ...prev, [assetId]: { html: data.data.html, loading: false, error: null } }));
      } else {
        setDocHtml((prev) => ({ ...prev, [assetId]: { html: null, loading: false, error: data.error ?? 'Không thể hiển thị tài liệu' } }));
      }
    } catch {
      setDocHtml((prev) => ({ ...prev, [assetId]: { html: null, loading: false, error: 'Lỗi kết nối' } }));
    }
  };

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

  const checkAndShowRating = async (isLastLesson: boolean) => {
    if (!isLastLesson || !accessToken || !courseId) return;
    try {
      const res = await fetch(`/api/my/courses/${courseId}/rate`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json());
      if (res.success && !res.data) {
        setTimeout(() => setShowRating(true), 1200);
      }
    } catch { /* ignore */ }
  };

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
      if (!lesson.nextLessonId) {
        checkAndShowRating(true);
      }
    } catch {
      // silent
    } finally {
      setCompleting(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      toast('error', 'Vui lòng chọn số sao đánh giá');
      return;
    }
    setSubmittingRating(true);
    try {
      const res = await fetch(`/api/my/courses/${courseId}/rate`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ rating: ratingValue, comment: ratingComment }),
      }).then((r) => r.json());
      if (res.success) {
        setRatingSubmitted(true);
        toast('success', 'Cảm ơn bạn đã đánh giá khóa học!');
        setTimeout(() => setShowRating(false), 1500);
      } else {
        toast('error', res.error ?? 'Gửi đánh giá thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setSubmittingRating(false);
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
      const res = await fetch(`/api/quizzes/${quizAttempt.attemptId}/submit`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ answers: quizAnswers }),
      }).then((r) => r.json());
      if (res.success) {
        setQuizResult(res.data);
        if (res.data.isPassed) handleComplete();
      } else {
        toast('error', res.error ?? 'Nộp bài thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối');
    } finally {
      setQuizSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="bg-danger-tint border border-danger/20 rounded-xl p-4 text-[12px] text-danger">{error}</div>
  );
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
          <div className="bg-black aspect-video rounded-xl flex items-center justify-center text-faint text-[12px]">
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
          <div className="bg-muted rounded-xl h-64 flex items-center justify-center text-faint text-[12px]">
            Không có tài liệu PDF
          </div>
        );

      case 'quiz':
        return (
          <div className="bg-surface border border-default rounded-xl shadow-card p-5 space-y-5">
            {!quizAttempt && !quizResult && (
              <div className="text-center space-y-4">
                <div className="text-[36px]">✎</div>
                <h3 className="text-[14px] font-medium text-content">Bài kiểm tra</h3>
                <p className="text-[12px] text-subtle">Làm bài kiểm tra để hoàn thành bài học này</p>
                <button
                  onClick={handleStartQuiz}
                  disabled={quizLoading}
                  className="px-5 py-2 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  {quizLoading ? 'Đang tải...' : 'Bắt đầu làm bài'}
                </button>
              </div>
            )}

            {quizAttempt && !quizResult && (
              <div className="space-y-5">
                <h3 className="text-[13px] font-medium text-content">
                  Bài kiểm tra ({quizAttempt.questions.length} câu)
                </h3>
                {quizAttempt.questions.map((q, qi) => (
                  <div key={q.id} className="space-y-3">
                    <p className="text-[12px] font-medium text-content">
                      <span className="text-primary mr-1">Câu {qi + 1}.</span>
                      {q.questionText}
                    </p>
                    <div className="space-y-2 pl-4">
                      {[...q.options].sort((a, b) => a.key.localeCompare(b.key)).map((opt) => (
                        <label
                          key={opt.key}
                          className="flex items-center gap-2.5 cursor-pointer group"
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            value={opt.key}
                            checked={quizAnswers[q.id] === opt.key}
                            onChange={() => setQuizAnswers((a) => ({ ...a, [q.id]: opt.key }))}
                            className="accent-primary"
                          />
                          <span className="text-[12px] text-subtle group-hover:text-content transition-colors">
                            <span className="font-medium text-faint mr-1">{opt.key}.</span>
                            {opt.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSubmitQuiz}
                  disabled={quizSubmitting || Object.keys(quizAnswers).length < quizAttempt.questions.length}
                  className="w-full py-2.5 bg-success hover:bg-success/90 text-white text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  {quizSubmitting ? 'Đang nộp bài...' : 'Nộp bài'}
                </button>
              </div>
            )}

            {quizResult && (
              <div className="text-center space-y-4">
                <div className={`text-[40px] font-medium ${quizResult.isPassed ? 'text-success' : 'text-danger'}`}>
                  {quizResult.scorePct}%
                </div>
                <p className={`text-[13px] font-medium ${quizResult.isPassed ? 'text-success' : 'text-danger'}`}>
                  {quizResult.isPassed ? 'Chúc mừng! Bạn đã qua bài kiểm tra.' : 'Chưa đạt. Hãy thử lại.'}
                </p>
                <p className="text-[12px] text-subtle">
                  {quizResult.score}/{quizResult.maxScore} điểm · Điểm đạt: {quizResult.passingScore}%
                </p>
                {!quizResult.isPassed && (
                  <button
                    onClick={() => { setQuizAttempt(null); setQuizAnswers({}); setQuizResult(null); }}
                    className="px-5 py-2 border border-primary text-primary text-[12px] rounded-lg hover:bg-primary-tint transition-colors"
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
          <div className="bg-surface border border-default rounded-xl shadow-card p-5 prose prose-sm max-w-none">
            {lesson.textContent ? (
              <div dangerouslySetInnerHTML={{ __html: lesson.textContent }} />
            ) : (
              <p className="text-faint text-[12px]">Không có nội dung</p>
            )}
          </div>
        );
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Breadcrumb nav */}
      <div className="flex items-center justify-between">
        <Link
          href={`/my-courses/${courseId}`}
          className="text-[12px] text-subtle hover:text-content inline-flex items-center gap-1 transition-colors"
        >
          ← Danh sách bài học
        </Link>
        <div className="flex items-center gap-2">
          {lesson.prevLessonId && (
            <Link
              href={`/my-courses/${courseId}/lessons/${lesson.prevLessonId}`}
              className="px-3 py-1.5 text-[11px] border border-default rounded-lg hover:bg-muted transition-colors text-subtle"
            >
              ← Bài trước
            </Link>
          )}
          {lesson.nextLessonId && (
            <Link
              href={`/my-courses/${courseId}/lessons/${lesson.nextLessonId}`}
              className="px-3 py-1.5 text-[11px] bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
            >
              Bài tiếp →
            </Link>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-[16px] font-medium text-content">{lesson.title}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-faint capitalize">{lesson.contentType}</span>
          {completed && (
            <span className="text-[11px] text-success font-medium">✓ Đã hoàn thành</span>
          )}
        </div>
      </div>

      {/* Content */}
      {renderContent()}

      {/* Tài liệu học — hiển thị inline cho mọi loại bài học nếu có doc/word attachment */}
      {lesson.attachments && lesson.attachments
        .filter((att) =>
          att.mimeType.includes('wordprocessingml') ||
          att.mimeType.includes('msword') ||
          att.fileType === 'document'
        )
        .map((att) => {
          const state = docHtml[att.id];
          // Tự động load khi render lần đầu
          if (!state) { loadDocHtml(att.id); }

          return (
            <div key={att.id} className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-default bg-muted/40">
                <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-primary flex-shrink-0">
                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 000 2h8a1 1 0 100-2H6zm0 4a1 1 0 100 2h4a1 1 0 100-2H6z"/>
                </svg>
                <span className="text-[12px] font-medium text-content truncate">{att.title}</span>
                <span className="text-[10px] text-faint ml-auto flex-shrink-0">Word</span>
              </div>

              {/* Nội dung */}
              {(!state || state.loading) && (
                <div className="flex items-center justify-center gap-2 py-10">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px] text-subtle">Đang tải tài liệu...</span>
                </div>
              )}
              {state?.error && (
                <div className="px-5 py-6 text-center text-[12px] text-danger">
                  {state.error}
                </div>
              )}
              {state?.html && (
                <div
                  className="px-6 py-5 prose prose-sm max-w-none text-content overflow-auto"
                  style={{ maxHeight: '70vh' }}
                  dangerouslySetInnerHTML={{ __html: state.html }}
                />
              )}
            </div>
          );
        })
      }

      {/* Complete button for text/manual */}
      {(lesson.contentType === 'text' || lesson.contentType === 'pdf') && !completed && (
        <div className="pt-1">
          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full py-2.5 bg-success hover:bg-success/90 text-white text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {completing ? 'Đang lưu...' : 'Đánh dấu hoàn thành'}
          </button>
        </div>
      )}

      {/* Completed state */}
      {completed && lesson.contentType !== 'quiz' && (
        <div className="flex items-center justify-between bg-success-tint border border-success/20 rounded-xl px-4 py-3">
          <span className="text-[12px] text-success font-medium">Bài học đã hoàn thành!</span>
          {lesson.nextLessonId && (
            <Link
              href={`/my-courses/${courseId}/lessons/${lesson.nextLessonId}`}
              className="text-[12px] text-primary font-medium hover:text-primary-dark transition-colors"
            >
              Bài tiếp theo →
            </Link>
          )}
        </div>
      )}

      {/* Rating modal */}
      {showRating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md bg-surface rounded-xl border border-default shadow-card overflow-hidden">
            {ratingSubmitted ? (
              <div className="px-8 py-10 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-success-tint flex items-center justify-center text-[24px] text-success">✓</div>
                <p className="text-[14px] font-medium text-content">Cảm ơn đánh giá của bạn!</p>
                <p className="text-[12px] text-subtle">Phản hồi của bạn giúp cải thiện chất lượng đào tạo</p>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-[14px] font-medium text-content">Đánh giá khóa học</p>
                  <p className="text-[12px] text-subtle">Bạn thấy khóa học này như thế nào?</p>
                </div>

                {/* 5 sao */}
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRatingValue(star)}
                      className={`text-[36px] transition-all hover:scale-110 ${
                        star <= ratingValue ? 'text-yellow-400' : 'text-faint'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {ratingValue > 0 && (
                  <p className="text-center text-[12px] text-subtle font-medium">
                    {['', 'Rất tệ', 'Không tốt', 'Bình thường', 'Tốt', 'Xuất sắc'][ratingValue]}
                  </p>
                )}

                {/* Comment */}
                <div>
                  <label className="block text-[12px] font-medium text-content mb-1">Nhận xét (tùy chọn)</label>
                  <textarea
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Chia sẻ trải nghiệm của bạn về khóa học..."
                    rows={3}
                    className="w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowRating(false)}
                    className="flex-1 py-2.5 border border-default text-[12px] font-medium text-subtle rounded-lg hover:bg-muted transition-colors"
                  >
                    Bỏ qua
                  </button>
                  <button
                    onClick={handleSubmitRating}
                    disabled={submittingRating || ratingValue === 0}
                    className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white text-[12px] font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {submittingRating ? 'Đang gửi...' : 'Gửi đánh giá'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

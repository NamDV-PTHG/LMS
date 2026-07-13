'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  ArrowLeft, ChevronRight, FileText, ClipboardCheck,
  BookOpen, PenLine, Check
} from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'

// ── Dynamic imports — browser-only APIs ──────────────────────────────────────
const VideoPlayer = dynamic(
  () => import('@/components/lesson/VideoPlayer').then((m) => m.VideoPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-black aspect-video w-full flex items-center justify-center">
        <span className="text-white/50 text-[13px]">Đang tải player...</span>
      </div>
    ),
  },
)

// ── Types ─────────────────────────────────────────────────────────────────────
interface LessonInfo {
  id: string
  title: string
  contentType: string
  assetId: string | null
  quizId: string | null
  textContent: string | null
  estimatedMinutes: number | null
  progress: { completedAt: string | null; progressPct: number; status: string } | null
  enrollmentId: string | null
  prevLessonId: string | null
  nextLessonId: string | null
  prevLessonTitle: string | null
  nextLessonTitle: string | null
  courseTitle: string
}

type ActiveTab = 'lesson' | 'notes'

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LessonPlayerPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const { accessToken, user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [lesson, setLesson] = useState<LessonInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('lesson')
  const [notes, setNotes] = useState('')

  // Rating modal state
  const [showRating, setShowRating] = useState(false)
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)

  // urlKey — increment every 15 min to remount VideoPlayer → fresh presigned URL fetch
  const [urlKey, setUrlKey] = useState(0)
  const renewTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Progress batch queue — flush every 10s
  const progressQueue = useRef<{ pct: number; ts: number }[]>([])
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastFlushPct = useRef<number>(0)

  // ── Auth guard ────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !accessToken) router.replace('/app/login')
  }, [authLoading, accessToken, router])

  // ── Load lesson data ──────────────────────────────────────────
  useEffect(() => {
    if (!accessToken || !courseId || !lessonId) return
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/my/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = await res.json()
        if (!json.success) { toast('error', json.error ?? 'Không tải được bài học'); return }

        const course = json.data
        const allLessons = (course.sections ?? []).flatMap(
          (s: { lessons: LessonInfo[] }) => s.lessons,
        )
        const idx = allLessons.findIndex((l: LessonInfo) => l.id === lessonId)
        if (idx === -1) { toast('error', 'Không tìm thấy bài học'); return }

        const found = allLessons[idx] as LessonInfo
        setLesson({
          ...found,
          enrollmentId: course.enrollmentId,
          prevLessonId: idx > 0 ? allLessons[idx - 1].id : null,
          nextLessonId: idx < allLessons.length - 1 ? allLessons[idx + 1].id : null,
          prevLessonTitle: idx > 0 ? allLessons[idx - 1].title : null,
          nextLessonTitle: idx < allLessons.length - 1 ? allLessons[idx + 1].title : null,
          courseTitle: course.title,
        })
        setCompleted(!!found.progress?.completedAt || found.progress?.status === 'completed')
      } catch {
        toast('error', 'Lỗi kết nối, vui lòng thử lại')
      } finally {
        setLoading(false)
      }
    })()
  }, [accessToken, courseId, lessonId]) // eslint-disable-line

  // ── Load notes from localStorage ──────────────────────────────
  useEffect(() => {
    if (!lessonId) return
    const saved = localStorage.getItem(`pwa-lesson-notes-${lessonId}`) ?? ''
    setNotes(saved)
  }, [lessonId])

  // ── URL renewal — remount VideoPlayer every 15 min ────────────
  useEffect(() => {
    renewTimer.current = setInterval(() => {
      setUrlKey((k) => k + 1)
    }, 15 * 60 * 1000)
    return () => {
      if (renewTimer.current) clearInterval(renewTimer.current)
    }
  }, [])

  // ── Progress flush ─────────────────────────────────────────────
  const flushProgress = useCallback(async (forcePct?: number) => {
    if (!accessToken || !courseId || !lessonId) return
    const pct = forcePct ?? progressQueue.current[progressQueue.current.length - 1]?.pct
    if (pct === undefined || pct <= lastFlushPct.current) return
    lastFlushPct.current = pct
    progressQueue.current = []
    const isCompleted = pct >= 90
    await fetch(`/api/my/courses/${courseId}/lessons/${lessonId}/progress`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        progressPct: Math.min(pct, 100),
        status: isCompleted ? 'completed' : 'in_progress',
        ...(isCompleted ? { timeSpentSec: Math.floor(Date.now() / 1000) } : {}),
      }),
    }).catch(() => {})
  }, [accessToken, courseId, lessonId])

  // Start batch timer while on page
  useEffect(() => {
    progressTimer.current = setInterval(() => flushProgress(), 10_000)
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current)
      // Flush on unmount
      flushProgress()
    }
  }, [flushProgress])

  // ── Video progress tracking (timeupdate via DOM) ───────────────
  useEffect(() => {
    const track = () => {
      const video = document.querySelector('video')
      if (!video || !video.duration) return
      const pct = Math.floor((video.currentTime / video.duration) * 100)
      progressQueue.current.push({ pct, ts: Date.now() })
    }
    // Poll every 5s (lightweight, no event needed)
    const id = setInterval(track, 5_000)
    return () => clearInterval(id)
  }, [lesson])

  // ── Kiểm tra và hiển thị modal rating khi hoàn thành bài cuối ─
  const checkAndShowRating = useCallback(async (isLastLesson: boolean) => {
    if (!isLastLesson || !accessToken || !courseId) return
    // Kiểm tra đã đánh giá chưa
    try {
      const res = await fetch(`/api/my/courses/${courseId}/rate`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const json = await res.json()
      if (json.success && !json.data) {
        // Chưa đánh giá → hiển thị modal sau 1.5s
        setTimeout(() => setShowRating(true), 1500)
      }
    } catch { /* không block */ }
  }, [accessToken, courseId])

  // ── Video complete handler ─────────────────────────────────────
  const handleVideoComplete = useCallback(async () => {
    if (completing) return
    setCompleting(true)
    try {
      await flushProgress(100)
      setCompleted(true)
      toast('success', 'Đã hoàn thành bài học!')
      // Nếu là bài cuối → hỏi đánh giá
      if (!lesson?.nextLessonId) {
        checkAndShowRating(true)
      }
    } finally {
      setCompleting(false)
    }
  }, [completing, flushProgress, toast, lesson, checkAndShowRating])

  // ── Mark complete manually (for text/pdf) ─────────────────────
  const handleManualComplete = async () => {
    if (completing || completed) return
    setCompleting(true)
    try {
      await fetch(`/api/my/courses/${courseId}/lessons/${lessonId}/progress`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ progressPct: 100, status: 'completed' }),
      })
      setCompleted(true)
      toast('success', 'Đã đánh dấu hoàn thành')
      if (!lesson?.nextLessonId) {
        checkAndShowRating(true)
      }
    } catch {
      toast('error', 'Lỗi lưu tiến độ')
    } finally {
      setCompleting(false)
    }
  }

  // ── Gửi đánh giá khóa học ────────────────────────────────────
  const handleSubmitRating = async () => {
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      toast('error', 'Vui lòng chọn số sao')
      return
    }
    setSubmittingRating(true)
    try {
      const res = await fetch(`/api/my/courses/${courseId}/rate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: ratingValue, comment: ratingComment }),
      })
      const json = await res.json()
      if (json.success) {
        setRatingSubmitted(true)
        toast('success', 'Cảm ơn bạn đã đánh giá khóa học!')
        setTimeout(() => setShowRating(false), 1500)
      } else {
        toast('error', json.error ?? 'Gửi đánh giá thất bại')
      }
    } catch {
      toast('error', 'Lỗi kết nối')
    } finally {
      setSubmittingRating(false)
    }
  }

  // ── Notes save (debounced) ─────────────────────────────────────
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleNotesChange = (val: string) => {
    setNotes(val)
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current)
    notesSaveTimer.current = setTimeout(() => {
      localStorage.setItem(`pwa-lesson-notes-${lessonId}`, val)
    }, 500)
  }

  // ── Render ────────────────────────────────────────────────────
  if (loading) return <LessonSkeleton />
  if (!lesson) return null

  const isVideo = lesson.contentType === 'video'
  const isPdf = lesson.contentType === 'pdf'
  const isText = lesson.contentType === 'text'

  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-black flex items-center gap-2 px-3 h-12">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full
                     active:bg-white/10 transition-colors shrink-0"
          aria-label="Quay lại"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>
        <p className="text-white text-[13px] font-medium truncate flex-1">{lesson.title}</p>
        {completed && <Check size={16} className="text-success shrink-0" />}
      </header>

      {/* ── Video / PDF / Text area ── */}
      {isVideo && (
        <div className="bg-black">
          {lesson.assetId ? (
            <VideoPlayer
              key={`player-${urlKey}`}
              assetId={lesson.assetId}
              enrollmentId={lesson.enrollmentId ?? undefined}
              accessToken={accessToken!}
              onComplete={handleVideoComplete}
            />
          ) : (
            <NoContentPlaceholder label="Chưa có video cho bài học này" />
          )}
        </div>
      )}

      {isPdf && (
        <div className="bg-surface">
          {lesson.assetId ? (
            <PdfEmbed
              assetId={lesson.assetId}
              accessToken={accessToken!}
            />
          ) : (
            <NoContentPlaceholder label="Chưa có tài liệu PDF" />
          )}
        </div>
      )}

      {isText && (
        <div className="bg-surface px-4 py-4">
          {lesson.textContent ? (
            <div
              className="prose prose-sm max-w-none text-[13px] leading-relaxed text-content"
              dangerouslySetInnerHTML={{ __html: lesson.textContent }}
            />
          ) : (
            <NoContentPlaceholder label="Chưa có nội dung" />
          )}
        </div>
      )}

      {/* ── Tab bar: Bài học / Ghi chú ── */}
      <div className="bg-surface flex border-b border-[rgba(0,0,0,0.06)] sticky top-12 z-30">
        <TabBtn active={activeTab === 'lesson'} onClick={() => setActiveTab('lesson')}>
          <BookOpen size={13} className="mr-1 inline" />
          Bài học
        </TabBtn>
        <TabBtn active={activeTab === 'notes'} onClick={() => setActiveTab('notes')}>
          <PenLine size={13} className="mr-1 inline" />
          Ghi chú
        </TabBtn>
      </div>

      {/* ── Tab content ── */}
      <div className="px-4 py-4 space-y-3">

        {activeTab === 'lesson' && (
          <>
            {/* Lesson meta */}
            <div className="bg-surface rounded-xl shadow-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-medium text-content leading-snug">{lesson.title}</h2>
                {completed && (
                  <span className="shrink-0 bg-success-tint text-success text-[10px] font-medium
                                   rounded-full px-2.5 py-0.5">
                    Hoàn thành
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ContentTypeBadge type={lesson.contentType} />
                {lesson.estimatedMinutes && (
                  <span className="text-[10px] text-faint">{lesson.estimatedMinutes} phút</span>
                )}
              </div>
            </div>

            {/* Manual complete for text/pdf */}
            {(isText || isPdf) && !completed && (
              <button
                onClick={handleManualComplete}
                disabled={completing}
                className="w-full bg-primary text-white text-[13px] font-medium rounded-lg py-2.5
                           active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {completing ? 'Đang lưu...' : 'Đánh dấu hoàn thành'}
              </button>
            )}

            {/* Navigation */}
            <div className="space-y-2">
              {lesson.nextLessonId && (
                <Link
                  href={`/app/courses/${courseId}/lessons/${lesson.nextLessonId}`}
                  className="flex items-center justify-between bg-surface rounded-xl shadow-card p-4
                             active:scale-[0.99] transition-transform"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] text-faint">Bài tiếp theo</p>
                    <p className="text-[13px] font-medium text-content truncate mt-0.5">
                      {lesson.nextLessonTitle}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-faint shrink-0" />
                </Link>
              )}
              {lesson.prevLessonId && (
                <Link
                  href={`/app/courses/${courseId}/lessons/${lesson.prevLessonId}`}
                  className="flex items-center gap-3 bg-surface rounded-xl shadow-card p-3
                             active:scale-[0.99] transition-transform"
                >
                  <ArrowLeft size={16} className="text-faint shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-faint">Bài trước</p>
                    <p className="text-[13px] text-subtle truncate">{lesson.prevLessonTitle}</p>
                  </div>
                </Link>
              )}
            </div>

            {/* Back to course */}
            <Link
              href={`/app/courses/${courseId}`}
              className="block text-center text-[13px] text-primary py-2"
            >
              Xem tất cả bài học
            </Link>
          </>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-3">
            <div className="bg-surface rounded-xl shadow-card overflow-hidden">
              <textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Ghi chú cá nhân của bạn cho bài học này..."
                rows={10}
                className="w-full px-4 py-3 text-[13px] text-content placeholder:text-faint
                           bg-transparent focus:outline-none resize-none leading-relaxed"
              />
            </div>
            <p className="text-[10px] text-faint text-center">
              Ghi chú tự động lưu vào thiết bị
            </p>
          </div>
        )}
      </div>

      {/* ── Next lesson bar (sticky above bottom nav) ── */}
      {completed && lesson.nextLessonId && (
        <div className="fixed bottom-16 left-0 right-0 max-w-phone mx-auto z-40 px-4 pb-2">
          <Link
            href={`/app/courses/${courseId}/lessons/${lesson.nextLessonId}`}
            className="flex items-center justify-between bg-primary text-white
                       rounded-xl px-4 py-3 shadow-nav
                       active:scale-[0.98] transition-transform"
          >
            <div className="min-w-0">
              <p className="text-[10px] text-white/70">Tiếp theo</p>
              <p className="text-[13px] font-medium truncate">{lesson.nextLessonTitle}</p>
            </div>
            <ChevronRight size={20} className="shrink-0" />
          </Link>
        </div>
      )}

      {/* ── Modal đánh giá khóa học ── */}
      {showRating && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-20">
          <div className="w-full max-w-phone bg-surface rounded-2xl shadow-xl overflow-y-auto max-h-[75vh] animate-slide-up">
            {ratingSubmitted ? (
              <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-success-tint flex items-center justify-center">
                  <Check size={28} className="text-success" />
                </div>
                <p className="text-[15px] font-semibold text-content">Cảm ơn đánh giá của bạn!</p>
                <p className="text-[13px] text-faint">Phản hồi giúp cải thiện chất lượng khóa học</p>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="text-center">
                  <p className="text-[15px] font-semibold text-content">Bạn thấy khóa học thế nào?</p>
                  <p className="text-[12px] text-faint mt-1">{lesson.courseTitle}</p>
                </div>

                {/* 5 sao */}
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRatingValue(star)}
                      className={`text-3xl transition-transform active:scale-125 ${
                        star <= ratingValue ? 'text-yellow-400' : 'text-gray-200'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {ratingValue > 0 && (
                  <p className="text-center text-[12px] text-faint">
                    {['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Xuất sắc'][ratingValue]}
                  </p>
                )}

                {/* Comment */}
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Nhận xét thêm (tùy chọn)..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-[13px] text-content placeholder:text-faint
                             bg-muted rounded-xl focus:outline-none resize-none leading-relaxed"
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRating(false)}
                    className="flex-1 py-2.5 text-[13px] text-faint border border-[rgba(0,0,0,0.08)] rounded-xl"
                  >
                    Bỏ qua
                  </button>
                  <button
                    onClick={handleSubmitRating}
                    disabled={submittingRating || ratingValue === 0}
                    className="flex-1 py-2.5 text-[13px] font-medium text-white bg-primary rounded-xl
                               disabled:opacity-50 active:scale-[0.98] transition-transform"
                  >
                    {submittingRating ? 'Đang gửi...' : 'Gửi đánh giá'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

// ─── PDF Embed (iframe with signed URL) ──────────────────────────────────────
function PdfEmbed({ assetId, accessToken }: { assetId: string; accessToken: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/assets/${assetId}/view-url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setUrl(json.data.viewUrl)
        else setError(true)
      })
      .catch(() => setError(true))
  }, [assetId, accessToken])

  if (error) return <NoContentPlaceholder label="Không tải được tài liệu" />
  if (!url) return (
    <div className="h-64 flex items-center justify-center bg-muted">
      <span className="text-faint text-[13px]">Đang tải tài liệu...</span>
    </div>
  )

  return (
    <iframe
      src={url}
      className="w-full h-[70vh] border-0"
      title="PDF viewer"
    />
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TabBtn({
  children, active, onClick,
}: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-[13px] font-medium relative transition-colors
                  ${active ? 'text-primary' : 'text-faint'}`}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
      )}
    </button>
  )
}

function ContentTypeBadge({ type }: { type: string }) {
  if (type === 'video') return (
    <span className="flex items-center gap-1 text-[10px] text-primary bg-primary-tint rounded-full px-2 py-0.5">
      <BookOpen size={10} /> Video
    </span>
  )
  if (type === 'pdf') return (
    <span className="flex items-center gap-1 text-[10px] text-danger bg-danger-tint rounded-full px-2 py-0.5">
      <FileText size={10} /> PDF
    </span>
  )
  if (type === 'quiz') return (
    <span className="flex items-center gap-1 text-[10px] text-success bg-success-tint rounded-full px-2 py-0.5">
      <ClipboardCheck size={10} /> Quiz
    </span>
  )
  return (
    <span className="text-[10px] text-faint bg-muted rounded-full px-2 py-0.5">Bài đọc</span>
  )
}

function NoContentPlaceholder({ label }: { label: string }) {
  return (
    <div className="aspect-video flex items-center justify-center bg-muted">
      <p className="text-faint text-[13px]">{label}</p>
    </div>
  )
}

function LessonSkeleton() {
  return (
    <div className="max-w-phone mx-auto min-h-screen bg-muted pb-16">
      <div className="bg-black h-12 flex items-center px-3 gap-2">
        <div className="w-8 h-8 rounded-full bg-white/10" />
        <div className="bg-white/10 rounded h-3 w-40" />
      </div>
      <div className="bg-black aspect-video w-full animate-pulse" />
      <div className="bg-surface flex border-b border-[rgba(0,0,0,0.06)]">
        {[1, 2].map((i) => (
          <div key={i} className="flex-1 py-3 flex justify-center">
            <div className="animate-pulse bg-muted rounded h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="px-4 py-4 space-y-3">
        <div className="bg-surface rounded-xl shadow-card p-4 space-y-2">
          <div className="animate-pulse bg-muted rounded h-4 w-3/4" />
          <div className="animate-pulse bg-muted rounded h-3 w-1/3" />
        </div>
        <div className="animate-pulse bg-muted rounded-xl h-12 w-full" />
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Trophy, AlertCircle, ChevronRight, ChevronLeft, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import QuizOption, { type OptionState } from '@/components/pwa/quiz-option'

// ─── Types ────────────────────────────────────────────────────────────────────
interface QuizQuestion {
  id: string
  type: string
  difficulty: string
  questionText: string
  options: { key: string; text: string }[]
  scorePoints: number
}

interface QuizSession {
  attemptId: string
  lessonId: string
  questions: QuizQuestion[]
  totalQuestions: number
  timeLimitMins: number
  maxScore: number
  startedAt: string
  expiresAt: string
}

interface GradedAnswer {
  submitted: string
  correct: string
  isCorrect: boolean
  points: number
}

interface QuizResult {
  attemptId: string
  score: number
  maxScore: number
  scorePct: number
  isPassed: boolean
  passingScore: number
  gradedAnswers: Record<string, GradedAnswer>
}

type PageState = 'loading' | 'intro' | 'quiz' | 'submitting' | 'result' | 'error'

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function QuizPage() {
  const { courseId, quizId } = useParams<{ courseId: string; quizId: string }>()
  const { accessToken, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null)
  const [quizTitle, setQuizTitle]       = useState('')
  const [session, setSession]           = useState<QuizSession | null>(null)
  const [answers, setAnswers]           = useState<Record<string, string>>({})
  const [currentIdx, setCurrentIdx]     = useState(0)
  const [result, setResult]             = useState<QuizResult | null>(null)
  const [secondsLeft, setSecondsLeft]   = useState(0)
  const [errorMsg, setErrorMsg]         = useState('')
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoSubmitted = useRef(false)

  // ── Auth guard ────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !accessToken) router.replace('/login')
  }, [authLoading, accessToken, router])

  // ── Load enrollment info from course ─────────────────────────
  useEffect(() => {
    if (!accessToken || !courseId || !quizId) return
    ;(async () => {
      try {
        const res = await fetch(`/api/my/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = await res.json()
        if (!json.success) { setErrorMsg(json.error ?? 'Không tải được bài kiểm tra'); setPageState('error'); return }

        const course = json.data
        if (!course.enrollmentId) {
          setErrorMsg('Bạn chưa đăng ký khóa học này')
          setPageState('error')
          return
        }
        setEnrollmentId(course.enrollmentId)

        // Find quiz lesson title
        const allLessons = (course.sections ?? []).flatMap((s: { lessons: { id: string; title: string }[] }) => s.lessons)
        const quizLesson = allLessons.find((l: { id: string; title: string }) => l.id === quizId)
        setQuizTitle(quizLesson?.title ?? 'Bài kiểm tra')
        setPageState('intro')
      } catch {
        setErrorMsg('Lỗi kết nối, vui lòng thử lại')
        setPageState('error')
      }
    })()
  }, [accessToken, courseId, quizId]) // eslint-disable-line

  // ── Start quiz ────────────────────────────────────────────────
  const handleStart = async () => {
    if (!accessToken || !enrollmentId) return
    setPageState('loading')
    try {
      const res = await fetch(
        `/api/quizzes/${quizId}/start?enrollmentId=${enrollmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      const json = await res.json()
      if (!json.success) {
        toast('error', json.error ?? 'Không thể bắt đầu bài kiểm tra')
        setPageState('intro')
        return
      }
      const s: QuizSession = json.data
      setSession(s)
      setAnswers({})
      setCurrentIdx(0)
      autoSubmitted.current = false

      // Start timer
      const expires = new Date(s.expiresAt).getTime()
      const remaining = Math.max(0, Math.floor((expires - Date.now()) / 1000))
      setSecondsLeft(remaining)
      setPageState('quiz')
    } catch {
      toast('error', 'Lỗi kết nối, vui lòng thử lại')
      setPageState('intro')
    }
  }

  // ── Submit quiz ───────────────────────────────────────────────
  const handleSubmit = useCallback(async (currentAnswers?: Record<string, string>) => {
    if (!accessToken || !session || autoSubmitted.current) return
    autoSubmitted.current = true
    if (timerRef.current) clearInterval(timerRef.current)

    setPageState('submitting')
    try {
      const res = await fetch(`/api/quizzes/${session.attemptId}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers: currentAnswers ?? answers }),
      })
      const json = await res.json()
      if (!json.success) {
        toast('error', json.error ?? 'Nộp bài thất bại')
        setPageState('quiz')
        autoSubmitted.current = false
        return
      }
      setResult(json.data)
      setPageState('result')
    } catch {
      toast('error', 'Lỗi kết nối khi nộp bài')
      setPageState('quiz')
      autoSubmitted.current = false
    }
  }, [accessToken, session, answers, toast])

  // ── Countdown timer ───────────────────────────────────────────
  useEffect(() => {
    if (pageState !== 'quiz') return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          if (!autoSubmitted.current) {
            toast('warning', 'Hết giờ! Bài kiểm tra đã được tự động nộp.')
            handleSubmit(answers)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [pageState, handleSubmit]) // eslint-disable-line

  // ── Answer selection ──────────────────────────────────────────
  const selectAnswer = (questionId: string, key: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: key }))
  }

  // ─── Render ───────────────────────────────────────────────────
  const renderHeader = (title: string, showBack = true) => (
    <header className="sticky top-0 z-40 bg-surface border-b border-[rgba(0,0,0,0.06)]
                       h-14 flex items-center px-4 gap-3">
      {showBack && (
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full
                     active:bg-muted transition-colors shrink-0"
        >
          <ArrowLeft size={22} className="text-subtle" />
        </button>
      )}
      <h1 className="text-17 font-medium text-content flex-1 truncate">{title}</h1>
      {pageState === 'quiz' && (
        <TimerBadge seconds={secondsLeft} />
      )}
    </header>
  )

  // Loading
  if (pageState === 'loading') return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16">
      {renderHeader(quizTitle || 'Bài kiểm tra')}
      <div className="flex items-center justify-center h-64">
        <div className="text-faint text-[13px]">Đang tải...</div>
      </div>
    </main>
  )

  // Error
  if (pageState === 'error') return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16">
      {renderHeader('Bài kiểm tra')}
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 px-4 text-center">
        <AlertCircle size={36} className="text-danger" />
        <p className="text-content text-[15px] font-medium">{errorMsg}</p>
        <button
          onClick={() => router.back()}
          className="bg-primary text-white text-[13px] font-medium rounded-lg px-4 py-2.5 mt-2"
        >
          Quay lại
        </button>
      </div>
    </main>
  )

  // Intro
  if (pageState === 'intro' && session === null) return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">
      {renderHeader(quizTitle)}
      <div className="px-4 py-6 space-y-4">
        <div className="bg-surface rounded-xl shadow-card p-6 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-primary-tint flex items-center
                          justify-center mx-auto">
            <span className="text-2xl">📝</span>
          </div>
          <h2 className="text-17 font-medium text-content">{quizTitle}</h2>
          <p className="text-[13px] text-faint">Làm bài kiểm tra để hoàn thành bài học</p>
        </div>

        <div className="bg-warning-tint border border-warning/20 rounded-xl p-4 flex gap-3">
          <AlertCircle size={16} className="text-warning shrink-0 mt-0.5" />
          <p className="text-[13px] text-warning leading-relaxed">
            Sau khi bắt đầu, bộ đếm thời gian sẽ chạy liên tục. Bài sẽ tự động nộp khi hết giờ.
          </p>
        </div>

        <button
          onClick={handleStart}
          className="w-full bg-primary text-white text-[13px] font-medium rounded-lg py-3
                     active:scale-[0.98] transition-transform"
        >
          Bắt đầu làm bài
        </button>

        <Link
          href={`/app/courses/${courseId}`}
          className="block text-center text-[13px] text-subtle py-1"
        >
          Quay lại khóa học
        </Link>
      </div>
    </main>
  )

  // Submitting
  if (pageState === 'submitting') return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16">
      {renderHeader(quizTitle, false)}
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent
                        animate-spin" />
        <p className="text-faint text-[13px]">Đang nộp bài...</p>
      </div>
    </main>
  )

  // Quiz engine
  if ((pageState === 'quiz' || pageState === 'intro') && session) {
    const q = session.questions[currentIdx]
    const isFirst = currentIdx === 0
    const isLast = currentIdx === session.totalQuestions - 1
    const answeredCount = Object.keys(answers).length
    const allAnswered = answeredCount === session.totalQuestions

    return (
      <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">
        {/* Header with timer */}
        <header className="sticky top-0 z-40 bg-surface border-b border-[rgba(0,0,0,0.06)]
                           h-14 flex items-center px-4 gap-3">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full
                       active:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft size={22} className="text-subtle" />
          </button>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-content truncate">{quizTitle}</p>
            <p className="text-[10px] text-faint">
              {answeredCount}/{session.totalQuestions} câu đã trả lời
            </p>
          </div>
          <TimerBadge seconds={secondsLeft} />
        </header>

        {/* Progress steps */}
        <div className="bg-surface px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
            {session.questions.map((sq, i) => (
              <button
                key={sq.id}
                onClick={() => setCurrentIdx(i)}
                className={`shrink-0 w-7 h-7 rounded-lg text-[11px] font-medium
                            transition-colors active:scale-95
                            ${i === currentIdx
                              ? 'bg-primary text-white'
                              : answers[sq.id]
                              ? 'bg-primary-tint text-primary border border-primary'
                              : 'bg-muted text-faint border border-[rgba(0,0,0,0.08)]'
                            }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Question */}
        <div className="px-4 py-4 space-y-4">
          <div className="bg-surface rounded-xl shadow-card p-4 space-y-3">
            {/* Question meta */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-faint bg-muted rounded-full px-2 py-0.5">
                Câu {currentIdx + 1}/{session.totalQuestions}
              </span>
              <DifficultyBadge level={q.difficulty} />
              <span className="text-[10px] text-faint ml-auto">{q.scorePoints} điểm</span>
            </div>

            {/* Question text */}
            <p className="text-[15px] font-medium text-content leading-snug">
              {q.questionText}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {q.options.map((opt) => {
              const isSelected = answers[q.id] === opt.key
              const state: OptionState = isSelected ? 'selected' : 'default'
              return (
                <QuizOption
                  key={opt.key}
                  label={opt.key}
                  text={opt.text}
                  state={state}
                  onClick={() => selectAnswer(q.id, opt.key)}
                />
              )
            })}
          </div>

          {/* Navigation */}
          <div className="flex gap-2 pt-2">
            {!isFirst && (
              <button
                onClick={() => setCurrentIdx((i) => i - 1)}
                className="flex items-center gap-1 border border-[rgba(0,0,0,0.08)] text-subtle
                           text-[13px] font-medium rounded-lg px-4 py-2.5
                           active:scale-[0.98] transition-transform"
              >
                <ChevronLeft size={16} />
                Trước
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => setCurrentIdx((i) => i + 1)}
                className="flex-1 flex items-center justify-center gap-1 bg-primary text-white
                           text-[13px] font-medium rounded-lg px-4 py-2.5
                           active:scale-[0.98] transition-transform"
              >
                Tiếp theo
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => handleSubmit()}
                disabled={!allAnswered}
                className="flex-1 bg-primary text-white text-[13px] font-medium rounded-lg py-2.5
                           active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {allAnswered
                  ? 'Nộp bài'
                  : `Còn ${session.totalQuestions - answeredCount} câu chưa trả lời`}
              </button>
            )}
          </div>

          {/* Submit early if all answered */}
          {allAnswered && !isLast && (
            <button
              onClick={() => handleSubmit()}
              className="w-full border border-primary text-primary text-[13px] font-medium
                         rounded-lg py-2.5 active:scale-[0.98] transition-transform"
            >
              Nộp bài ngay
            </button>
          )}
        </div>

        {/* Exit confirm modal */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4
                          bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-xl w-full max-w-phone p-5 space-y-4 animate-slide-up">
              <p className="text-[15px] font-medium text-content text-center">
                Thoát bài kiểm tra?
              </p>
              <p className="text-[13px] text-faint text-center">
                Bài chưa được nộp sẽ không được lưu. Bạn có chắc muốn thoát không?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 border border-[rgba(0,0,0,0.08)] text-subtle text-[13px]
                             font-medium rounded-lg py-2.5 active:scale-[0.98] transition-transform"
                >
                  Tiếp tục làm
                </button>
                <button
                  onClick={() => {
                    setShowExitConfirm(false)
                    if (timerRef.current) clearInterval(timerRef.current)
                    router.back()
                  }}
                  className="flex-1 bg-danger text-white text-[13px] font-medium
                             rounded-lg py-2.5 active:scale-[0.98] transition-transform"
                >
                  Thoát
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    )
  }

  // Result screen
  if (pageState === 'result' && result && session) {
    return (
      <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">
        {renderHeader('Kết quả', false)}

        <div className="px-4 py-4 space-y-4">
          {/* Score hero */}
          <div className={`rounded-xl p-6 text-center space-y-2
                          ${result.isPassed
                            ? 'bg-success-tint border border-success/20'
                            : 'bg-danger-tint border border-danger/20'}`}>
            <Trophy
              size={36}
              className={result.isPassed ? 'text-warning mx-auto' : 'text-faint mx-auto'}
            />
            <div className={`text-36 font-medium
                            ${result.isPassed ? 'text-success' : 'text-danger'}`}>
              {result.scorePct}%
            </div>
            <p className={`text-[13px] font-medium
                          ${result.isPassed ? 'text-success' : 'text-danger'}`}>
              {result.isPassed ? 'Chúc mừng! Bạn đã qua bài kiểm tra' : 'Chưa đạt. Hãy thử lại!'}
            </p>
            <p className="text-[10px] text-faint">
              Điểm: {result.score}/{result.maxScore} • Điểm đạt: {result.passingScore}%
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                value: Object.values(result.gradedAnswers).filter((a) => a.isCorrect).length,
                label: 'Đúng',
                color: 'text-success',
              },
              {
                value: Object.values(result.gradedAnswers).filter((a) => !a.isCorrect).length,
                label: 'Sai',
                color: 'text-danger',
              },
              {
                value: session.totalQuestions,
                label: 'Tổng câu',
                color: 'text-content',
              },
            ].map(({ value, label, color }) => (
              <div key={label} className="bg-surface rounded-xl shadow-card p-3 text-center">
                <p className={`text-17 font-medium ${color}`}>{value}</p>
                <p className="text-[10px] text-faint mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Review answers */}
          <div>
            <p className="text-[13px] font-medium text-subtle mb-2">Xem lại đáp án</p>
            <div className="space-y-4">
              {session.questions.map((q, i) => {
                const graded = result.gradedAnswers[q.id]
                return (
                  <div key={q.id} className="bg-surface rounded-xl shadow-card p-4 space-y-3">
                    {/* Question */}
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 text-[10px] font-medium rounded-full px-2 py-0.5
                                        ${graded?.isCorrect
                                          ? 'bg-success-tint text-success'
                                          : 'bg-danger-tint text-danger'}`}>
                        Câu {i + 1}
                      </span>
                    </div>
                    <p className="text-[13px] font-medium text-content leading-snug">
                      {q.questionText}
                    </p>
                    {/* Options with correct/wrong display */}
                    <div className="space-y-2">
                      {q.options.map((opt) => {
                        const isSubmitted = graded?.submitted === opt.key
                        const isCorrect = graded?.correct === opt.key
                        let state: OptionState = 'default'
                        if (isCorrect && isSubmitted) state = 'correct'
                        else if (isCorrect && !isSubmitted) state = 'correct-unselected'
                        else if (isSubmitted && !isCorrect) state = 'wrong'
                        return (
                          <QuizOption
                            key={opt.key}
                            label={opt.key}
                            text={opt.text}
                            state={state}
                            disabled
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {!result.isPassed && (
              <button
                onClick={() => {
                  setSession(null)
                  setResult(null)
                  setAnswers({})
                  setCurrentIdx(0)
                  autoSubmitted.current = false
                  handleStart()
                }}
                className="w-full flex items-center justify-center gap-2 border border-primary
                           text-primary text-[13px] font-medium rounded-lg py-2.5
                           active:scale-[0.98] transition-transform"
              >
                <RotateCcw size={15} />
                Làm lại bài kiểm tra
              </button>
            )}
            <Link
              href={`/app/courses/${courseId}`}
              className="block w-full bg-primary text-white text-[13px] font-medium text-center
                         rounded-lg py-2.5 active:scale-[0.98] transition-transform"
            >
              Về khóa học
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return null
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TimerBadge({ seconds }: { seconds: number }) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const isUrgent = seconds <= 60
  return (
    <div className={`flex items-center gap-1 rounded-full px-2.5 py-1
                     ${isUrgent ? 'bg-danger-tint text-danger' : 'bg-primary-tint text-primary'}`}>
      <Clock size={12} />
      <span className="text-[11px] font-medium tabular-nums">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  )
}

function DifficultyBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    easy:   { label: 'Dễ',   cls: 'bg-success-tint text-success' },
    medium: { label: 'Vừa',  cls: 'bg-warning-tint text-warning' },
    hard:   { label: 'Khó',  cls: 'bg-danger-tint text-danger' },
  }
  const d = map[level] ?? { label: level, cls: 'bg-muted text-faint' }
  return (
    <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${d.cls}`}>
      {d.label}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[13px] text-subtle">{label}</span>
      <span className="text-[13px] font-medium text-content">{value}</span>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, BookOpen, AlertCircle, FileText, ClipboardCheck } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import ProgressBar from '@/components/pwa/progress-bar'
import LessonItem, { type LessonStatus, type LessonContentType } from '@/components/pwa/lesson-item'
import { CourseDetailSkeleton } from '@/components/pwa/skeleton/lesson-skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LessonData {
  id: string
  title: string
  contentType: LessonContentType
  order: number
  isRequired: boolean
  estimatedMinutes: number | null
  durationSeconds: number | null
  assetId: string | null
  quizId: string | null
  progress: { completedAt: string | null; progressPct: number; status: string } | null
}

interface SectionData {
  id: string
  title: string
  order: number
  lessons: LessonData[]
}

interface CourseDetail {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  estimatedHours: number | null
  progressPercent: number | null
  completedAt: string | null
  enrollmentId: string | null
  deadline: string | null
  isMandatory: boolean
  completionMode: string
  sections: SectionData[]
}

type Tab = 'content' | 'materials' | 'quizzes'

// ─── Page ────────────────────────────────────────────────────────────────────
export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { accessToken, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('content')

  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.replace('/app/login')
      return
    }
    if (!accessToken) return
    ;(async () => {
      try {
        const res = await fetch(`/api/my/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = await res.json()
        if (json.success) {
          setCourse(json.data)
        } else {
          toast('error', json.error ?? 'Không tải được khóa học')
        }
      } catch {
        toast('error', 'Lỗi kết nối, vui lòng thử lại')
      } finally {
        setLoading(false)
      }
    })()
  }, [accessToken, authLoading, courseId, router, toast])

  // ─── Enroll ───────────────────────────────────────────────
  async function handleEnroll() {
    if (!accessToken || enrolling) return
    setEnrolling(true)
    try {
      const res = await fetch(`/api/my/courses/${courseId}/enroll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const json = await res.json()
      if (json.success) {
        toast('success', 'Đã đăng ký khóa học')
        // Refetch to get enrollment state
        const r2 = await fetch(`/api/my/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const j2 = await r2.json()
        if (j2.success) setCourse(j2.data)
      } else {
        toast('error', json.error ?? 'Không thể đăng ký')
      }
    } catch {
      toast('error', 'Lỗi kết nối, vui lòng thử lại')
    } finally {
      setEnrolling(false)
    }
  }

  if (loading) return <CourseDetailSkeleton />
  if (!course) return null

  // ─── Lesson status resolution ──────────────────────────────
  const allLessons = course.sections.flatMap((s) => s.lessons)
  const isEnrolled = !!course.enrollmentId
  const isSequential = course.completionMode === 'sequential'

  function getLessonStatus(lesson: LessonData, globalIndex: number): LessonStatus {
    if (!isEnrolled) return 'locked'
    if (lesson.progress?.completedAt || lesson.progress?.status === 'completed') return 'done'
    if (isSequential && globalIndex > 0) {
      const prev = allLessons[globalIndex - 1]
      const prevDone = !!(prev?.progress?.completedAt || prev?.progress?.status === 'completed')
      if (!prevDone) return 'locked'
    }
    return 'active'
  }

  // ─── Tab content derivation ────────────────────────────────
  const pdfLessons = allLessons.filter((l) => l.contentType === 'pdf')
  const quizLessons = allLessons.filter((l) => l.contentType === 'quiz')

  const progress = course.progressPercent ?? 0
  const totalLessons = allLessons.length
  const doneLessons = allLessons.filter(
    (l) => l.progress?.completedAt || l.progress?.status === 'completed',
  ).length

  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">

      {/* ── Hero ── */}
      <div className="relative">
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-44 object-cover"
          />
        ) : (
          <div className="w-full h-44 bg-primary-gradient" />
        )}

        {/* Back button overlay */}
        <button
          onClick={() => router.back()}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm
                     flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Quay lại"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>

        {/* Mandatory badge */}
        {course.isMandatory && (
          <div className="absolute top-3 right-3">
            <span className="bg-danger text-white text-[10px] font-medium
                             rounded-full px-2.5 py-1 flex items-center gap-1">
              <AlertCircle size={10} />
              Bắt buộc
            </span>
          </div>
        )}
      </div>

      {/* ── Course info block ── */}
      <div className="bg-surface px-4 pt-4 pb-3 border-b border-[rgba(0,0,0,0.06)]">
        <h1 className="text-17 font-medium text-content leading-snug">{course.title}</h1>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {course.estimatedHours && (
            <span className="flex items-center gap-1 text-[13px] text-faint">
              <Clock size={13} />
              {course.estimatedHours}h
            </span>
          )}
          <span className="flex items-center gap-1 text-[13px] text-faint">
            <BookOpen size={13} />
            {totalLessons} bài học
          </span>
          {course.deadline && !course.completedAt && (
            <span className="text-[13px] text-warning">
              Hạn: {new Date(course.deadline).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>

        {/* Progress */}
        {isEnrolled && (
          <div className="mt-3 space-y-1">
            <ProgressBar value={progress} thick />
            <div className="flex justify-between">
              <span className="text-[10px] text-faint">{doneLessons}/{totalLessons} bài</span>
              <span className="text-[10px] text-faint">{Math.round(progress)}%</span>
            </div>
          </div>
        )}

        {/* Enroll CTA */}
        {!isEnrolled && (
          <button
            onClick={handleEnroll}
            disabled={enrolling}
            className="w-full mt-3 bg-primary text-white text-[13px] font-medium
                       rounded-lg py-2.5 active:scale-[0.98] transition-transform
                       disabled:opacity-60"
          >
            {enrolling ? 'Đang đăng ký...' : 'Bắt đầu học'}
          </button>
        )}

        {/* Completed badge */}
        {course.completedAt && (
          <div className="mt-3 bg-success-tint text-success text-[13px] font-medium
                          rounded-lg py-2 text-center">
            Đã hoàn thành khóa học
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="bg-surface flex border-b border-[rgba(0,0,0,0.06)] sticky top-0 z-30">
        <TabButton active={activeTab === 'content'} onClick={() => setActiveTab('content')}>
          Nội dung
        </TabButton>
        <TabButton active={activeTab === 'materials'} onClick={() => setActiveTab('materials')}>
          <span className="flex items-center gap-1">
            <FileText size={13} />
            Tài liệu
            {pdfLessons.length > 0 && (
              <span className="text-[10px] bg-primary-tint text-primary rounded-full px-1">
                {pdfLessons.length}
              </span>
            )}
          </span>
        </TabButton>
        <TabButton active={activeTab === 'quizzes'} onClick={() => setActiveTab('quizzes')}>
          <span className="flex items-center gap-1">
            <ClipboardCheck size={13} />
            Kiểm tra
            {quizLessons.length > 0 && (
              <span className="text-[10px] bg-primary-tint text-primary rounded-full px-1">
                {quizLessons.length}
              </span>
            )}
          </span>
        </TabButton>
      </div>

      {/* ── Tab content ── */}
      <div className="mt-2">

        {/* Content tab */}
        {activeTab === 'content' && (
          course.sections.length === 0 ? (
            <EmptyTab text="Khóa học chưa có nội dung" />
          ) : (
            <div className="space-y-2">
              {course.sections.map((section) => {
                const sectionStartIndex = allLessons.findIndex(
                  (l) => l.id === section.lessons[0]?.id,
                )
                return (
                  <div key={section.id} className="bg-surface shadow-card rounded-xl overflow-hidden">
                    {/* Section header */}
                    <div className="px-4 py-2.5 border-b border-[rgba(0,0,0,0.06)] bg-muted">
                      <p className="text-[13px] font-medium text-subtle">{section.title}</p>
                    </div>
                    {/* Lessons */}
                    <div className="divide-y divide-[rgba(0,0,0,0.05)]">
                      {section.lessons.map((lesson, idx) => {
                        const globalIndex = sectionStartIndex + idx
                        return (
                          <LessonItem
                            key={lesson.id}
                            lesson={lesson}
                            courseId={courseId}
                            status={getLessonStatus(lesson, globalIndex)}
                            index={globalIndex + 1}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* Materials tab */}
        {activeTab === 'materials' && (
          pdfLessons.length === 0 ? (
            <EmptyTab text="Không có tài liệu đính kèm" />
          ) : (
            <div className="bg-surface rounded-xl shadow-card overflow-hidden divide-y divide-[rgba(0,0,0,0.05)]">
              {pdfLessons.map((lesson, idx) => {
                const globalIndex = allLessons.findIndex((l) => l.id === lesson.id)
                return (
                  <LessonItem
                    key={lesson.id}
                    lesson={lesson}
                    courseId={courseId}
                    status={getLessonStatus(lesson, globalIndex)}
                    index={idx + 1}
                  />
                )
              })}
            </div>
          )
        )}

        {/* Quizzes tab */}
        {activeTab === 'quizzes' && (
          quizLessons.length === 0 ? (
            <EmptyTab text="Không có bài kiểm tra" />
          ) : (
            <div className="bg-surface rounded-xl shadow-card overflow-hidden divide-y divide-[rgba(0,0,0,0.05)]">
              {quizLessons.map((lesson, idx) => {
                const globalIndex = allLessons.findIndex((l) => l.id === lesson.id)
                return (
                  <LessonItem
                    key={lesson.id}
                    lesson={lesson}
                    courseId={courseId}
                    status={getLessonStatus(lesson, globalIndex)}
                    index={idx + 1}
                  />
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Description section */}
      {course.description && activeTab === 'content' && (
        <div className="bg-surface rounded-xl shadow-card p-4 mt-2">
          <p className="text-[13px] font-medium text-subtle mb-1.5">Mô tả</p>
          <p className="text-[13px] text-content leading-relaxed">{course.description}</p>
        </div>
      )}
    </main>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-[13px] font-medium text-center relative
                  transition-colors
                  ${active ? 'text-primary' : 'text-faint'}`}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
      )}
    </button>
  )
}

function EmptyTab({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      <p className="text-faint text-[13px]">{text}</p>
    </div>
  )
}

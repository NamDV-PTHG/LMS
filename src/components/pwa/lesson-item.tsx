import Link from 'next/link'
import { Check, Video, FileText, ClipboardCheck, Clock } from 'lucide-react'

export type LessonStatus = 'done' | 'active' | 'locked'
export type LessonContentType = 'video' | 'pdf' | 'quiz' | 'text' | string

interface LessonItemProps {
  lesson: {
    id: string
    title: string
    contentType: LessonContentType
    order: number
    estimatedMinutes: number | null
    durationSeconds: number | null
    quizId: string | null
    assetId: string | null
  }
  courseId: string
  status: LessonStatus
  index: number // 1-based display number
}

export default function LessonItem({ lesson, courseId, status, index }: LessonItemProps) {
  const href = buildHref(lesson, courseId)
  const isLocked = status === 'locked'

  const content = (
    <div className={`flex items-center gap-3 py-3 px-4
                     ${!isLocked ? 'active:bg-muted transition-colors' : ''}`}>
      {/* Status indicator */}
      <StatusDot status={status} index={index} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-snug line-clamp-2
                       ${status === 'locked' ? 'text-faint' : 'text-content'}`}>
          {lesson.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <TypeIcon type={lesson.contentType} locked={isLocked} />
          {duration(lesson) && (
            <span className="flex items-center gap-0.5 text-[10px] text-faint">
              <Clock size={9} />
              {duration(lesson)}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  if (isLocked || !href) {
    return <div className="cursor-not-allowed">{content}</div>
  }

  return <Link href={href}>{content}</Link>
}

// ─── Status dot ───────────────────────────────────────────────────────────────
function StatusDot({ status, index }: { status: LessonStatus; index: number }) {
  if (status === 'done') {
    return (
      <div className="w-7 h-7 rounded-full bg-primary text-white
                      flex items-center justify-center shrink-0">
        <Check size={12} strokeWidth={2.5} />
      </div>
    )
  }
  if (status === 'active') {
    return (
      <div className="w-7 h-7 rounded-full bg-primary-tint border border-primary text-primary
                      flex items-center justify-center text-[11px] font-medium shrink-0">
        {index}
      </div>
    )
  }
  // locked
  return (
    <div className="w-7 h-7 rounded-full border border-[rgba(0,0,0,0.08)] text-faint
                    flex items-center justify-center text-[11px] shrink-0">
      {index}
    </div>
  )
}

// ─── Type icon ────────────────────────────────────────────────────────────────
function TypeIcon({ type, locked }: { type: LessonContentType; locked: boolean }) {
  const cls = locked ? 'text-faint' : ''
  if (type === 'video') return <Video size={11} className={cls || 'text-primary'} />
  if (type === 'pdf') return <FileText size={11} className={cls || 'text-danger'} />
  if (type === 'quiz') return <ClipboardCheck size={11} className={cls || 'text-success'} />
  return null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildHref(
  lesson: LessonItemProps['lesson'],
  courseId: string,
): string | null {
  if (lesson.contentType === 'quiz' && lesson.quizId) {
    return `/app/courses/${courseId}/quiz/${lesson.quizId}`
  }
  if (lesson.contentType === 'video' || lesson.contentType === 'pdf') {
    return `/app/courses/${courseId}/lessons/${lesson.id}`
  }
  return `/app/courses/${courseId}/lessons/${lesson.id}`
}

function duration(lesson: LessonItemProps['lesson']): string | null {
  if (lesson.durationSeconds) {
    const m = Math.floor(lesson.durationSeconds / 60)
    if (m <= 0) return null
    return `${m} phút`
  }
  if (lesson.estimatedMinutes) return `${lesson.estimatedMinutes} phút`
  return null
}

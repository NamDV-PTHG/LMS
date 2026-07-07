import Link from 'next/link'
import { BookOpen, Clock, AlertCircle } from 'lucide-react'
import ProgressBar from './progress-bar'

export interface CourseCardData {
  id: string
  title: string
  thumbnailUrl: string | null
  progressPercent: number | null
  estimatedHours: number | null
  deadline: string | Date | null
  isMandatory: boolean
  completedAt: string | Date | null
}

// ─── Continue Card (lớn — dành cho "Tiếp tục học") ───────────────────────────
export function ContinueCard({ course }: { course: CourseCardData }) {
  const progress = course.progressPercent ?? 0

  return (
    <Link href={`/app/courses/${course.id}`} className="block">
      <div className="bg-surface rounded-xl shadow-card overflow-hidden
                      active:scale-[0.99] transition-transform duration-100">
        {/* Thumbnail / Hero gradient */}
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-32 object-cover"
          />
        ) : (
          <div className="w-full h-32 bg-gradient-to-br from-primary-dark via-primary to-primary-light
                          flex items-center justify-center">
            <BookOpen size={36} className="text-white/60" />
          </div>
        )}

        <div className="p-3 space-y-2">
          {/* Badges */}
          <div className="flex items-center gap-1.5">
            {course.isMandatory && (
              <span className="bg-danger-tint text-danger text-[10px] font-medium
                               rounded-full px-2 py-0.5 flex items-center gap-1">
                <AlertCircle size={10} />
                Bắt buộc
              </span>
            )}
            {course.deadline && !course.completedAt && (
              <span className="bg-warning-tint text-warning text-[10px] font-medium
                               rounded-full px-2 py-0.5">
                Hạn: {formatDeadline(course.deadline)}
              </span>
            )}
          </div>

          <h3 className="text-[13px] font-medium text-content line-clamp-2 leading-snug">
            {course.title}
          </h3>

          {/* Progress */}
          <div className="space-y-1">
            <ProgressBar value={progress} thick />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-faint">{Math.round(progress)}% hoàn thành</span>
              {course.estimatedHours && (
                <span className="text-[10px] text-faint flex items-center gap-0.5">
                  <Clock size={10} />
                  {course.estimatedHours}h
                </span>
              )}
            </div>
          </div>

          <div className="bg-primary text-white text-[13px] font-medium text-center
                          rounded-lg py-2 mt-1 active:scale-[0.98] transition-transform">
            Tiếp tục học
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── List Item (compact — dành cho danh sách) ────────────────────────────────
export function CourseListItem({ course }: { course: CourseCardData }) {
  const progress = course.progressPercent ?? 0
  const isCompleted = !!course.completedAt

  return (
    <Link href={`/app/courses/${course.id}`} className="block">
      <div className="bg-surface rounded-xl shadow-card p-3 flex gap-3 items-center
                      active:scale-[0.99] transition-transform duration-100">
        {/* Thumbnail */}
        <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-primary-tint
                        flex items-center justify-center">
          {course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <BookOpen size={20} className="text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <h3 className="text-[13px] font-medium text-content line-clamp-2 leading-snug">
            {course.title}
          </h3>
          <ProgressBar value={progress} />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-faint">{Math.round(progress)}%</span>
            {isCompleted ? (
              <span className="bg-success-tint text-success text-[10px] font-medium
                               rounded-full px-2 py-0.5">
                Hoàn thành
              </span>
            ) : course.isMandatory ? (
              <span className="bg-danger-tint text-danger text-[10px] font-medium
                               rounded-full px-2 py-0.5">
                Bắt buộc
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDeadline(deadline: string | Date): string {
  const d = new Date(deadline)
  const now = new Date()
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'Đã qua hạn'
  if (diffDays === 0) return 'Hôm nay'
  if (diffDays === 1) return 'Ngày mai'
  if (diffDays <= 7) return `${diffDays} ngày`
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

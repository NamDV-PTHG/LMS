'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp, Trophy, BookOpen, Clock, Flame,
  CheckCircle, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import ProgressBar from '@/components/pwa/progress-bar'
import { CourseListItemSkeleton } from '@/components/pwa/skeleton/course-skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────
interface CourseRow {
  id: string
  title: string
  thumbnailUrl: string | null
  progressPercent: number | null
  completedAt: string | Date | null
  estimatedHours: number | null
  isMandatory: boolean
  deadline: string | Date | null
  source: 'group_publish' | 'learning_group' | 'company_assign' | 'learning_path'
  ownerCompanyName: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const { accessToken, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandCompleted, setExpandCompleted] = useState(false)

  useEffect(() => {
    if (!authLoading && !accessToken) { router.replace('/login'); return }
    if (!accessToken) return
    ;(async () => {
      try {
        const res = await fetch('/api/my/courses', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = await res.json()
        if (json.success) setCourses(json.data ?? [])
      } finally {
        setLoading(false)
      }
    })()
  }, [accessToken, authLoading, router])

  // ── Computed stats ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = courses.length
    const completed = courses.filter((c) => !!c.completedAt)
    const inProgress = courses.filter(
      (c) => !c.completedAt && (c.progressPercent ?? 0) > 0,
    )
    const notStarted = courses.filter(
      (c) => !c.completedAt && (c.progressPercent ?? 0) === 0,
    )
    const mandatoryDone = courses.filter((c) => c.isMandatory && !!c.completedAt).length
    const mandatoryTotal = courses.filter((c) => c.isMandatory).length
    const totalHoursCompleted = completed.reduce(
      (s, c) => s + (c.estimatedHours ?? 0), 0,
    )
    const overallPct =
      total > 0
        ? Math.round(
            courses.reduce((s, c) => s + (c.progressPercent ?? 0), 0) / total,
          )
        : 0

    // Study streak — count consecutive days with a completion ending today
    const streak = computeStreak(completed.map((c) => c.completedAt as string))

    return {
      total,
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      notStartedCount: notStarted.length,
      mandatoryDone,
      mandatoryTotal,
      totalHoursCompleted,
      overallPct,
      streak,
      inProgress,
      notStarted,
      completed,
    }
  }, [courses])

  // ── Source label ───────────────────────────────────────────────
  const sourceLabel = (src: CourseRow['source']) => {
    if (src === 'group_publish') return 'Tập đoàn'
    if (src === 'learning_group') return 'Nhóm học'
    if (src === 'learning_path') return 'Lộ trình'
    return 'Công ty'
  }

  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">

      {/* ── Hero gradient ── */}
      <div className="bg-primary-gradient px-4 pt-12 pb-8">
        <p className="text-white/70 text-[13px] mb-1">Tiến độ học tập</p>

        {/* Circular-style % display */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-36 font-medium text-white leading-none">
              {loading ? '—' : `${stats.overallPct}%`}
            </div>
            <p className="text-white/70 text-[13px] mt-1">hoàn thành tổng thể</p>
          </div>

          {/* Streak */}
          {!loading && stats.streak > 0 && (
            <div className="flex flex-col items-center gap-1 bg-white/15 rounded-xl px-4 py-2.5">
              <Flame size={20} className="text-orange-300" />
              <span className="text-white text-17 font-medium">{stats.streak}</span>
              <span className="text-white/60 text-[10px]">ngày liền</span>
            </div>
          )}
        </div>

        {/* Overall progress bar */}
        <div className="mt-4">
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all duration-700 ease-out"
              style={{ width: `${loading ? 0 : stats.overallPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="px-4 -mt-4 mb-4">
        <div className="grid grid-cols-3 gap-2.5">
          <MiniStatCard
            icon={<BookOpen size={16} className="text-primary" />}
            value={loading ? '—' : String(stats.total)}
            label="Tổng"
          />
          <MiniStatCard
            icon={<TrendingUp size={16} className="text-primary" />}
            value={loading ? '—' : String(stats.inProgressCount)}
            label="Đang học"
          />
          <MiniStatCard
            icon={<Trophy size={16} className="text-warning" />}
            value={loading ? '—' : String(stats.completedCount)}
            label="Hoàn thành"
          />
        </div>
      </div>

      <div className="px-4 space-y-4">

        {/* ── Achievement chips ── */}
        {!loading && (
          <section>
            <SectionTitle>Thành tích</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <AchievementChip
                icon={<Trophy size={13} className="text-warning" />}
                label={`${stats.completedCount} chứng chỉ`}
                active={stats.completedCount > 0}
              />
              <AchievementChip
                icon={<AlertCircle size={13} className="text-danger" />}
                label={`${stats.mandatoryDone}/${stats.mandatoryTotal} bắt buộc`}
                active={stats.mandatoryDone > 0}
                full={stats.mandatoryDone === stats.mandatoryTotal && stats.mandatoryTotal > 0}
              />
              <AchievementChip
                icon={<Clock size={13} className="text-primary" />}
                label={`${stats.totalHoursCompleted}h đã học`}
                active={stats.totalHoursCompleted > 0}
              />
              {stats.streak >= 3 && (
                <AchievementChip
                  icon={<Flame size={13} className="text-orange-500" />}
                  label={`${stats.streak} ngày liên tiếp`}
                  active
                />
              )}
            </div>
          </section>
        )}

        {/* ── In-progress courses ── */}
        {(loading || stats.inProgressCount > 0) && (
          <section>
            <SectionTitle>Đang học ({loading ? '…' : stats.inProgressCount})</SectionTitle>
            <div className="space-y-2.5">
              {loading
                ? [1, 2].map((i) => <CourseListItemSkeleton key={i} />)
                : stats.inProgress.map((c) => (
                    <CourseProgressCard key={c.id} course={c} sourceLabel={sourceLabel(c.source)} />
                  ))}
            </div>
          </section>
        )}

        {/* ── Not started ── */}
        {!loading && stats.notStartedCount > 0 && (
          <section>
            <SectionTitle>Chưa bắt đầu ({stats.notStartedCount})</SectionTitle>
            <div className="space-y-2.5">
              {stats.notStarted.map((c) => (
                <CourseProgressCard key={c.id} course={c} sourceLabel={sourceLabel(c.source)} />
              ))}
            </div>
          </section>
        )}

        {/* ── Completed ── */}
        {!loading && stats.completedCount > 0 && (
          <section>
            <button
              onClick={() => setExpandCompleted((v) => !v)}
              className="flex items-center justify-between w-full mb-2"
            >
              <span className="text-[13px] font-medium text-subtle">
                Đã hoàn thành ({stats.completedCount})
              </span>
              {expandCompleted
                ? <ChevronUp size={16} className="text-faint" />
                : <ChevronDown size={16} className="text-faint" />}
            </button>

            {expandCompleted && (
              <div className="space-y-2.5 animate-fade-in">
                {stats.completed.map((c) => (
                  <CourseProgressCard
                    key={c.id}
                    course={c}
                    sourceLabel={sourceLabel(c.source)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Empty state */}
        {!loading && stats.total === 0 && (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <BookOpen size={36} className="text-faint" />
            <p className="text-faint text-[13px]">Chưa có khóa học nào được giao</p>
            <Link
              href="/app/courses"
              className="bg-primary text-white text-[13px] font-medium rounded-lg px-4 py-2.5"
            >
              Xem khóa học
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}

// ─── Course progress card ─────────────────────────────────────────────────────
function CourseProgressCard({
  course,
  sourceLabel,
}: {
  course: CourseRow
  sourceLabel: string
}) {
  const pct = course.progressPercent ?? 0
  const isDone = !!course.completedAt

  return (
    <Link href={`/app/courses/${course.id}`} className="block">
      <div className="bg-surface rounded-xl shadow-card p-4 space-y-3
                      active:scale-[0.99] transition-transform duration-100">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] font-medium text-content leading-snug flex-1">
            {course.title}
          </h3>
          {isDone ? (
            <CheckCircle size={18} className="text-success shrink-0 mt-0.5" />
          ) : course.isMandatory ? (
            <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
          ) : null}
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <ProgressBar value={pct} thick />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-faint">{Math.round(pct)}% hoàn thành</span>
            <div className="flex items-center gap-1.5">
              {course.estimatedHours && (
                <span className="text-[10px] text-faint flex items-center gap-0.5">
                  <Clock size={9} />
                  {course.estimatedHours}h
                </span>
              )}
              <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5
                               ${SOURCE_STYLE[course.source]}`}>
                {sourceLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Deadline warning */}
        {course.deadline && !isDone && (
          <DeadlineWarning deadline={course.deadline} />
        )}
      </div>
    </Link>
  )
}

// ─── Deadline warning ─────────────────────────────────────────────────────────
function DeadlineWarning({ deadline }: { deadline: string | Date }) {
  const d = new Date(deadline)
  const now = new Date()
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const isOverdue = diffDays < 0
  const isUrgent = diffDays >= 0 && diffDays <= 7

  if (!isOverdue && !isUrgent) return null

  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-medium rounded-lg px-2.5 py-1.5
                     ${isOverdue
                       ? 'bg-danger-tint text-danger'
                       : 'bg-warning-tint text-warning'}`}>
      <Clock size={11} />
      {isOverdue
        ? `Đã qua hạn ${Math.abs(diffDays)} ngày`
        : diffDays === 0
        ? 'Hết hạn hôm nay'
        : `Còn ${diffDays} ngày`}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function MiniStatCard({
  icon, value, label,
}: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="bg-surface rounded-xl shadow-card p-3 flex flex-col items-center gap-1.5">
      {icon}
      <span className="text-17 font-medium text-content">{value}</span>
      <span className="text-[10px] text-faint">{label}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[13px] font-medium text-subtle mb-2">{children}</h2>
}

function AchievementChip({
  icon, label, active = false, full = false,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  full?: boolean
}) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium
                     border transition-colors
                     ${full
                       ? 'bg-success-tint text-success border-success/20'
                       : active
                       ? 'bg-primary-tint text-primary border-primary/20'
                       : 'bg-muted text-faint border-[rgba(0,0,0,0.06)]'}`}>
      {icon}
      {label}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SOURCE_STYLE: Record<CourseRow['source'], string> = {
  group_publish:   'bg-primary-tint text-primary',
  learning_group:  'bg-success-tint text-success',
  company_assign:  'bg-warning-tint text-warning',
  learning_path:   'bg-purple-50 text-purple-600',
}

function computeStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0
  const days = completedDates
    .map((d) => new Date(d).toDateString())
    .filter((v, i, arr) => arr.indexOf(v) === i) // unique days
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()) // newest first

  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  // Must have activity today or yesterday to have a streak
  if (days[0] !== today && days[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1])
    const curr = new Date(days[i])
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
    if (diff === 1) streak++
    else break
  }
  return streak
}

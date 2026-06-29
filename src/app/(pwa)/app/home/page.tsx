'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Trophy, BookOpen, TrendingUp } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { ContinueCard, CourseListItem, type CourseCardData } from '@/components/pwa/course-card'
import {
  ContinueCardSkeleton,
  CourseListItemSkeleton,
} from '@/components/pwa/skeleton/course-skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────
interface CourseRow extends CourseCardData {
  source: 'group_publish' | 'learning_group' | 'company_assign'
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, accessToken, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [courses, setCourses] = useState<CourseRow[]>([])
  const [fetchLoading, setFetchLoading] = useState(true)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  // Fetch learner courses
  useEffect(() => {
    if (!accessToken) return
    ;(async () => {
      try {
        const res = await fetch('/api/my/courses', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const json = await res.json()
        if (json.success) setCourses(json.data ?? [])
      } finally {
        setFetchLoading(false)
      }
    })()
  }, [accessToken])

  // ─── Computed stats ─────────────────────────────────────────
  const total = courses.length
  const completed = courses.filter((c) => c.completedAt !== null).length
  const inProgress = courses.filter(
    (c) => !c.completedAt && (c.progressPercent ?? 0) > 0,
  )
  const notStarted = courses.filter(
    (c) => !c.completedAt && (c.progressPercent ?? 0) === 0,
  )
  const avgPercent =
    total > 0
      ? Math.round(courses.reduce((s, c) => s + (c.progressPercent ?? 0), 0) / total)
      : 0

  // Best course to continue = highest progress among in-progress
  const continueTarget =
    inProgress.sort((a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0))[0] ?? null

  // Other in-progress (excluding the main continue card)
  const otherInProgress = continueTarget
    ? inProgress.filter((c) => c.id !== continueTarget.id)
    : []

  // Greeting
  const firstName = user?.fullName?.split(' ').pop() ?? 'bạn'
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'

  const isLoading = authLoading || fetchLoading

  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">

      {/* ── Hero Gradient ── */}
      <div className="bg-primary-gradient px-4 pt-12 pb-6">
        <p className="text-white/70 text-[13px]">{greeting},</p>
        <h1 className="text-white text-xl font-medium mt-0.5">{firstName}</h1>

        {/* Streak badge */}
        <div className="mt-4 inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5">
          <Flame size={15} className="text-orange-300" />
          <span className="text-white text-[13px]">
            Hôm nay bạn đang học rất tốt!
          </span>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="px-4 -mt-4">
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard
            icon={<BookOpen size={18} className="text-primary" />}
            value={isLoading ? '—' : String(total)}
            label="Khóa học"
          />
          <StatCard
            icon={<TrendingUp size={18} className="text-primary" />}
            value={isLoading ? '—' : `${avgPercent}%`}
            label="Hoàn thành"
          />
          <StatCard
            icon={<Trophy size={18} className="text-warning" />}
            value={isLoading ? '—' : String(completed)}
            label="Chứng chỉ"
          />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ── Tiếp tục học ── */}
        <section>
          <SectionTitle>Tiếp tục học</SectionTitle>
          {isLoading ? (
            <ContinueCardSkeleton />
          ) : continueTarget ? (
            <ContinueCard course={continueTarget} />
          ) : notStarted.length > 0 ? (
            // No in-progress — suggest first not-started course
            <ContinueCard
              course={{ ...notStarted[0], progressPercent: 0 }}
            />
          ) : completed === total && total > 0 ? (
            <EmptySection
              icon={<Trophy size={32} className="text-warning" />}
              text="Bạn đã hoàn thành tất cả khóa học!"
            />
          ) : (
            <EmptySection
              icon={<BookOpen size={32} className="text-faint" />}
              text="Chưa có khóa học nào được giao"
            />
          )}
        </section>

        {/* ── Đang học (other in-progress) ── */}
        {(isLoading || otherInProgress.length > 0) && (
          <section>
            <SectionTitle>Đang học</SectionTitle>
            <div className="space-y-2.5">
              {isLoading
                ? [1, 2].map((i) => <CourseListItemSkeleton key={i} />)
                : otherInProgress.slice(0, 5).map((c) => (
                    <CourseListItem key={c.id} course={c} />
                  ))}
            </div>
          </section>
        )}

        {/* ── Chưa bắt đầu ── */}
        {!isLoading && notStarted.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <SectionTitle className="mb-0">Chưa bắt đầu</SectionTitle>
              <a href="/app/courses" className="text-primary text-[13px]">
                Xem tất cả
              </a>
            </div>
            <div className="space-y-2.5">
              {notStarted.slice(0, 3).map((c) => (
                <CourseListItem key={c.id} course={c} />
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="bg-surface rounded-xl shadow-card p-3 flex flex-col items-center gap-1.5">
      {icon}
      <span className="text-17 font-medium text-content">{value}</span>
      <span className="text-[10px] text-faint text-center leading-tight">{label}</span>
    </div>
  )
}

function SectionTitle({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h2 className={`text-[13px] font-medium text-subtle mb-2 ${className}`}>
      {children}
    </h2>
  )
}

function EmptySection({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-surface rounded-xl shadow-card p-6 flex flex-col items-center gap-2">
      {icon}
      <p className="text-faint text-[13px] text-center">{text}</p>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flame, Trophy, BookOpen, TrendingUp, Building2, ChevronRight, Users, CheckCircle2 } from 'lucide-react'
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

interface DeptSummary {
  orgId: string
  orgName: string
  memberCount: number
  enrolled: number
  completed: number
  completionRate: number
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, accessToken, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [courses, setCourses] = useState<CourseRow[]>([])
  const [fetchLoading, setFetchLoading] = useState(true)
  const [deptSummary, setDeptSummary] = useState<DeptSummary[]>([])

  const getRole = (r: unknown): string =>
    typeof r === 'string' ? r : (r as { role: string }).role
  const userRoles = user?.roles?.map(getRole) ?? []
  const isDeptHead = userRoles.includes('dept_head')

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/app/login')
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

  // Fetch dept summary for dept_head
  useEffect(() => {
    if (!accessToken || !isDeptHead) return
    ;(async () => {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` }
        const res = await fetch('/api/reports/dept', { headers })
        const json = await res.json()
        if (!json.success || !Array.isArray(json.data)) return
        const managed: { id: string; name: string }[] = json.data
        const rows: DeptSummary[] = []
        for (const org of managed) {
          const childRes = await fetch(`/api/reports/dept/${org.id}?view=children`, { headers }).then((r) => r.json())
          if (childRes.success && Array.isArray(childRes.data) && childRes.data.length > 0) {
            childRes.data.forEach((c: { orgId: string; orgName: string; memberCount: number; enrolled: number; completed: number; completionRate: number }) => {
              rows.push({ orgId: c.orgId, orgName: c.orgName, memberCount: c.memberCount, enrolled: c.enrolled, completed: c.completed, completionRate: c.completionRate })
            })
          } else {
            rows.push({ orgId: org.id, orgName: org.name, memberCount: 0, enrolled: 0, completed: 0, completionRate: 0 })
          }
        }
        setDeptSummary(rows)
      } catch {
        // silently ignore
      }
    })()
  }, [accessToken, isDeptHead]) // eslint-disable-line

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

        {/* ── Báo cáo bộ phận (dept_head) ── */}
        {isDeptHead && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-primary" />
                <SectionTitle className="mb-0">Báo cáo bộ phận</SectionTitle>
              </div>
              <a href="/app/my-department" className="text-primary text-[13px] flex items-center gap-0.5">
                Xem chi tiết <ChevronRight size={13} />
              </a>
            </div>
            {deptSummary.length === 0 ? (
              <div className="bg-surface rounded-xl shadow-card p-4 flex items-center gap-3">
                <Building2 size={28} className="text-faint opacity-40 flex-shrink-0" />
                <p className="text-[12px] text-faint">Đang tải dữ liệu bộ phận...</p>
              </div>
            ) : (
              <div className="bg-surface rounded-xl shadow-card overflow-hidden">
                {deptSummary.map((row, i) => (
                  <a
                    key={row.orgId}
                    href="/app/my-department"
                    className={`flex items-center gap-3 px-4 py-3 active:bg-muted transition-colors ${i < deptSummary.length - 1 ? 'border-b border-default' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Users size={15} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-content truncate">{row.orgName}</p>
                      <p className="text-[10px] text-subtle mt-0.5">{row.memberCount} nhân viên · {row.enrolled} KH đăng ký</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <CheckCircle2 size={12} className={row.completionRate >= 80 ? 'text-green-500' : row.completionRate >= 40 ? 'text-amber-500' : 'text-red-400'} />
                      <span className={`text-[11px] font-semibold ${row.completionRate >= 80 ? 'text-green-600' : row.completionRate >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                        {row.completionRate}%
      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
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

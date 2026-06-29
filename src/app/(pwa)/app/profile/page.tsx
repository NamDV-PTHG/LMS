'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  BookOpen,
  Award,
  TrendingUp,
  LogOut,
  ChevronRight,
  Download,
  CheckCircle2,
  Clock,
  Mail,
  Briefcase,
} from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import ProgressBar from '@/components/pwa/progress-bar'

// ── Types ─────────────────────────────────────────────────────

interface UserProfile {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  jobTitle: string | null
  jobLevel: string | null
  employeeCode: string | null
}

interface ProfileStats {
  totalCourses: number
  completed: number
  inProgress: number
  certificates: number
  avgProgress: number
}

interface Certificate {
  id: string
  code: string
  issuedAt: string
  expiresAt: string | null
  courseName: string
  courseThumbnail: string | null
}

interface RecentCourse {
  courseId: string
  title: string
  thumbnailUrl: string | null
  status: string
  progressPercent: number
  completedAt: string | null
}

interface ProfileData {
  user: UserProfile
  stats: ProfileStats
  certificates: Certificate[]
  recentCourses: RecentCourse[]
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ icon, value, label, color = 'primary' }: {
  icon: React.ReactNode
  value: string | number
  label: string
  color?: 'primary' | 'success' | 'warning' | 'danger'
}) {
  const tintMap = {
    primary: 'bg-primary-tint text-primary',
    success: 'bg-success-tint text-success',
    warning: 'bg-warning-tint text-warning',
    danger: 'bg-danger-tint text-danger',
  }
  return (
    <div className="bg-surface rounded-xl shadow-card p-3 flex flex-col items-center gap-1.5 text-center">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${tintMap[color]}`}>
        {icon}
      </div>
      <span className="text-xl font-medium text-ink leading-none">{value}</span>
      <span className="text-[11px] text-faint">{label}</span>
    </div>
  )
}

function CertCard({ cert }: { cert: Certificate }) {
  const [downloading, setDownloading] = useState(false)
  const { accessToken } = useAuth()

  const handleDownload = async () => {
    if (!accessToken) return
    setDownloading(true)
    try {
      const res = await fetch(`/api/my/certificates/${cert.code}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const json = await res.json()
      if (json.success && json.data?.pdfUrl) {
        window.open(json.data.pdfUrl, '_blank')
      }
    } catch {
      // silently ignore
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-surface rounded-xl shadow-card p-3 flex items-center gap-3">
      {cert.courseThumbnail ? (
        <img src={cert.courseThumbnail} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-success-tint flex items-center justify-center flex-shrink-0">
          <Award size={20} className="text-success" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{cert.courseName}</p>
        <p className="text-[11px] text-faint mt-0.5">Cấp ngày {formatDate(cert.issuedAt)}</p>
        {cert.expiresAt && (
          <p className="text-[11px] text-warning mt-0.5">Hết hạn {formatDate(cert.expiresAt)}</p>
        )}
      </div>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-tint flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
        aria-label="Tải chứng chỉ"
      >
        <Download size={14} className="text-primary" />
      </button>
    </div>
  )
}

function CourseRow({ course, onPress }: { course: RecentCourse; onPress: () => void }) {
  const isCompleted = course.status === 'completed'
  return (
    <button
      onClick={onPress}
      className="w-full flex items-center gap-3 py-2.5 text-left active:bg-muted/50 transition-colors"
    >
      {course.thumbnailUrl ? (
        <img src={course.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-primary-tint flex items-center justify-center flex-shrink-0">
          <BookOpen size={16} className="text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink truncate">{course.title}</p>
        {isCompleted ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-success mt-0.5">
            <CheckCircle2 size={11} /> Hoàn thành
          </span>
        ) : (
          <div className="mt-1.5">
            <ProgressBar value={course.progressPercent} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isCompleted && (
          <span className="text-[11px] text-faint">{course.progressPercent}%</span>
        )}
        <ChevronRight size={14} className="text-faint" />
      </div>
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">
      {/* Hero skeleton */}
      <div className="bg-primary h-[200px] animate-pulse" />
      <div className="px-4 -mt-12 mb-4">
        <div className="w-20 h-20 rounded-full bg-muted border-4 border-surface animate-pulse" />
      </div>
      <div className="px-4 space-y-2 mb-6">
        <div className="h-5 bg-muted rounded w-40 animate-pulse" />
        <div className="h-3 bg-muted rounded w-28 animate-pulse" />
      </div>
      <div className="px-4 grid grid-cols-4 gap-2 mb-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-surface rounded-xl animate-pulse" />)}
      </div>
    </main>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, accessToken, isLoading, logout } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showLogoutSheet, setShowLogoutSheet] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch('/api/my/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (!isLoading && accessToken) fetchProfile()
  }, [isLoading, accessToken, fetchProfile])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
      setShowLogoutSheet(false)
    }
  }

  if (isLoading || loading) return <ProfileSkeleton />

  const profile = data?.user
  const stats = data?.stats
  const certs = data?.certificates ?? []
  const recentCourses = data?.recentCourses ?? []

  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">
      {/* Hero banner */}
      <div className="relative bg-gradient-to-br from-primary to-primary-dark h-[180px]">
        {/* Decorative circles */}
        <div className="absolute top-4 right-4 w-24 h-24 rounded-full bg-white/5" />
        <div className="absolute top-12 right-12 w-16 h-16 rounded-full bg-white/5" />

        {/* Logout button top-right */}
        <button
          onClick={() => setShowLogoutSheet(true)}
          className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5"
          aria-label="Đăng xuất"
        >
          <LogOut size={14} className="text-white" />
          <span className="text-white text-xs">Đăng xuất</span>
        </button>
      </div>

      {/* Avatar + name */}
      <div className="px-4">
        <div className="flex items-end justify-between -mt-10 mb-3">
          <div className="relative">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.fullName}
                className="w-20 h-20 rounded-full border-4 border-surface object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full border-4 border-surface bg-primary-tint flex items-center justify-center">
                <span className="text-2xl font-medium text-primary">
                  {getInitials(profile?.fullName ?? user?.fullName ?? 'U')}
                </span>
              </div>
            )}
          </div>
        </div>

        <h1 className="text-lg font-medium text-ink leading-tight">
          {profile?.fullName ?? user?.fullName}
        </h1>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 mb-5">
          {profile?.jobTitle && (
            <span className="flex items-center gap-1 text-xs text-faint">
              <Briefcase size={12} />
              {profile.jobTitle}{profile.jobLevel ? ` · ${profile.jobLevel}` : ''}
            </span>
          )}
          {profile?.email && (
            <span className="flex items-center gap-1 text-xs text-faint">
              <Mail size={12} />
              {profile.email}
            </span>
          )}
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 mb-5">
            <StatCard
              icon={<BookOpen size={16} />}
              value={stats.totalCourses}
              label="Khóa học"
              color="primary"
            />
            <StatCard
              icon={<Clock size={16} />}
              value={stats.inProgress}
              label="Đang học"
              color="warning"
            />
            <StatCard
              icon={<CheckCircle2 size={16} />}
              value={stats.completed}
              label="Hoàn thành"
              color="success"
            />
            <StatCard
              icon={<Award size={16} />}
              value={stats.certificates}
              label="Chứng chỉ"
              color="danger"
            />
          </div>
        )}

        {/* Overall progress */}
        {stats && stats.totalCourses > 0 && (
          <div className="bg-surface rounded-xl shadow-card p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-ink">Tiến độ tổng thể</span>
              <span className="text-sm font-medium text-primary">{stats.avgProgress}%</span>
            </div>
            <ProgressBar value={stats.avgProgress} />
            <p className="text-[11px] text-faint mt-2">
              {stats.completed} / {stats.totalCourses} khóa đã hoàn thành
            </p>
          </div>
        )}

        {/* Certificates */}
        {certs.length > 0 && (
          <section className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-ink">Chứng chỉ của tôi</h2>
              <span className="text-[11px] bg-success-tint text-success rounded-full px-2 py-0.5">
                {certs.length} chứng chỉ
              </span>
            </div>
            <div className="space-y-2">
              {certs.map((cert) => (
                <CertCard key={cert.id} cert={cert} />
              ))}
            </div>
          </section>
        )}

        {/* Recent courses */}
        {recentCourses.length > 0 && (
          <section className="mb-4">
            <h2 className="text-sm font-medium text-ink mb-3">Khóa học gần đây</h2>
            <div className="bg-surface rounded-xl shadow-card px-4 divide-y divide-[rgba(0,0,0,0.06)]">
              {recentCourses.map((course) => (
                <CourseRow
                  key={course.courseId}
                  course={course}
                  onPress={() => router.push(`/app/courses/${course.courseId}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {stats?.totalCourses === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-tint flex items-center justify-center mb-4">
              <BookOpen size={28} className="text-primary" />
            </div>
            <p className="font-medium text-ink mb-1">Chưa tham gia khóa học nào</p>
            <p className="text-sm text-faint mb-4">Khám phá các khóa học và bắt đầu học ngay</p>
            <button
              onClick={() => router.push('/app/courses')}
              className="bg-primary text-white text-13 font-medium rounded-lg px-5 py-2.5"
            >
              Khám phá khóa học
            </button>
          </div>
        )}
      </div>

      {/* Logout confirmation bottom sheet */}
      {showLogoutSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowLogoutSheet(false)}
          />
          {/* Sheet */}
          <div className="relative w-full max-w-phone bg-surface rounded-t-2xl px-5 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slide-up">
            <div className="w-10 h-1 rounded-full bg-[rgba(0,0,0,0.12)] mx-auto mb-5" />
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-danger-tint flex items-center justify-center mb-3">
                <LogOut size={22} className="text-danger" />
              </div>
              <h3 className="font-medium text-ink mb-1">Đăng xuất?</h3>
              <p className="text-sm text-faint">Bạn sẽ cần đăng nhập lại để tiếp tục học</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full bg-danger text-white font-medium text-sm rounded-xl py-3 disabled:opacity-60 active:scale-[0.98] transition-all"
              >
                {loggingOut ? 'Đang đăng xuất...' : 'Xác nhận đăng xuất'}
              </button>
              <button
                onClick={() => setShowLogoutSheet(false)}
                className="w-full bg-muted text-ink font-medium text-sm rounded-xl py-3 active:scale-[0.98] transition-all"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

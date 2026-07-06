'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Megaphone, Clock, AlertCircle, CheckCircle, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import {
  deriveNotifications,
  groupByDay,
  markAllRead,
  countUnread,
  type PwaNotif,
} from '@/lib/pwa-notifications'

const LS_COUNT_KEY = 'pwa-notifs-unread-count'

// ─── Admin notification type (from API) ───────────────────────────────────────
interface ApiNotif {
  id: string
  title: string
  body: string
  targetType: string
  createdBy: { fullName: string }
  createdAt: string
  isRead: boolean
}

// ─── Icon mapping for derived notifs ─────────────────────────────────────────
const DERIVED_ICON: Record<string, { icon: React.ElementType; iconCls: string; badgeCls: string }> = {
  overdue:               { icon: AlertCircle, iconCls: 'text-danger',  badgeCls: 'bg-danger-tint' },
  deadline_3d:           { icon: Clock,       iconCls: 'text-danger',  badgeCls: 'bg-danger-tint' },
  deadline_7d:           { icon: Clock,       iconCls: 'text-warning', badgeCls: 'bg-warning-tint' },
  mandatory_not_started: { icon: BookOpen,    iconCls: 'text-warning', badgeCls: 'bg-warning-tint' },
  course_completed:      { icon: CheckCircle, iconCls: 'text-success', badgeCls: 'bg-success-tint' },
  certificate_earned:    { icon: CheckCircle, iconCls: 'text-warning', badgeCls: 'bg-warning-tint' },
}

function relativeTime(dateStr: string | Date): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'Vừa xong'
  if (mins < 60)  return `${mins} phút trước`
  if (hours < 24) return `${hours} giờ trước`
  if (days === 1) return 'Hôm qua'
  if (days < 7)   return `${days} ngày trước`
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { accessToken, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Admin-sent notifications from API
  const [apiNotifs, setApiNotifs] = useState<ApiNotif[]>([])
  const [apiLoading, setApiLoading] = useState(true)

  // Derived course notifications
  const [derivedNotifs, setDerivedNotifs] = useState<PwaNotif[]>([])
  const [derivedLoading, setDerivedLoading] = useState(true)

  // ── Fetch admin notifications from API ────────────────────────
  const loadApiNotifs = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch('/api/notifications?limit=50', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const json = await res.json()
      if (json.success) setApiNotifs(json.data ?? [])
    } catch {
      // silent
    } finally {
      setApiLoading(false)
    }
  }, [accessToken])

  // ── Fetch derived course notifications ────────────────────────
  const loadDerivedNotifs = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch('/api/my/courses', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const json = await res.json()
      if (json.success) setDerivedNotifs(deriveNotifications(json.data ?? []))
    } catch {
      // silent
    } finally {
      setDerivedLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (!authLoading && !accessToken) { router.replace('/login'); return }
    if (!accessToken) return
    loadApiNotifs()
    loadDerivedNotifs()
  }, [accessToken, authLoading, router, loadApiNotifs, loadDerivedNotifs])

  // ── Update badge count whenever data changes ───────────────────
  useEffect(() => {
    const apiUnread = apiNotifs.filter((n) => !n.isRead).length
    const derivedUnread = countUnread(derivedNotifs)
    const total = apiUnread + derivedUnread
    localStorage.setItem(LS_COUNT_KEY, String(total))
    window.dispatchEvent(new Event('pwa-notifs-updated'))
  }, [apiNotifs, derivedNotifs])

  // ── Mark API notification as read ─────────────────────────────
  const handleApiNotifClick = async (id: string) => {
    // Optimistic update
    setApiNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    } catch {
      // silent — optimistic is fine
    }
  }

  // ── Mark all read ──────────────────────────────────────────────
  const handleMarkAllRead = async () => {
    // Mark derived notifs
    const derivedIds = derivedNotifs.map((n) => n.id)
    markAllRead(derivedIds)
    setDerivedNotifs((prev) => prev.map((n) => ({ ...n, read: true })))

    // Mark API notifs
    const unreadApiNotifs = apiNotifs.filter((n) => !n.isRead)
    setApiNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })))
    await Promise.all(
      unreadApiNotifs.map((n) =>
        fetch(`/api/notifications/${n.id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => {})
      )
    )

    localStorage.setItem(LS_COUNT_KEY, '0')
    window.dispatchEvent(new Event('pwa-notifs-updated'))
    toast('success', 'Đã đánh dấu tất cả là đã đọc')
  }

  // ── Mark single derived notif read on click ───────────────────
  const handleDerivedNotifClick = (id: string) => {
    markAllRead([id])
    setDerivedNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }

  const loading = apiLoading || derivedLoading
  const apiUnread = apiNotifs.filter((n) => !n.isRead).length
  const derivedUnread = countUnread(derivedNotifs)
  const totalUnread = apiUnread + derivedUnread

  const derivedGroups = groupByDay(derivedNotifs)

  // ── Render ────────────────────────────────────────────────────
  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-[rgba(0,0,0,0.06)]
                         h-14 flex items-center px-4 gap-3">
        <h1 className="text-17 font-medium text-content flex-1">Thông báo</h1>
        {totalUnread > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-primary text-[13px]
                       active:opacity-70 transition-opacity"
          >
            <CheckCheck size={16} />
            Đọc tất cả
          </button>
        )}
      </header>

      {/* Unread summary pill */}
      {!loading && totalUnread > 0 && (
        <div className="mx-4 mt-3 bg-primary-tint border border-primary/15 rounded-xl
                        px-4 py-2.5 flex items-center gap-2">
          <Bell size={15} className="text-primary shrink-0" />
          <p className="text-[13px] text-primary">
            Bạn có <span className="font-medium">{totalUnread} thông báo</span> chưa đọc
          </p>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="bg-surface divide-y divide-[rgba(0,0,0,0.05)]">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                <div className="animate-pulse bg-muted rounded-full w-9 h-9 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="animate-pulse bg-muted rounded h-3 w-2/3" />
                  <div className="animate-pulse bg-muted rounded h-3 w-full" />
                  <div className="animate-pulse bg-muted rounded h-2.5 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : apiNotifs.length === 0 && derivedNotifs.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Bell size={24} className="text-faint" />
            </div>
            <p className="text-content text-[15px] font-medium">Không có thông báo</p>
            <p className="text-faint text-[13px] text-center">
              Các thông báo từ quản trị viên, deadline và thành tích sẽ hiện ở đây
            </p>
          </div>
        ) : (
          <>
            {/* ── Admin-sent notifications ─────────────────────── */}
            {apiNotifs.length > 0 && (
              <section>
                <div className="px-4 py-2">
                  <span className="text-[11px] font-medium text-faint uppercase tracking-wide">
                    Thông báo từ quản trị viên
                  </span>
                </div>
                <div className="bg-surface divide-y divide-[rgba(0,0,0,0.05)]
                                overflow-hidden shadow-card rounded-xl mx-0">
                  {apiNotifs.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleApiNotifClick(notif.id)}
                      className={`w-full text-left flex items-start gap-3 px-4 py-3.5
                                  transition-colors active:bg-muted
                                  ${notif.isRead ? 'bg-surface' : 'bg-primary-tint/30'}`}
                    >
                      {/* Icon */}
                      <div className="shrink-0 w-9 h-9 rounded-full bg-primary-tint
                                      flex items-center justify-center mt-0.5">
                        <Megaphone size={16} className="text-primary" />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[13px] leading-snug
                                         ${notif.isRead ? 'text-subtle' : 'text-content font-medium'}`}>
                            {notif.title}
                          </p>
                          {!notif.isRead && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1" />
                          )}
                        </div>
                        <p className="text-[12px] text-faint leading-snug line-clamp-2">
                          {notif.body}
                        </p>
                        <p className="text-[10px] text-faint">
                          {relativeTime(notif.createdAt)} · {notif.createdBy.fullName}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ── Derived course notifications ─────────────────── */}
            {derivedGroups.map(({ label, items }) => (
              <section key={label}>
                <div className="px-4 py-2">
                  <span className="text-[11px] font-medium text-faint uppercase tracking-wide">
                    {label}
                  </span>
                </div>
                <div className="bg-surface divide-y divide-[rgba(0,0,0,0.05)]
                                overflow-hidden shadow-card rounded-xl mx-0">
                  {items.map((notif) => {
                    const cfg = DERIVED_ICON[notif.type] ?? DERIVED_ICON.course_completed
                    const Icon = cfg.icon
                    return (
                      <Link
                        key={notif.id}
                        href={`/app/courses/${notif.courseId}`}
                        onClick={() => handleDerivedNotifClick(notif.id)}
                        className={`flex items-start gap-3 px-4 py-3.5 transition-colors
                                    active:bg-muted
                                    ${notif.read ? 'bg-surface' : 'bg-primary-tint/30'}`}
                      >
                        <div className={`shrink-0 w-9 h-9 rounded-full flex items-center
                                         justify-center mt-0.5 ${cfg.badgeCls}`}>
                          <Icon size={16} className={cfg.iconCls} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[13px] leading-snug
                                           ${notif.read ? 'text-subtle' : 'text-content font-medium'}`}>
                              {notif.title}
                            </p>
                            {!notif.read && (
                              <span className="shrink-0 w-2 h-2 rounded-full bg-primary mt-1" />
                            )}
                          </div>
                          <p className="text-[12px] text-faint leading-snug line-clamp-2">
                            {notif.body}
                          </p>
                          <p className="text-[10px] text-faint">{relativeTime(notif.date)}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  )
}

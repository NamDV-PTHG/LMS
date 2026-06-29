'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/components/ui/toast'
import NotifItem from '@/components/pwa/notif-item'
import {
  deriveNotifications,
  groupByDay,
  markAllRead,
  countUnread,
  type PwaNotif,
} from '@/lib/pwa-notifications'

const LS_COUNT_KEY = 'pwa-notifs-unread-count'

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { accessToken, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [notifs, setNotifs] = useState<PwaNotif[]>([])
  const [loading, setLoading] = useState(true)

  // ── Load notifications derived from courses ────────────────────
  const loadNotifs = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch('/api/my/courses', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const json = await res.json()
      if (!json.success) return
      const derived = deriveNotifications(json.data ?? [])
      setNotifs(derived)

      // Persist unread count for BottomNav badge
      const count = countUnread(derived)
      localStorage.setItem(LS_COUNT_KEY, String(count))
      window.dispatchEvent(new Event('pwa-notifs-updated'))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    if (!authLoading && !accessToken) { router.replace('/login'); return }
    if (!accessToken) return
    loadNotifs()
  }, [accessToken, authLoading, router, loadNotifs])

  // ── Mark all read ──────────────────────────────────────────────
  const handleMarkAllRead = () => {
    const ids = notifs.map((n) => n.id)
    markAllRead(ids)
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    // Reset badge counter
    localStorage.setItem(LS_COUNT_KEY, '0')
    window.dispatchEvent(new Event('pwa-notifs-updated'))
    toast('success', 'Đã đánh dấu tất cả là đã đọc')
  }

  // ── Mark single notif read on click ───────────────────────────
  const handleNotifClick = (id: string) => {
    markAllRead([id])
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
    // Recompute badge count
    const newCount = notifs.filter((n) => !n.read && n.id !== id).length
    localStorage.setItem(LS_COUNT_KEY, String(newCount))
    window.dispatchEvent(new Event('pwa-notifs-updated'))
  }

  const unreadCount = countUnread(notifs)
  const groups = groupByDay(notifs)

  // ── Render ────────────────────────────────────────────────────
  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-[rgba(0,0,0,0.06)]
                         h-14 flex items-center px-4 gap-3">
        <h1 className="text-17 font-medium text-content flex-1">Thông báo</h1>
        {unreadCount > 0 && (
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
      {!loading && unreadCount > 0 && (
        <div className="mx-4 mt-3 bg-primary-tint border border-primary/15 rounded-xl
                        px-4 py-2.5 flex items-center gap-2">
          <Bell size={15} className="text-primary shrink-0" />
          <p className="text-[13px] text-primary">
            Bạn có <span className="font-medium">{unreadCount} thông báo</span> chưa đọc
          </p>
        </div>
      )}

      {/* Content */}
      <div className="mt-3 space-y-2">
        {loading ? (
          /* Skeleton */
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
        ) : groups.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Bell size={24} className="text-faint" />
            </div>
            <p className="text-content text-[15px] font-medium">Không có thông báo</p>
            <p className="text-faint text-[13px] text-center">
              Các thông báo về khóa học, deadline và thành tích sẽ hiện ở đây
            </p>
          </div>
        ) : (
          /* Grouped notification list */
          groups.map(({ label, items }) => (
            <section key={label}>
              {/* Day label */}
              <div className="px-4 py-2">
                <span className="text-[11px] font-medium text-faint uppercase tracking-wide">
                  {label}
                </span>
              </div>

              {/* Items */}
              <div className="bg-surface divide-y divide-[rgba(0,0,0,0.05)]
                              overflow-hidden shadow-card rounded-xl mx-0">
                {items.map((notif) => (
                  <NotifItem
                    key={notif.id}
                    notif={notif}
                    onClick={() => handleNotifClick(notif.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  )
}

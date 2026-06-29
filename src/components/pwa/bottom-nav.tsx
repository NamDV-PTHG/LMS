'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, BookOpen, TrendingUp, Bell, User } from 'lucide-react'

const LS_READ_KEY = 'pwa-notifs-read-ids'
const LS_COUNT_KEY = 'pwa-notifs-unread-count'

function readUnreadCount(): number {
  if (typeof window === 'undefined') return 0
  try {
    return parseInt(localStorage.getItem(LS_COUNT_KEY) ?? '0', 10) || 0
  } catch {
    return 0
  }
}

const NAV_ITEMS = [
  { href: '/app/home',          label: 'Trang chủ',  icon: Home,       badge: false },
  { href: '/app/courses',       label: 'Khóa học',   icon: BookOpen,   badge: false },
  { href: '/app/progress',      label: 'Tiến độ',    icon: TrendingUp, badge: false },
  { href: '/app/notifications', label: 'Thông báo',  icon: Bell,       badge: true  },
  { href: '/app/profile',       label: 'Hồ sơ',      icon: User,       badge: false },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)

  // Hydrate unread count from localStorage after mount
  useEffect(() => {
    setUnreadCount(readUnreadCount())

    const handleUpdate = () => setUnreadCount(readUnreadCount())
    window.addEventListener('pwa-notifs-updated', handleUpdate)
    return () => window.removeEventListener('pwa-notifs-updated', handleUpdate)
  }, [])

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-phone mx-auto z-50
                    bg-surface shadow-nav h-16 border-t border-[rgba(0,0,0,0.06)]
                    pb-[env(safe-area-inset-bottom)]">
      <ul className="flex items-center justify-around h-full px-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          const showBadge = badge && unreadCount > 0

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className="flex flex-col items-center justify-center gap-0.5 h-full w-full
                           active:scale-[0.92] transition-transform duration-100"
              >
                {/* Icon with badge */}
                <div className="relative">
                  <Icon
                    size={22}
                    className={isActive ? 'text-primary' : 'text-faint'}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5
                                     bg-danger text-white text-[9px] font-medium
                                     rounded-full flex items-center justify-center px-0.5
                                     leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] leading-none ${isActive ? 'text-primary' : 'text-faint'}`}>
                  {label}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

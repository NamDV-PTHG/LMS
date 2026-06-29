import Link from 'next/link'
import { Clock, AlertCircle, CheckCircle, BookOpen, Flame } from 'lucide-react'
import type { PwaNotif, NotifType } from '@/lib/pwa-notifications'

interface NotifItemProps {
  notif: PwaNotif
  onClick?: () => void
}

export default function NotifItem({ notif, onClick }: NotifItemProps) {
  const { icon: Icon, iconCls, badgeCls } = TYPE_CONFIG[notif.type]

  return (
    <Link
      href={`/app/courses/${notif.courseId}`}
      onClick={onClick}
      className={`flex items-start gap-3 px-4 py-3.5 transition-colors
                  active:bg-muted
                  ${notif.read ? 'bg-surface' : 'bg-primary-tint/30'}`}
    >
      {/* Icon */}
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5 ${badgeCls}`}>
        <Icon size={16} className={iconCls} />
      </div>

      {/* Content */}
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
        <p className="text-[12px] text-faint leading-snug line-clamp-2">{notif.body}</p>
        <p className="text-[10px] text-faint">{formatRelativeTime(notif.date)}</p>
      </div>
    </Link>
  )
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<
  NotifType,
  { icon: React.ElementType; iconCls: string; badgeCls: string }
> = {
  overdue:              { icon: AlertCircle,  iconCls: 'text-danger',  badgeCls: 'bg-danger-tint' },
  deadline_3d:          { icon: Clock,        iconCls: 'text-danger',  badgeCls: 'bg-danger-tint' },
  deadline_7d:          { icon: Clock,        iconCls: 'text-warning', badgeCls: 'bg-warning-tint' },
  mandatory_not_started:{ icon: BookOpen,     iconCls: 'text-warning', badgeCls: 'bg-warning-tint' },
  course_completed:     { icon: CheckCircle,  iconCls: 'text-success', badgeCls: 'bg-success-tint' },
  certificate_earned:   { icon: Flame,        iconCls: 'text-warning', badgeCls: 'bg-warning-tint' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'Vừa xong'
  if (mins < 60)  return `${mins} phút trước`
  if (hours < 24) return `${hours} giờ trước`
  if (days === 1) return 'Hôm qua'
  if (days < 7)   return `${days} ngày trước`
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

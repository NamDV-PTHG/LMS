/**
 * Dashboard page — LMS Web
 * Route: /dashboard  (hoặc / redirect về đây)
 * Layout: WebShell wrapper
 */

import { WebShell } from '@/components/web/web-shell'
import {
  Users, BookOpen, TrendingUp, Clock,
  ArrowUpRight, Shield, BarChart2, CheckCircle2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────
interface StatCard {
  label: string
  value: string
  trend?: string
  trendUp?: boolean
  icon: React.ReactNode
  iconBg: string
  iconColor: string
}

interface CourseRow {
  name: string
  lessons: string
  deadline: string
  progress: number
  status: 'done' | 'progress' | 'new' | 'overdue'
}

interface NotifItem {
  title: string
  body: string
  time: string
  type: 'info' | 'success' | 'warning'
}

// ─── Mock data (thay bằng API call thực) ─────────────────────────
const STATS: StatCard[] = [
  {
    label: 'Học viên',
    value: '248',
    trend: '+12 tháng này',
    trendUp: true,
    icon: <Users size={15} />,
    iconBg: 'bg-primary-tint',
    iconColor: 'text-primary',
  },
  {
    label: 'Khóa học',
    value: '34',
    trend: '+3 khóa mới',
    trendUp: true,
    icon: <BookOpen size={15} />,
    iconBg: 'bg-success-tint',
    iconColor: 'text-success',
  },
  {
    label: 'Tỷ lệ hoàn thành',
    value: '68%',
    trend: '+5% so với T12',
    trendUp: true,
    icon: <TrendingUp size={15} />,
    iconBg: 'bg-primary-tint',
    iconColor: 'text-primary',
  },
  {
    label: 'Hạn nộp tuần này',
    value: '12',
    trend: 'Cần xem lại',
    trendUp: false,
    icon: <Clock size={15} />,
    iconBg: 'bg-warning-tint',
    iconColor: 'text-warning',
  },
]

const COURSES: CourseRow[] = [
  { name: 'An toàn lao động 2024', lessons: '3/8 bài',  deadline: '15/02', progress: 37,  status: 'progress' },
  { name: 'Kỹ năng giao tiếp',     lessons: '6/6 bài',  deadline: '—',     progress: 100, status: 'done'     },
  { name: 'Quy trình PCCC',         lessons: '5/5 bài',  deadline: '—',     progress: 100, status: 'done'     },
  { name: 'Nghiệp vụ kế toán',      lessons: '0/12 bài', deadline: '31/01', progress: 0,   status: 'overdue'  },
  { name: 'Kỹ năng bán hàng FMCG',  lessons: '0/6 bài',  deadline: '28/02', progress: 0,   status: 'new'      },
]

const NOTIFICATIONS: NotifItem[] = [
  { title: 'Nhắc nhở',       body: '"An toàn LĐ" sắp đến hạn — còn 3 ngày.',        time: '30 phút trước', type: 'warning' },
  { title: 'Chứng chỉ mới',  body: 'Hoàn thành và nhận chứng chỉ PCCC cơ bản.',     time: '2 giờ trước',   type: 'success' },
  { title: 'Phản hồi mới',   body: 'Thầy Minh đã trả lời câu hỏi của bạn.',         time: '5 giờ trước',   type: 'info'    },
  { title: 'Khóa học mới',   body: '"Kỹ năng bán hàng FMCG" được HR giao cho bạn.', time: 'Hôm qua 09:30', type: 'info'    },
]

// ─── Sub-components ───────────────────────────────────────────────
const STATUS_MAP = {
  done:     { label: 'Hoàn thành',    cls: 'bg-success-tint text-success' },
  progress: { label: 'Đang học',      cls: 'bg-primary-tint text-primary' },
  new:      { label: 'Chưa bắt đầu', cls: 'bg-warning-tint text-warning' },
  overdue:  { label: 'Quá hạn',       cls: 'bg-danger-tint text-danger'   },
}

const NOTIF_DOT: Record<string, string> = {
  info:    'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
}

function StatCardComp({ stat }: { stat: StatCard }) {
  return (
    <div className="bg-surface rounded-xl border border-default p-4 shadow-card">
      <div className={`w-8 h-8 rounded-lg ${stat.iconBg} ${stat.iconColor} flex items-center justify-center mb-3`}>
        {stat.icon}
      </div>
      <p className="text-[20px] font-medium text-content">{stat.value}</p>
      <p className="text-[10px] text-faint mt-0.5">{stat.label}</p>
      {stat.trend && (
        <p className={`text-[10px] mt-1.5 flex items-center gap-1 ${stat.trendUp ? 'text-success' : 'text-warning'}`}>
          {stat.trendUp ? <ArrowUpRight size={11} /> : <Clock size={11} />}
          {stat.trend}
        </p>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <WebShell pageTitle="Dashboard">
      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {STATS.map((s) => <StatCardComp key={s.label} stat={s} />)}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Course table — chiếm 2/3 */}
        <div className="xl:col-span-2 bg-surface rounded-xl border border-default shadow-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-default">
            <h2 className="text-[13px] font-medium text-content">Khóa học của tôi</h2>
            <a href="/courses" className="text-[11px] text-primary hover:underline flex items-center gap-1">
              Xem tất cả <ArrowUpRight size={11} />
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Tên khóa học</th>
                  <th className="text-left text-[10px] text-faint font-medium px-2 py-2.5 hidden sm:table-cell">Tiến độ</th>
                  <th className="text-left text-[10px] text-faint font-medium px-2 py-2.5">Bài học</th>
                  <th className="text-left text-[10px] text-faint font-medium px-2 py-2.5 hidden md:table-cell">Hạn</th>
                  <th className="text-left text-[10px] text-faint font-medium px-4 py-2.5">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {COURSES.map((c) => (
                  <tr key={c.name} className="border-b border-default last:border-0 hover:bg-muted transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-medium text-content">{c.name}</p>
                    </td>
                    <td className="px-2 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1 bg-primary-tint rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${c.status === 'done' ? 'bg-success' : 'bg-primary'}`}
                            style={{ width: `${c.progress}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium ${c.status === 'done' ? 'text-success' : 'text-primary'}`}>
                          {c.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-[11px] text-subtle">{c.lessons}</td>
                    <td className={`px-2 py-3 text-[11px] hidden md:table-cell ${c.status === 'overdue' ? 'text-danger font-medium' : 'text-subtle'}`}>
                      {c.deadline}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_MAP[c.status].cls}`}>
                        {STATUS_MAP[c.status].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notifications panel — chiếm 1/3 */}
        <div className="bg-surface rounded-xl border border-default shadow-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-default">
            <h2 className="text-[13px] font-medium text-content">Thông báo</h2>
            <a href="/notifications" className="text-[11px] text-primary hover:underline">Tất cả</a>
          </div>
          <div className="divide-y divide-default">
            {NOTIFICATIONS.map((n, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${NOTIF_DOT[n.type]}`} />
                <div>
                  <p className="text-[11px] font-medium text-content">{n.title}</p>
                  <p className="text-[11px] text-subtle mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-[10px] text-faint mt-1">{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </WebShell>
  )
}

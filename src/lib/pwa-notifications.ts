/**
 * Derives learner notifications from course data.
 * No Notification table in schema — computed on the fly.
 * Read state persisted in localStorage.
 */

export type NotifType =
  | 'overdue'
  | 'deadline_7d'
  | 'deadline_3d'
  | 'mandatory_not_started'
  | 'course_completed'
  | 'certificate_earned'

export interface PwaNotif {
  id: string
  type: NotifType
  title: string
  body: string
  date: Date          // used for grouping (Hôm nay / Hôm qua / Trước đó)
  courseId: string
  courseName: string
  read: boolean
}

interface CourseInput {
  id: string
  title: string
  progressPercent: number | null
  completedAt: string | Date | null
  deadline: string | Date | null
  isMandatory: boolean
}

const LS_READ_KEY = 'pwa-notifs-read-ids'

function getReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(LS_READ_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

export function markAllRead(ids: string[]) {
  if (typeof window === 'undefined') return
  const existing = getReadIds()
  ids.forEach((id) => existing.add(id))
  localStorage.setItem(LS_READ_KEY, JSON.stringify([...existing]))
  // Dispatch event so BottomNav can update badge
  window.dispatchEvent(new Event('pwa-notifs-updated'))
}

export function deriveNotifications(courses: CourseInput[]): PwaNotif[] {
  const readIds = getReadIds()
  const now = new Date()
  const notifs: PwaNotif[] = []

  courses.forEach((course) => {
    const deadline = course.deadline ? new Date(course.deadline) : null
    const diffDays = deadline
      ? Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000)
      : null
    const pct = course.progressPercent ?? 0

    // ① Overdue (past deadline, not completed)
    if (deadline && !course.completedAt && diffDays !== null && diffDays < 0) {
      const id = `overdue-${course.id}`
      notifs.push({
        id,
        type: 'overdue',
        title: 'Đã quá hạn',
        body: `"${course.title}" đã qua hạn ${Math.abs(diffDays)} ngày trước`,
        date: deadline,
        courseId: course.id,
        courseName: course.title,
        read: readIds.has(id),
      })
    }

    // ② Deadline within 3 days
    if (deadline && !course.completedAt && diffDays !== null && diffDays >= 0 && diffDays <= 3) {
      const id = `deadline3d-${course.id}`
      notifs.push({
        id,
        type: 'deadline_3d',
        title: diffDays === 0 ? 'Hết hạn hôm nay!' : `Còn ${diffDays} ngày`,
        body: `"${course.title}" sẽ hết hạn ${diffDays === 0 ? 'hôm nay' : `sau ${diffDays} ngày`}`,
        date: new Date(now.getTime() - 3_600_000), // show as "recent"
        courseId: course.id,
        courseName: course.title,
        read: readIds.has(id),
      })
    }
    // ③ Deadline within 7 days (not within 3)
    else if (deadline && !course.completedAt && diffDays !== null && diffDays > 3 && diffDays <= 7) {
      const id = `deadline7d-${course.id}`
      notifs.push({
        id,
        type: 'deadline_7d',
        title: `Còn ${diffDays} ngày`,
        body: `"${course.title}" sẽ hết hạn trong ${diffDays} ngày`,
        date: new Date(now.getTime() - 7_200_000),
        courseId: course.id,
        courseName: course.title,
        read: readIds.has(id),
      })
    }

    // ④ Mandatory not started
    if (course.isMandatory && !course.completedAt && pct === 0) {
      const id = `mandatory-${course.id}`
      notifs.push({
        id,
        type: 'mandatory_not_started',
        title: 'Khóa học bắt buộc chưa bắt đầu',
        body: `"${course.title}" là khóa học bắt buộc. Hãy bắt đầu ngay!`,
        date: new Date(now.getTime() - 2 * 86_400_000), // yesterday-ish
        courseId: course.id,
        courseName: course.title,
        read: readIds.has(id),
      })
    }

    // ⑤ Recently completed (within 30 days)
    if (course.completedAt) {
      const completedAt = new Date(course.completedAt)
      const daysSince = Math.floor((now.getTime() - completedAt.getTime()) / 86_400_000)
      if (daysSince <= 30) {
        const id = `completed-${course.id}`
        notifs.push({
          id,
          type: 'course_completed',
          title: 'Hoàn thành khóa học',
          body: `Chúc mừng! Bạn đã hoàn thành "${course.title}"`,
          date: completedAt,
          courseId: course.id,
          courseName: course.title,
          read: readIds.has(id),
        })
      }
    }
  })

  // Sort newest first
  return notifs.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export function countUnread(notifs: PwaNotif[]): number {
  return notifs.filter((n) => !n.read).length
}

/** Group notifications by Hôm nay / Hôm qua / Trước đó */
export function groupByDay(
  notifs: PwaNotif[],
): { label: string; items: PwaNotif[] }[] {
  const now = new Date()
  const todayStr = now.toDateString()
  const yesterdayStr = new Date(now.getTime() - 86_400_000).toDateString()

  const groups: Record<string, PwaNotif[]> = {
    'Hôm nay': [],
    'Hôm qua': [],
    'Trước đó': [],
  }

  notifs.forEach((n) => {
    const d = n.date.toDateString()
    if (d === todayStr) groups['Hôm nay'].push(n)
    else if (d === yesterdayStr) groups['Hôm qua'].push(n)
    else groups['Trước đó'].push(n)
  })

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }))
}

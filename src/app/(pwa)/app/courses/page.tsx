'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { CourseListItem, type CourseCardData } from '@/components/pwa/course-card'
import { CourseListItemSkeleton } from '@/components/pwa/skeleton/course-skeleton'
import PwaHeader from '@/components/pwa/pwa-header'

type FilterTab = 'all' | 'inProgress' | 'completed' | 'notStarted'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',        label: 'Tất cả' },
  { key: 'inProgress', label: 'Đang học' },
  { key: 'notStarted', label: 'Chưa bắt đầu' },
  { key: 'completed',  label: 'Hoàn thành' },
]

export default function CoursesPage() {
  const { accessToken, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [courses, setCourses] = useState<CourseCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.replace('/login')
      return
    }
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

  const filtered = courses
    .filter((c) => {
      if (filter === 'inProgress') return !c.completedAt && (c.progressPercent ?? 0) > 0
      if (filter === 'completed') return !!c.completedAt
      if (filter === 'notStarted') return !c.completedAt && (c.progressPercent ?? 0) === 0
      return true
    })
    .filter((c) =>
      search.trim() === '' ||
      c.title.toLowerCase().includes(search.trim().toLowerCase()),
    )

  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16 animate-fade-in">
      <PwaHeader title="Khóa học của tôi" />

      {/* Search bar */}
      <div className="bg-surface px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
          <Search size={15} className="text-faint shrink-0" />
          <input
            type="text"
            placeholder="Tìm khóa học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-content placeholder:text-faint
                       focus:outline-none"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="bg-surface flex gap-0 border-b border-[rgba(0,0,0,0.06)] overflow-x-auto
                      scrollbar-none">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 px-4 py-2.5 text-[13px] font-medium relative transition-colors
                        ${filter === tab.key ? 'text-primary' : 'text-faint'}`}
          >
            {tab.label}
            {filter === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Course list */}
      <div className="px-4 py-3 space-y-2.5">
        {loading ? (
          [1, 2, 3, 4].map((i) => <CourseListItemSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-faint text-[13px]">
              {search ? 'Không tìm thấy khóa học phù hợp' : 'Không có khóa học nào'}
            </p>
          </div>
        ) : (
          filtered.map((c) => <CourseListItem key={c.id} course={c} />)
        )}
      </div>
    </main>
  )
}

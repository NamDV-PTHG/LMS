import { CourseListItemSkeleton } from '@/components/pwa/skeleton/course-skeleton'

export default function ProgressLoading() {
  return (
    <div className="max-w-phone mx-auto min-h-screen bg-muted pb-16">
      {/* Hero skeleton */}
      <div className="bg-primary-gradient px-4 pt-12 pb-8">
        <div className="animate-pulse bg-white/20 rounded h-3 w-20 mb-3" />
        <div className="animate-pulse bg-white/20 rounded h-10 w-24 mb-1" />
        <div className="animate-pulse bg-white/20 rounded h-3 w-32 mb-4" />
        <div className="animate-pulse bg-white/20 rounded-full h-2 w-full" />
      </div>

      {/* Stat cards skeleton */}
      <div className="px-4 -mt-4 mb-4">
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface rounded-xl shadow-card p-3 flex flex-col items-center gap-1.5">
              <div className="animate-pulse bg-muted rounded-full w-4 h-4" />
              <div className="animate-pulse bg-muted rounded h-5 w-8" />
              <div className="animate-pulse bg-muted rounded h-2.5 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Achievement chips skeleton */}
      <div className="px-4 space-y-4">
        <div>
          <div className="animate-pulse bg-muted rounded h-3 w-16 mb-2" />
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-muted rounded-full h-7 w-24" />
            ))}
          </div>
        </div>
        <div>
          <div className="animate-pulse bg-muted rounded h-3 w-20 mb-2" />
          <div className="space-y-2.5">
            <CourseListItemSkeleton />
            <CourseListItemSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

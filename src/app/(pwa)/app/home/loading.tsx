import { ContinueCardSkeleton, CourseListItemSkeleton } from '@/components/pwa/skeleton/course-skeleton'

export default function HomeLoading() {
  return (
    <main className="max-w-phone mx-auto min-h-screen bg-muted pb-16">
      {/* Hero skeleton */}
      <div className="bg-primary-gradient px-4 pt-12 pb-6">
        <div className="animate-pulse bg-white/20 rounded h-3 w-20 mb-2" />
        <div className="animate-pulse bg-white/20 rounded h-6 w-32" />
        <div className="mt-4 animate-pulse bg-white/20 rounded-full h-7 w-44" />
      </div>

      {/* Stat cards skeleton */}
      <div className="px-4 -mt-4">
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface rounded-xl shadow-card p-3 flex flex-col items-center gap-1.5">
              <div className="animate-pulse bg-muted rounded-full w-5 h-5" />
              <div className="animate-pulse bg-muted rounded h-5 w-8" />
              <div className="animate-pulse bg-muted rounded h-2.5 w-14" />
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <section>
          <div className="animate-pulse bg-muted rounded h-3 w-20 mb-2" />
          <ContinueCardSkeleton />
        </section>
        <section>
          <div className="animate-pulse bg-muted rounded h-3 w-16 mb-2" />
          <div className="space-y-2.5">
            <CourseListItemSkeleton />
            <CourseListItemSkeleton />
          </div>
        </section>
      </div>
    </main>
  )
}

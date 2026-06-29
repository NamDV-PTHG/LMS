export function LessonItemSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <div className="animate-pulse bg-muted rounded-full w-7 h-7 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="animate-pulse bg-muted rounded h-3 w-3/4" />
        <div className="animate-pulse bg-muted rounded h-2.5 w-1/4" />
      </div>
    </div>
  )
}

export function CourseDetailSkeleton() {
  return (
    <div className="max-w-phone mx-auto min-h-screen bg-muted pb-16">
      {/* Hero */}
      <div className="animate-pulse bg-primary-tint h-44 w-full" />
      {/* Info block */}
      <div className="bg-surface px-4 py-4 space-y-2 border-b border-[rgba(0,0,0,0.06)]">
        <div className="animate-pulse bg-muted rounded h-5 w-3/4" />
        <div className="animate-pulse bg-muted rounded h-3 w-1/2" />
        <div className="animate-pulse bg-muted rounded-full h-1.5 w-full" />
      </div>
      {/* Tab bar */}
      <div className="bg-surface flex border-b border-[rgba(0,0,0,0.06)] px-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 py-3 flex justify-center">
            <div className="animate-pulse bg-muted rounded h-3 w-14" />
          </div>
        ))}
      </div>
      {/* Lessons */}
      <div className="bg-surface mt-2 divide-y divide-[rgba(0,0,0,0.05)]">
        {[1, 2, 3, 4, 5].map((i) => (
          <LessonItemSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

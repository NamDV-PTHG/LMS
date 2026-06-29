export function ContinueCardSkeleton() {
  return (
    <div className="bg-surface rounded-xl shadow-card overflow-hidden">
      <div className="animate-pulse bg-muted h-32 w-full" />
      <div className="p-3 space-y-2">
        <div className="animate-pulse bg-muted rounded h-3 w-3/4" />
        <div className="animate-pulse bg-muted rounded h-3 w-1/2" />
        <div className="animate-pulse bg-muted rounded-full h-1.5 w-full" />
        <div className="animate-pulse bg-muted rounded-lg h-8 w-full mt-1" />
      </div>
    </div>
  )
}

export function CourseListItemSkeleton() {
  return (
    <div className="bg-surface rounded-xl shadow-card p-3 flex gap-3 items-center">
      <div className="animate-pulse bg-muted rounded-lg w-14 h-14 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="animate-pulse bg-muted rounded h-3 w-3/4" />
        <div className="animate-pulse bg-muted rounded h-3 w-1/2" />
        <div className="animate-pulse bg-muted rounded-full h-1 w-full" />
      </div>
    </div>
  )
}

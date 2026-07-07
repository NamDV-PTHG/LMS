/**
 * Skeleton — loading placeholder components
 *
 * Dùng:
 *   <Skeleton className="h-4 w-32" />
 *   <SkeletonCard />
 *   <SkeletonTable rows={5} cols={4} />
 *   <SkeletonStatCards count={4} />
 */

// ─── Base Skeleton ───────────────────────────────────────────────
interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-muted rounded animate-pulse ${className}`} />
  )
}

// ─── Stat Card Skeleton ──────────────────────────────────────────
function SkeletonStatCard() {
  return (
    <div className="bg-surface rounded-xl border border-default shadow-card p-4">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-6 w-16 mb-2" />
      <Skeleton className="h-2.5 w-20" />
    </div>
  )
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-3 grid-cols-2 lg:grid-cols-${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  )
}

// ─── Card Skeleton ───────────────────────────────────────────────
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-3">
      <Skeleton className="h-4 w-1/2" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}

// ─── Table Skeleton ──────────────────────────────────────────────
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-surface rounded-xl border border-default shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-default">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-16" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 border-b border-default last:border-0"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={`h-3 ${j === 0 ? 'w-32' : 'w-20'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Form Skeleton ───────────────────────────────────────────────
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="bg-surface rounded-xl border border-default shadow-card p-4 space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}

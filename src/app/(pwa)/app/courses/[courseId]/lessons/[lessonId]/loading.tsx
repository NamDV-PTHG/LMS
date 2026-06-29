export default function LessonLoading() {
  return (
    <div className="max-w-phone mx-auto min-h-screen bg-muted pb-16">
      <div className="bg-black h-12 flex items-center px-3 gap-2">
        <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
        <div className="bg-white/10 rounded h-3 w-40 animate-pulse" />
      </div>
      <div className="bg-black aspect-video w-full animate-pulse" />
      <div className="bg-surface flex border-b border-[rgba(0,0,0,0.06)]">
        {[1, 2].map((i) => (
          <div key={i} className="flex-1 py-3 flex justify-center">
            <div className="animate-pulse bg-muted rounded h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="px-4 py-4 space-y-3">
        <div className="bg-surface rounded-xl shadow-card p-4 space-y-2">
          <div className="animate-pulse bg-muted rounded h-4 w-3/4" />
          <div className="animate-pulse bg-muted rounded h-3 w-1/3" />
        </div>
        <div className="animate-pulse bg-muted rounded-xl h-12 w-full" />
      </div>
    </div>
  )
}

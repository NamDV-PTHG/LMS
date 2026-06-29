export default function NotificationsLoading() {
  return (
    <div className="max-w-phone mx-auto min-h-screen bg-muted pb-16">
      <div className="bg-surface border-b border-[rgba(0,0,0,0.06)] h-14 flex items-center px-4">
        <div className="animate-pulse bg-muted rounded h-4 w-24" />
      </div>
      <div className="mt-3 space-y-2">
        {['Hôm nay', 'Hôm qua'].map((label) => (
          <section key={label}>
            <div className="px-4 py-2">
              <div className="animate-pulse bg-muted rounded h-2.5 w-14" />
            </div>
            <div className="bg-surface divide-y divide-[rgba(0,0,0,0.05)] shadow-card rounded-xl mx-0">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="animate-pulse bg-muted rounded-full w-9 h-9 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="animate-pulse bg-muted rounded h-3 w-2/3" />
                    <div className="animate-pulse bg-muted rounded h-3 w-full" />
                    <div className="animate-pulse bg-muted rounded h-2.5 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

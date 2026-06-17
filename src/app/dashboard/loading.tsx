/** Shown while the dashboard segment streams in. Calm skeleton, not a spinner. */
export default function DashboardLoading() {
  return (
    <div className="space-y-12 animate-pulse" aria-hidden="true">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-surface-2 rounded" />
          <div className="h-7 w-48 bg-surface-2 rounded" />
        </div>
        <div className="h-12 w-32 bg-surface-2 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-36 bg-surface border border-line rounded-2xl" />
        <div className="h-36 bg-surface border border-line rounded-2xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-64 bg-surface border border-line rounded-2xl" />
        ))}
      </div>

      <span className="sr-only">Loading your supplies…</span>
    </div>
  )
}

'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/** Scoped error boundary for the dashboard segment — keeps the nav/shell intact
 *  and lets the user retry just the failed content (e.g. a flaky data fetch). */
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="bg-surface border border-line rounded-2xl p-8 text-center max-w-md mx-auto mt-8">
      <div className="w-12 h-12 bg-caution-soft rounded-xl flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-6 h-6 text-caution" />
      </div>
      <h2 className="text-lg font-semibold mb-2 text-ink">Couldn’t load this view</h2>
      <p className="text-sm text-muted mb-6">
        Something went wrong fetching your supplies. Your data is safe — try again.
      </p>
      <button
        onClick={() => unstable_retry()}
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary-deep text-white px-5 py-2.5 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
      >
        <RotateCcw className="w-4 h-4" />
        Try again
      </button>
    </div>
  )
}

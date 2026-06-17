'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  // A missing/blank Supabase key throws a clear "Configuration missing" message
  // (see src/lib/env.ts) — surface that to the user instead of a generic crash.
  const isConfig = error.message.startsWith('Configuration missing')

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-line rounded-2xl p-8 shadow-sm text-center">
        <div className="w-14 h-14 bg-caution-soft rounded-2xl flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-7 h-7 text-caution" />
        </div>
        <h1 className="text-xl font-bold mb-2">
          {isConfig ? 'The app isn’t configured yet' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-muted mb-6 leading-relaxed">
          {isConfig
            ? error.message
            : 'An unexpected error occurred. Your data is safe — try again in a moment.'}
        </p>
        <button
          onClick={() => unstable_retry()}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-deep text-white px-5 py-3 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          <RotateCcw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { Compass } from 'lucide-react'

/** Friendly 404 — shown for any unknown route. */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-line rounded-2xl p-8 shadow-sm text-center">
        <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Compass className="w-7 h-7 text-muted" />
        </div>
        <p className="text-5xl font-black tabular-nums mb-2">404</p>
        <h1 className="text-xl font-bold mb-2">Page not found</h1>
        <p className="text-sm text-muted mb-6 leading-relaxed">
          That page doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-deep text-white px-5 py-3 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          Back to your supplies
        </Link>
      </div>
    </main>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

/**
 * Consistent back-navigation button used in every sub-page header.
 * Calls router.back() (respects the user's real navigation history) and
 * falls back to `fallbackHref` when there is no previous entry (e.g. a
 * direct deep-link).
 */
export function BackButton({
  fallbackHref = '/dashboard',
  label = 'Back',
}: {
  fallbackHref?: string
  label?: string
}) {
  const router = useRouter()

  const handleClick = () => {
    // window.history.length <= 1 means the tab was opened directly at this URL
    // with no prior entry — use the fallback instead of going "back" to nothing.
    if (typeof window !== 'undefined' && window.history.length <= 1) {
      router.push(fallbackHref)
    } else {
      router.back()
    }
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded mb-6 -ml-1 group"
    >
      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
      {label}
    </button>
  )
}

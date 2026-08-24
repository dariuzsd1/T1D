'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

/** How often to re-check while a tab simply sits open. */
const POLL_MS = 30 * 60 * 1000

/**
 * Tells a long-lived session that a newer build is being served.
 *
 * Next.js navigates on the client, so a tab left open for days keeps running the
 * bundle it first loaded and a successful deploy never reaches it. That is what
 * made the app look weeks out of date once, and it was misdiagnosed as a service
 * worker caching the shell: the only worker here handles push notifications and
 * has no fetch handler, so it cannot serve anything stale.
 *
 * This only ever OFFERS a reload. Reloading someone automatically could throw
 * away a half-filled form, and the app holds medical data worth not losing.
 */
export function UpdateBanner() {
  const { t } = useI18n()
  const [stale, setStale] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const check = useCallback(async () => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID
    // 'dev' means both sides came from the same local build; nothing to compare.
    if (!mine || mine === 'dev') return
    try {
      const res = await fetch('/api/version', { cache: 'no-store' })
      if (!res.ok) return
      const { buildId } = (await res.json()) as { buildId?: string }
      if (buildId && buildId !== mine) setStale(true)
    } catch {
      // Offline or a blip: silence is right, this is not worth a warning.
    }
  }, [])

  useEffect(() => {
    // Every check is driven by a timer or a listener rather than the effect body:
    // the first one waits for the page to settle instead of racing the initial
    // data loads, and it keeps the state update in a callback where it belongs.
    const first = window.setTimeout(() => void check(), 3000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const poll = window.setInterval(() => void check(), POLL_MS)
    return () => {
      clearTimeout(first)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(poll)
    }
  }, [check])

  if (!stale || dismissed) return null

  return (
    <div
      role="status"
      className="print:hidden flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-sm text-ink"
    >
      <RefreshCw className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1 leading-snug">{t('update.available')}</p>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
      >
        {t('update.reload')}
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label={t('update.dismissAria')}
        className="shrink-0 rounded-lg p-2 text-faint transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

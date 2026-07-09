'use client'

import { useEffect } from 'react'
import { useStore, SAFETY_BUFFER_KEY } from '@/lib/store'
import { SURGE_BUFFER_KEY, readStoredSurge } from '@/lib/surgeBuffer'

/**
 * Applies the saved safety-buffer preferences once, after mount. Reading
 * localStorage post-hydration (never during render) keeps server and first
 * client render identical, so there's no hydration mismatch. Renders nothing.
 */
export function PreferencesHydrator() {
  const setSafetyBufferDays = useStore((s) => s.setSafetyBufferDays)
  const setSurgeBuffer = useStore((s) => s.setSurgeBuffer)

  useEffect(() => {
    // Base buffer first, so the surge re-derive below layers on the right base.
    const saved = window.localStorage.getItem(SAFETY_BUFFER_KEY)
    if (saved) {
      const n = parseInt(saved, 10)
      if (!Number.isNaN(n) && n > 0) setSafetyBufferDays(n)
    }
    // Surge: apply if still within its window; drop it (and its stale key) if not.
    const surge = readStoredSurge(window.localStorage.getItem(SURGE_BUFFER_KEY))
    if (surge) setSurgeBuffer(surge)
    else window.localStorage.removeItem(SURGE_BUFFER_KEY)
  }, [setSafetyBufferDays, setSurgeBuffer])

  return null
}

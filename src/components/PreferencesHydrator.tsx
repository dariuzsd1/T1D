'use client'

import { useEffect } from 'react'
import { useStore, SAFETY_BUFFER_KEY } from '@/lib/store'

/**
 * Applies the saved safety-buffer preference once, after mount. Reading
 * localStorage post-hydration (never during render) keeps server and first
 * client render identical, so there's no hydration mismatch. Renders nothing.
 */
export function PreferencesHydrator() {
  const setSafetyBufferDays = useStore((s) => s.setSafetyBufferDays)

  useEffect(() => {
    const saved = window.localStorage.getItem(SAFETY_BUFFER_KEY)
    if (saved) {
      const n = parseInt(saved, 10)
      if (!Number.isNaN(n) && n > 0) setSafetyBufferDays(n)
    }
  }, [setSafetyBufferDays])

  return null
}

'use client'

/**
 * Per-device preference: how long a site should rest before the rotation map
 * counts it "ready" again. `siteRotation.RECENT_USE_DAYS` is the default; this
 * lets a user match their own clinician's guidance (rest guidance runs ~2 to 4
 * weeks). Stored per-device in localStorage, mirroring the biometric-lock
 * pattern (`src/lib/biometricLock.ts`): it's a UI tuning, not PHI, so it never
 * goes to the server. `normalizeRestWindow` is pure so it can be unit tested.
 */

import { RECENT_USE_DAYS } from './siteRotation'

const KEY = 't1d-site-rest-window-days'

/** The rest-window choices the UI offers, in days. RECENT_USE_DAYS is the default. */
export const REST_WINDOW_OPTIONS = [14, 21, 28] as const

/**
 * Clamp any value to a supported option, falling back to the default. Keeps a
 * corrupted/legacy localStorage value (or an out-of-range write) from ever
 * feeding the rotation math a nonsense window.
 */
export function normalizeRestWindow(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (Number.isFinite(n) && (REST_WINDOW_OPTIONS as readonly number[]).includes(n)) return n
  return RECENT_USE_DAYS
}

export function getSiteRestWindowDays(): number {
  if (typeof window === 'undefined') return RECENT_USE_DAYS
  try {
    return normalizeRestWindow(localStorage.getItem(KEY))
  } catch {
    return RECENT_USE_DAYS
  }
}

export function setSiteRestWindowDays(days: number): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, String(normalizeRestWindow(days)))
  } catch {
    /* ignore */
  }
}

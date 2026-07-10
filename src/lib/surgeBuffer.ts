/**
 * Sick-day / travel "surge buffer" — a TIME-BOXED bump to the safety buffer.
 *
 * The steady safety buffer (src/lib/store.ts safetyBufferDays) answers "how many
 * days of reserve before I nag you to reorder." But during a sick spell or a trip,
 * usage spikes (more insulin, more BG checks, more frequent site changes) and a
 * normal buffer can leave you short at the worst possible time. This lets the user
 * temporarily add extra reserve days for a set window, after which it reverts on
 * its own — no "I forgot I raised it and now I over-order forever" footgun.
 *
 * Design notes (CLAUDE.md §0/§9):
 *  - It only ever RAISES the buffer, so a stale/expired surge fails SAFE: at worst
 *    you reorder a little early (over-reserve), never late. That's why the store
 *    can compute the effective value at set-time and not fight to expire it to the
 *    second — expiry is re-evaluated on every mount and whenever the buffer changes.
 *  - Pure date/number logic, no I/O, so it's trivially testable.
 *  - Non-PHI (just two numbers + a date), so it's cached in localStorage like the
 *    base buffer, not stored as health data.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** localStorage key for the surge buffer (non-PHI, same rationale as the base buffer). */
export const SURGE_BUFFER_KEY = 't1d-surge-buffer'

export interface SurgeBuffer {
  /** Extra reserve days added on top of the base buffer while the window is open. */
  extraDays: number
  /** Inclusive last day the surge applies, as a local `yyyy-mm-dd` string. */
  untilDate: string
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Parse a `yyyy-mm-dd` string as a LOCAL calendar date (midnight local), avoiding
 *  the UTC-shift bug of `new Date('yyyy-mm-dd')`. Returns null if malformed. */
export function parseSurgeDate(untilDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(untilDate)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** A `yyyy-mm-dd` string for `days` days from now (local). Used to build a window. */
export function surgeUntilInDays(days: number, now: Date = new Date()): string {
  const d = startOfDay(now)
  d.setDate(d.getDate() + Math.max(0, Math.round(days)))
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

/** Is the surge within its window right now (and actually adding days)? */
export function isSurgeActive(surge: SurgeBuffer | null | undefined, now: Date = new Date()): boolean {
  if (!surge || !(surge.extraDays > 0)) return false
  const until = parseSurgeDate(surge.untilDate)
  if (!until) return false
  // Active through the END of untilDate: today must be on or before it.
  return startOfDay(now).getTime() <= until.getTime()
}

/** Whole days remaining in the window (0 = ends today), or null when not active. */
export function surgeDaysLeft(surge: SurgeBuffer | null | undefined, now: Date = new Date()): number | null {
  if (!isSurgeActive(surge, now)) return null
  const until = parseSurgeDate(surge!.untilDate)!
  return Math.max(0, Math.round((until.getTime() - startOfDay(now).getTime()) / MS_PER_DAY))
}

/** The buffer the app should actually alert against: base + extra while active,
 *  else the plain base. This is what every runway/alert surface reads. */
export function effectiveBuffer(
  base: number,
  surge: SurgeBuffer | null | undefined,
  now: Date = new Date()
): number {
  return isSurgeActive(surge, now) ? base + Math.max(0, surge!.extraDays) : base
}

/** Validate a stored surge (from localStorage). Returns null when missing,
 *  malformed, or already expired — so an expired window never lingers. */
export function readStoredSurge(raw: string | null | undefined, now: Date = new Date()): SurgeBuffer | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const { extraDays, untilDate } = parsed as Record<string, unknown>
    if (typeof extraDays !== 'number' || !(extraDays > 0)) return null
    if (typeof untilDate !== 'string') return null
    const surge: SurgeBuffer = { extraDays, untilDate }
    return isSurgeActive(surge, now) ? surge : null
  } catch {
    return null
  }
}

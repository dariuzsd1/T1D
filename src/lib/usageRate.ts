/**
 * Which supplies the app must ASK about rather than estimate.
 *
 * The catalog carries a verified wear rate for anything worn or inserted: a
 * 10-day sensor is 0.1/day for everybody. But strips, lancets, pen needles and
 * hypo treatments are used a personal number of times a day, so the catalog
 * deliberately leaves those blank, and no default is honest.
 *
 * Leaving it blank is honest but useless: 91 of 136 catalog products land here,
 * the runway becomes unknowable, and the item silently drops out of every refill
 * list. Asking once, at the moment the supply is added, is the only thing that
 * turns those items back into something the app can actually warn about.
 */

/** Catalog categories whose usage is per-person and routinely above one a day. */
const PER_PERSON_CONSUMPTION = new Set([
  'bg_supply',
  'mdi_supply',
  'ketone_supply',
  'hypo_treatment',
])

/**
 * True when we should ask the user how many they get through in a day: this kind
 * of supply has no honest default, and none is already recorded.
 */
export function needsUsageRate(category: string | null | undefined, usageRatePerDay: number): boolean {
  if (usageRatePerDay > 0) return false
  return PER_PERSON_CONSUMPTION.has((category ?? '').trim())
}

/**
 * Read a typed "per day" answer. Rejects anything that is not a positive, finite
 * number so a stray keystroke cannot become a usage rate, and caps absurd values
 * that would otherwise report a runway of hours.
 */
export function parseUsagePerDay(value: string): number | null {
  const n = Number(value.replace(',', '.').trim())
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null
  return n
}

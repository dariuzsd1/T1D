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

/**
 * Catalog categories whose usage is per-person and routinely above one a day.
 *
 * `ketone_supply` used to be in here and is not any more. Ketone strips are used
 * when someone is ill or running high, not on a schedule, so "how many a day?"
 * describes nobody who actually uses them, and rescueItems ignored the answer
 * anyway: those are judged on expiry. Asking a question whose answer is thrown
 * away is worse than not asking.
 *
 * `hypo_treatment` stays, and now its answer is used (see
 * rescueItems.tracksDailyUse). Fast carbs are genuinely eaten and a tube runs
 * out, which is a thing the app could not previously say.
 */
const PER_PERSON_CONSUMPTION = new Set([
  'bg_supply',
  'mdi_supply',
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
 * Insulin is asked for too, but it CANNOT go in the set above.
 *
 * A rate is containers per day. For strips that is the same number the user
 * would say out loud ("six a day"), which is why one box asks one question. For
 * insulin it is not: someone on 40 units a day would type 40, and the single
 * prompt would store 40 VIALS a day and report a five-vial stock as running out
 * this afternoon. The number people know is their dose, and turning a dose into
 * containers needs the container size as well.
 *
 * So insulin gets its own two-field prompt and its own predicate. Keeping them
 * apart is the point: whatever else changes, a dose must never be read as a
 * count of containers.
 */
export function needsInsulinRate(category: string | null | undefined, usageRatePerDay: number): boolean {
  if (usageRatePerDay > 0) return false
  return (category ?? '').trim() === 'insulin'
}

/**
 * Containers per day from a dose and a container size: 40 units a day out of a
 * 1000-unit vial is 0.04 vials a day. Returns 0 unless both numbers are real and
 * positive, so a half-filled form leaves the runway an honest estimate instead of
 * a number derived from one field.
 *
 * Shared with EditProductModal's insulin tab, which used to inline this. One
 * definition means the rate a supply is created with and the rate it is later
 * edited to cannot drift apart.
 */
export function insulinRatePerDay(unitsPerDay: number, unitsPerContainer: number): number {
  if (!Number.isFinite(unitsPerDay) || !Number.isFinite(unitsPerContainer)) return 0
  if (unitsPerDay <= 0 || unitsPerContainer <= 0) return 0
  return unitsPerDay / unitsPerContainer
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

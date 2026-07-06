/**
 * Honest supply-runway math — the single source of truth for "days remaining".
 *
 * We deliberately separate the three numbers CLAUDE.md §7 calls out:
 *   1. stock-on-hand          → `quantity`
 *   2. how long the stock runs → `daysOfStock` (quantity ÷ daily usage)
 *   3. shelf-life expiry       → `daysUntilExpiration`
 *
 * The headline "runway" a user sees is the *sooner* of running out and expiring,
 * so the number is never more optimistic than reality. Nothing here fabricates a
 * value: if usage is unknown we fall back to the conservative 1-unit/day estimate
 * (shortest reasonable runway), never a rosy guess.
 */

export const DEFAULT_SAFETY_BUFFER_DAYS = 14

/**
 * Conservative fallback used ONLY when the user hasn't told us their real daily
 * usage. One unit/day yields the shortest (safest) runway, so we under-promise
 * rather than over-promise — but a runway built on this MUST be labelled an
 * estimate in the UI (never shown as a known fact). See `isRateEstimated`.
 */
export const DEFAULT_USAGE_RATE_PER_DAY = 1

const MS_PER_DAY = 1000 * 60 * 60 * 24

export interface RunwayInput {
  quantity: number
  usageRatePerDay: number
  expirationDate?: string | null
  // Insulin in-use clock: when the current vial/pen was opened, and how many
  // days it stays good once opened (28 for most insulins). Both optional.
  openedDate?: string | null
  inUseDays?: number | null
}

/** True when the runway rests on the fallback rate rather than a user-entered one. */
export function isRateEstimated(usageRatePerDay?: number | null): boolean {
  return !(typeof usageRatePerDay === 'number' && usageRatePerDay > 0)
}

/**
 * Convert "how long one unit lasts" (the intuitive way people think about a
 * sensor/pod/set: "each one lasts 7 days") into the internal daily usage rate.
 * 7 days/unit → 1/7 ≈ 0.143 units/day. Zero/blank means "unknown" (rate 0).
 */
export function rateFromDaysPerUnit(daysPerUnit: number): number {
  return daysPerUnit > 0 ? 1 / daysPerUnit : 0
}

/**
 * The inverse: express a daily usage rate as "days each unit lasts", rounded to
 * whole days. Returns null when the rate is unknown or implies sub-day usage
 * (a consumption item like test strips, where "days per unit" isn't meaningful).
 */
export function daysPerUnitFromRate(usageRatePerDay?: number | null): number | null {
  if (!(typeof usageRatePerDay === 'number' && usageRatePerDay > 0)) return null
  if (usageRatePerDay > 1) return null // more than one unit/day → not a wear item
  return Math.round(1 / usageRatePerDay)
}

/** Days of stock left, derived from units on hand and daily usage. */
export function daysOfStock(quantity: number, usageRatePerDay: number): number {
  // An unknown/zero rate falls back to the conservative default rather than Infinity.
  const usage = usageRatePerDay > 0 ? usageRatePerDay : DEFAULT_USAGE_RATE_PER_DAY
  return Math.max(0, Math.floor(quantity / usage))
}

/** Days until the boxed stock expires (shelf life), or null if unknown. */
export function daysUntilExpiration(expirationDate?: string | null): number | null {
  if (!expirationDate) return null
  const ms = new Date(expirationDate).getTime()
  if (Number.isNaN(ms)) return null
  return Math.floor((ms - Date.now()) / MS_PER_DAY)
}

/**
 * Days until an opened vial/pen must be discarded (the in-use clock — insulin
 * stays good ~28 days once opened, regardless of the printed expiry). Negative
 * means it's already past the discard date; null when the item isn't tracked
 * this way (no opened date or no in-use window). Never fabricated.
 */
export function inUseDaysRemaining(
  openedDate?: string | null,
  inUseDays?: number | null
): number | null {
  if (!openedDate || !inUseDays || inUseDays <= 0) return null
  const opened = new Date(openedDate).getTime()
  if (Number.isNaN(opened)) return null
  const discardAt = opened + inUseDays * MS_PER_DAY
  return Math.floor((discardAt - Date.now()) / MS_PER_DAY)
}

/**
 * The honest runway: the soonest of "stock runs out", "stock expires", and —
 * when there's no sealed backup — "the open vial must be discarded".
 *
 * The in-use clock only caps the aggregate runway when quantity <= 1 (a single
 * open container, where the discard date genuinely IS the runway). With spare
 * sealed containers on hand, folding it in would fire a false "reorder now" —
 * so for those the discard date is surfaced separately on the card instead
 * (ProductCard), never blended into this number. Nothing here is fabricated.
 */
export function effectiveRunwayDays(p: RunwayInput): number {
  const caps = [daysOfStock(p.quantity, p.usageRatePerDay)]
  const exp = daysUntilExpiration(p.expirationDate)
  if (exp !== null) caps.push(exp)
  const inUse = inUseDaysRemaining(p.openedDate, p.inUseDays)
  if (inUse !== null && p.quantity <= 1) caps.push(inUse)
  return Math.max(0, Math.min(...caps))
}

export type StockStatus = 'out' | 'low' | 'ok'

/**
 * Status against the user's safety buffer (their reserve), not against zero.
 * `low` means "you'd dip below your reserve" — the moment to reorder.
 */
export function stockStatus(
  runwayDays: number,
  bufferDays: number = DEFAULT_SAFETY_BUFFER_DAYS
): StockStatus {
  if (runwayDays <= 0) return 'out'
  if (runwayDays <= bufferDays) return 'low'
  return 'ok'
}

/**
 * What the UI is allowed to CLAIM about an item. `stockStatus` stays the raw
 * engine (known-rate math, also ported server-side); this wraps it with the
 * honesty gate: an alarm may only rest on facts, never on the fallback rate.
 * A fresh box must not greet the user with a warning built on a guess.
 *
 * Facts still cut through for an estimated-rate item:
 *   - 0 on hand is a true stockout ('out'),
 *   - a real expiration date that has passed ('out') or falls inside the
 *     buffer ('low') — expiry is dated fact, not usage guesswork.
 * Everything else with an unknown rate is 'unset': a calm "set usage to
 * track this" state, excluded from alerts and reorder lists.
 */
export type DisplayStatus = StockStatus | 'unset'

export function displayStatus(
  p: RunwayInput,
  bufferDays: number = DEFAULT_SAFETY_BUFFER_DAYS
): DisplayStatus {
  if (p.quantity <= 0) return 'out'
  if (!isRateEstimated(p.usageRatePerDay)) {
    return stockStatus(effectiveRunwayDays(p), bufferDays)
  }
  const exp = daysUntilExpiration(p.expirationDate)
  if (exp !== null && exp <= 0) return 'out'
  if (exp !== null && exp <= bufferDays) return 'low'
  return 'unset'
}

/**
 * The date to reorder by so you still have `bufferDays` of reserve left when the
 * new supply arrives. Returns today if you're already at/under the buffer.
 */
export function reorderByDate(
  runwayDays: number,
  bufferDays: number = DEFAULT_SAFETY_BUFFER_DAYS
): Date {
  const daysUntilReorder = Math.max(0, runwayDays - bufferDays)
  return new Date(Date.now() + daysUntilReorder * MS_PER_DAY)
}

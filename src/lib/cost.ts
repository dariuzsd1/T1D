/**
 * Cost & savings layer (CLAUDE.md §7-V3 / MASTER_SUGGESTIONS §8: "cost/copay/
 * deductible year-end stock-up").
 *
 * Pure math over data the user actually entered — a per-refill copay and a refill
 * cadence. It NEVER guesses a price or a frequency: if either is missing it returns
 * null and the UI simply doesn't count that item (honesty rule, CLAUDE.md §9.1).
 */

const DAYS_PER_YEAR = 365

/** Annualized out-of-pocket for one item, or null if copay/cadence isn't known. */
export function annualCost(
  copay?: number | null,
  refillIntervalDays?: number | null
): number | null {
  if (!copay || copay <= 0) return null
  if (!refillIntervalDays || refillIntervalDays <= 0) return null
  return copay * (DAYS_PER_YEAR / refillIntervalDays)
}

/** Monthly out-of-pocket for one item, or null when it can't be computed. */
export function monthlyCost(
  copay?: number | null,
  refillIntervalDays?: number | null
): number | null {
  const annual = annualCost(copay, refillIntervalDays)
  return annual === null ? null : annual / 12
}

/**
 * Late in the calendar year, if a deductible has been met, buying before Jan 1
 * can avoid re-paying it next year. This is a *qualitative* nudge window only —
 * we never fabricate the dollar amount of any saving.
 */
export function isYearEndStockUpWindow(now: Date = new Date()): boolean {
  return now.getMonth() >= 9 // October (9), November (10), December (11)
}

/** Format a number as USD for display (whole-cent precision). */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Insurance refill-window engine — the product's moat (CLAUDE.md §0, §7-V2).
 *
 * Running out is only half the problem. The other half is that insurance won't
 * let you refill until you've used ~75-90% of your current supply. The painful
 * gap is when you'll run out *before* your plan lets you refill — that's the
 * moment the user needs a heads-up and an override request, days in advance.
 *
 * This module is pure date/number logic: no I/O, no React, no persistence, so
 * it's trivially testable and can run on the client, in an Edge Function, or in
 * a pg_cron job later. It never fabricates a date — if the inputs to compute an
 * eligibility date are missing, it returns null and the UI shows nothing (§9.1).
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** Most US plans allow a refill once ~75% of the days' supply is used. */
export const DEFAULT_REFILL_THRESHOLD = 0.75

export interface RefillRule {
  /** Length of one dispensed supply, in days (e.g. 30 or 90). */
  supplyDays: number
  /**
   * Fraction of the supply that must be used before insurance allows a refill.
   * 0.75 → eligible at day 68 of a 90-day supply. Defaults to 0.75.
   */
  refillThreshold?: number
}

export type RefillState =
  | 'unknown' // not enough data to assess
  | 'eligible-now' // insurance allows a refill today
  | 'covered' // you'll be eligible before you run out — no action needed yet
  | 'gap' // you'll run out BEFORE you're eligible — needs an early-refill override

export interface RefillAssessment {
  state: RefillState
  /** Days until insurance allows a refill (0 = today). null when unknown. */
  daysUntilEligible: number | null
  /** The date insurance allows a refill. null when unknown. */
  eligibleDate: Date | null
  /** For a `gap`, how many days of supply you're short by. 0 otherwise. */
  shortfallDays: number
  /** A plain, supportive one-line summary for the UI. */
  message: string
}

function startOfToday(now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

/** The earliest date insurance will allow a refill, or null if we can't tell. */
export function nextEligibleRefillDate(
  lastFilledDate: string | null | undefined,
  rule: RefillRule | null | undefined
): Date | null {
  if (!lastFilledDate || !rule || !rule.supplyDays || rule.supplyDays <= 0) {
    return null
  }
  const filled = new Date(lastFilledDate).getTime()
  if (Number.isNaN(filled)) return null

  const threshold = rule.refillThreshold ?? DEFAULT_REFILL_THRESHOLD
  const daysUsedBeforeEligible = rule.supplyDays * threshold
  return new Date(filled + daysUsedBeforeEligible * MS_PER_DAY)
}

/** Whole days until a refill is allowed (0 = today, never negative). null if unknown. */
export function daysUntilRefillEligible(
  lastFilledDate: string | null | undefined,
  rule: RefillRule | null | undefined,
  now: Date = new Date()
): number | null {
  const eligible = nextEligibleRefillDate(lastFilledDate, rule)
  if (!eligible) return null
  const diff = eligible.getTime() - startOfToday(now).getTime()
  return Math.max(0, Math.ceil(diff / MS_PER_DAY))
}

/**
 * Reconcile how long the supply lasts against when insurance lets you refill.
 * This is the heart of the moat: surfacing the gap before it bites.
 */
export function assessRefill(
  runwayDays: number,
  lastFilledDate: string | null | undefined,
  rule: RefillRule | null | undefined,
  now: Date = new Date()
): RefillAssessment {
  const eligibleDate = nextEligibleRefillDate(lastFilledDate, rule)
  const daysUntilEligible = daysUntilRefillEligible(lastFilledDate, rule, now)

  if (daysUntilEligible === null || eligibleDate === null) {
    return {
      state: 'unknown',
      daysUntilEligible: null,
      eligibleDate: null,
      shortfallDays: 0,
      message: 'Add your refill cycle to see when you can reorder.',
    }
  }

  if (daysUntilEligible <= 0) {
    return {
      state: 'eligible-now',
      daysUntilEligible: 0,
      eligibleDate,
      shortfallDays: 0,
      message: 'Refill-eligible now. Tap to reorder.',
    }
  }

  // The dangerous case: you run out before insurance lets you refill.
  if (runwayDays < daysUntilEligible) {
    return {
      state: 'gap',
      daysUntilEligible,
      eligibleDate,
      shortfallDays: daysUntilEligible - runwayDays,
      message: `You'll run out ${daysUntilEligible - runwayDays} day${
        daysUntilEligible - runwayDays === 1 ? '' : 's'
      } before your refill date — request an early-refill override.`,
    }
  }

  return {
    state: 'covered',
    daysUntilEligible,
    eligibleDate,
    shortfallDays: 0,
    message: `Refill-eligible in ${daysUntilEligible} day${
      daysUntilEligible === 1 ? '' : 's'
    }.`,
  }
}

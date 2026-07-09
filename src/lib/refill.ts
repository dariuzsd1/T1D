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

/**
 * The two ways real US plans express a refill window:
 *  - 'percent'     → "refill once you've used X% of the supply" (day = supplyDays × X)
 *  - 'days-before' → "refill up to N days before the supply's end" (day = supplyDays − N)
 * Both reduce to "how many days after the last fill you become eligible," so the
 * date math below is shared. Insurance eligibility is anchored to the fill date
 * and the dispensed days-supply on the label, NOT the user's actual burn rate —
 * so both shapes are pure functions of `lastFilledDate` + the rule, never runway.
 */
export type RefillRuleKind = 'percent' | 'days-before'

export interface RefillRule {
  /** Which shape the plan uses. Absent = 'percent' (back-compat + the common case). */
  kind?: RefillRuleKind
  /** Length of one dispensed supply, in days (e.g. 30 or 90). */
  supplyDays: number
  /**
   * ('percent' shape) Fraction of the supply that must be used before insurance
   * allows a refill. 0.75 → eligible at day 68 of a 90-day supply. Defaults to 0.75.
   */
  refillThreshold?: number
  /**
   * ('days-before' shape) How many days before the supply's end a refill is
   * allowed. 10 on a 90-day supply → eligible at day 80. Defaults to 0.
   */
  daysBeforeRunout?: number
}

/**
 * Build a RefillRule from the fields stored on a supply, or null if there isn't
 * enough to compute one (no dispensed-days value). Centralizes what every UI
 * consumer used to hand-assemble as `{ supplyDays: refillIntervalDays }`, and is
 * where the DB's snake_case rule kind (`days_before`) maps to the engine's enum.
 */
export function refillRuleFrom(input: {
  refillIntervalDays?: number | null
  refillRuleKind?: string | null
  refillThresholdPct?: number | null
  refillDaysBefore?: number | null
}): RefillRule | null {
  if (!input.refillIntervalDays || input.refillIntervalDays <= 0) return null
  const kind: RefillRuleKind = input.refillRuleKind === 'days_before' ? 'days-before' : 'percent'
  return {
    kind,
    supplyDays: input.refillIntervalDays,
    refillThreshold:
      input.refillThresholdPct != null && input.refillThresholdPct > 0
        ? input.refillThresholdPct / 100
        : undefined,
    daysBeforeRunout:
      input.refillDaysBefore != null && input.refillDaysBefore >= 0
        ? input.refillDaysBefore
        : undefined,
  }
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

  // Both rule shapes resolve to "days after the fill until eligible."
  let daysUntilEligibleFromFill: number
  if ((rule.kind ?? 'percent') === 'days-before') {
    const before = Math.max(0, rule.daysBeforeRunout ?? 0)
    daysUntilEligibleFromFill = Math.max(0, rule.supplyDays - before)
  } else {
    const threshold = rule.refillThreshold ?? DEFAULT_REFILL_THRESHOLD
    daysUntilEligibleFromFill = rule.supplyDays * threshold
  }
  return new Date(filled + daysUntilEligibleFromFill * MS_PER_DAY)
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

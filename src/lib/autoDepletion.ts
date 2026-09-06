import { daysPerUnitFromRate } from './depletion'

/**
 * Wear-clock auto-depletion (supplement model, not a replacement for manual
 * logging): infers whole wear-cycles elapsed since the last known reference
 * point and how many units that implies, so a supply's count stays roughly
 * honest even if the user never opens the app to log a site/device change.
 *
 * Deliberately narrow, matching CLAUDE.md's "never fabricate a supply level"
 * rule:
 *  - Only fires for genuine wear items. `daysPerUnitFromRate` returns null for a
 *    >1/day consumption rate, which covers test strips and lancets. It does NOT
 *    cover insulin, and this comment used to claim it did: an insulin rate is
 *    containers per day, so 20u/day of a 1000u vial is 0.02 — a fraction, well
 *    under the 1/day cut-off — and a vial was quietly being removed from the
 *    count every 50 days. Anything carrying an in-use discard window is
 *    therefore excluded explicitly below. That is also the only way the two
 *    clocks can agree: `depletion.stockRunwayDays` says a vial on a 28-day
 *    window is worth 28 days, so a 50-day auto-decrement was contradicting the
 *    runway printed next to it. How fast someone actually gets through a vial
 *    depends on dosing we never observe, so the honest answer is not a better
 *    guess here, it is no guess at all.
 *  - Only fires when there IS a real reference date (a manual log, or a prior
 *    auto-depletion run) — no reference point means no elapsed time can be
 *    honestly computed, so nothing happens.
 *  - Never depletes more than what's actually on hand — an empty supply just
 *    reads "out", it never goes negative or claims more usage than existed.
 *  - Advances the reference date by exactly the cycles just accounted for
 *    (not all the way to `now`), preserving the user's real change rhythm
 *    instead of resetting their schedule's phase.
 *
 * A manual log always wins: whoever calls the site/device-change save flow is
 * responsible for resetting the supply's `auto_depleted_through` to that log's
 * date in the same write, so this function never double-counts a cycle the
 * user already told us about by hand.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24

export interface AutoDepletionInput {
  quantity: number
  usageRatePerDay: number
  /** Last date we can confidently measure elapsed cycles from: the most
   *  recent manual log, or the last auto-depletion run. Null = not eligible
   *  yet (no history to anchor the clock to). */
  accountedThrough: string | null
  /** The item's discard window once opened, when it has one. Its presence is
   *  how the app marks a container-tracked drug (insulin), which this function
   *  must not touch — see the exclusion note above. */
  inUseDays?: number | null
}

export interface AutoDepletionResult {
  /** Whole units to decrement now. Always >= 1 when this is returned. */
  unitsToDeplete: number
  /** New `accountedThrough` to persist — advanced by the cycles just
   *  consumed, not snapped to `now`. */
  newAccountedThrough: string
}

export function computeAutoDepletion(
  input: AutoDepletionInput,
  now: Date = new Date()
): AutoDepletionResult | null {
  // A discard window means a container-tracked drug, not a worn device. How
  // fast one is actually used comes down to dosing we never see, so this
  // declines rather than inventing a cycle for it.
  if (input.inUseDays != null && input.inUseDays > 0) return null
  const wearDays = daysPerUnitFromRate(input.usageRatePerDay)
  if (wearDays === null || wearDays <= 0) return null
  if (!input.accountedThrough) return null
  if (input.quantity <= 0) return null

  const reference = new Date(input.accountedThrough)
  if (Number.isNaN(reference.getTime())) return null

  const elapsedDays = Math.floor((now.getTime() - reference.getTime()) / MS_PER_DAY)
  const cyclesElapsed = Math.floor(elapsedDays / wearDays)
  if (cyclesElapsed <= 0) return null

  const unitsToDeplete = Math.min(cyclesElapsed, input.quantity)
  const newAccountedThrough = new Date(
    reference.getTime() + unitsToDeplete * wearDays * MS_PER_DAY
  ).toISOString()

  return { unitsToDeplete, newAccountedThrough }
}

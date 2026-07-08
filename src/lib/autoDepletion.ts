import { daysPerUnitFromRate } from './depletion'

/**
 * Wear-clock auto-depletion (supplement model, not a replacement for manual
 * logging): infers whole wear-cycles elapsed since the last known reference
 * point and how many units that implies, so a supply's count stays roughly
 * honest even if the user never opens the app to log a site/device change.
 *
 * Deliberately narrow, matching CLAUDE.md's "never fabricate a supply level"
 * rule:
 *  - Only fires for genuine wear items — `daysPerUnitFromRate` already returns
 *    null for a >1/day consumption rate (test strips, insulin), so those are
 *    never touched here.
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

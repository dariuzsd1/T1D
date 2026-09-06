/**
 * How often this user ACTUALLY changes a wear item, measured from their own
 * logged history rather than assumed from the box.
 *
 * Every rate in the catalog is the label figure: a Dexcom G7 lasts 10 days, a
 * pod 3. Those are what the manufacturer promises when nothing goes wrong.
 * Sensors fail early, pods get knocked off, cannulas kink, sites go sore. A DME
 * ships exactly 30 days of pods for 30 days, so a forecast that assumes a clean
 * run is optimistic for anyone who has a bad month, and optimistic in the one
 * direction that matters: it says reorder later than you should.
 *
 * The tempting fix is to bake a failure percentage into the catalog. That would
 * be a fabrication. Published failure rates vary wildly by product, cohort and
 * study, none of them describe THIS person, and a number nobody can source is
 * exactly what the flat 28-day discard window and the 1/72 pod rate were.
 *
 * We do not have to guess, because the app already records the answer.
 * `site_changes` stores a dated row every time a site or sensor is changed, with
 * the supply it came from. The gaps between those dates are this user's real
 * replacement cadence, failures and all. Nothing here invents anything: with too
 * little history it returns null and the label stands.
 *
 * Deliberately conservative, in three ways:
 *
 *   - MEDIAN, not mean. One holiday where nothing got logged would drag a mean
 *     upwards and make the forecast rosier; a median shrugs it off.
 *   - A minimum number of intervals, so a single early failure does not rewrite
 *     someone's runway.
 *   - `effectiveWearRate` only ever lets the measurement SHORTEN the runway. If
 *     someone stretches sensors past the label, that is between them and their
 *     endo; the app is not going to promise them supply on the strength of it.
 *     Same rule the shipping lead time follows: it can only add reserve.
 */

import { effectiveRatePerDay } from './depletion'

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** Intervals needed before a measurement is allowed to move anything. */
export const MIN_OBSERVED_INTERVALS = 3

/** Only the most recent changes count, so an old habit cannot outvote a current one. */
export const OBSERVED_WINDOW = 10

export interface ObservedWear {
  /** Median whole days between consecutive logged changes. */
  medianDays: number
  /** How many intervals the median rests on. Never below MIN_OBSERVED_INTERVALS. */
  intervals: number
  /** The daily rate that cadence implies (1 / medianDays). */
  ratePerDay: number
}

/**
 * The user's measured replacement cadence, or null when there is not enough
 * history to say. Dates may arrive in any order and any format `Date` accepts;
 * unparseable ones are dropped rather than guessed at.
 *
 * `labelWearDays`, when given, bounds what counts as one wear cycle. A gap of
 * five times the label is somebody who stopped logging for a while, not a sensor
 * that lasted fifty days, and folding it in would make the forecast rosier on
 * the strength of missing data. Those gaps are skipped, not clamped: pretending
 * a 60-day silence was a 30-day wear would be inventing a cycle that never
 * happened.
 */
export function observedWear(
  appliedDates: readonly string[],
  labelWearDays?: number | null,
): ObservedWear | null {
  const days = appliedDates
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)
  if (days.length < MIN_OBSERVED_INTERVALS + 1) return null

  // Most recent changes only: one more date than intervals we want to keep.
  const recent = days.slice(-(OBSERVED_WINDOW + 1))

  const maxGap = labelWearDays && labelWearDays > 0 ? labelWearDays * 5 : Infinity
  const intervals: number[] = []
  for (let i = 1; i < recent.length; i++) {
    const gap = Math.round((recent[i] - recent[i - 1]) / MS_PER_DAY)
    // A same-day duplicate log is not a wear cycle either.
    if (gap <= 0 || gap > maxGap) continue
    intervals.push(gap)
  }
  if (intervals.length < MIN_OBSERVED_INTERVALS) return null

  intervals.sort((a, b) => a - b)
  const mid = Math.floor(intervals.length / 2)
  const medianDays =
    intervals.length % 2 === 0 ? (intervals[mid - 1] + intervals[mid]) / 2 : intervals[mid]
  if (medianDays <= 0) return null

  return { medianDays, intervals: intervals.length, ratePerDay: 1 / medianDays }
}

/**
 * The rate a forecast should actually use: the label, or the user's measured
 * cadence when that is faster.
 *
 * One-directional on purpose. Getting through supplies quicker than the box
 * claims is the case that leaves someone short, so it moves the number; lasting
 * longer than the box claims does not, because a forecast built on stretching a
 * sensor is a promise the app cannot keep. An unknown label rate (0) is left
 * alone entirely, so an item whose runway is already a labelled estimate does
 * not quietly acquire a real-looking rate through the back door.
 */
export function effectiveWearRate(
  labelRatePerDay: number,
  observed: ObservedWear | null,
): number {
  // Delegates rather than restating the rule: the same combination has to happen
  // inside the depletion engine, which the Edge Function shares, and two copies
  // of a rule is how the app and the push channel drifted apart before.
  return effectiveRatePerDay(labelRatePerDay, observed?.ratePerDay ?? null)
}

/**
 * Is the measurement actually saying something different from the box? Used to
 * decide whether the user is told their forecast rests on their own history
 * rather than the label. A cadence that matches the label needs no explanation.
 */
export function observedDiffersFromLabel(
  labelRatePerDay: number,
  observed: ObservedWear | null,
): boolean {
  return effectiveWearRate(labelRatePerDay, observed) > labelRatePerDay
}

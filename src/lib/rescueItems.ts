/**
 * Emergency / rescue supplies — the class of items where EXPIRY is the whole
 * game, not daily usage. Glucagon, ketone strips, and fast-acting hypo carbs are
 * reached for during a crisis; you can't discover they're expired at that
 * moment. So the app treats them differently from a consumable like pods:
 *
 *   - status is driven by the expiration date, not a usage-rate runway;
 *   - the "set a usage rate" nudge is suppressed (daily usage is meaningless);
 *   - the expiry warning fires far earlier than the normal reorder buffer, so
 *     there's ample time to replace a rescue med before it lapses.
 *
 * Identification is two-channel (CLAUDE.md honesty: use real data first). The
 * real product `category` is used when present (persisted from the catalog on
 * add); for older items with no stored category we fall back to matching known
 * rescue product names/brands — the same pragmatic keyword approach as
 * `reorderTargetFor` in suppliers.ts. Pure module: no I/O, trivially testable.
 */

import {
  daysUntilExpiration,
  displayStatus,
  effectiveRunwayDays,
  isRateEstimated,
  type DisplayStatus,
  type RunwayInput,
} from './depletion'

export type RescueKind = 'glucagon' | 'ketone' | 'hypo'

/** Real product categories (as stored on a supply) that map to a rescue kind. */
const CATEGORY_TO_KIND: Record<string, RescueKind> = {
  glucagon: 'glucagon',
  ketone_supply: 'ketone',
  hypo_treatment: 'hypo',
}

/** Name/brand keyword fallback for items with no stored category. Ordered:
 *  glucagon first (highest stakes), so a "glucagon gel" reads as glucagon. */
const NAME_PATTERNS: { kind: RescueKind; re: RegExp }[] = [
  { kind: 'glucagon', re: /glucagon|baqsimi|gvoke|zegalogue|glucagen|dasiglucagon/i },
  { kind: 'ketone', re: /ketone|ketostix|keto-?mojo|beta-?hydroxybutyrate/i },
  { kind: 'hypo', re: /glucose (tab|gel|shot|liquid|chew)|glucose tablets|dex4|hypo(?:glycemia|-treatment)/i },
]

/**
 * How many days before expiry a rescue item starts warning. Deliberately far
 * longer than a normal reorder buffer — a rescue med must never quietly lapse.
 * Glucagon gets the longest lead (hardest to reorder, highest stakes).
 */
export const RESCUE_EXPIRY_WARN_DAYS: Record<RescueKind, number> = {
  glucagon: 60,
  ketone: 45,
  hypo: 30,
}

export interface RescueItemInput {
  category?: string | null
  name?: string | null
  brand?: string | null
}

/** The rescue kind for an item, or null if it isn't a rescue supply. Category
 *  wins; name/brand is the fallback for items with no stored category. */
export function rescueKindOf(item: RescueItemInput): RescueKind | null {
  const cat = item.category?.trim().toLowerCase()
  if (cat && CATEGORY_TO_KIND[cat]) return CATEGORY_TO_KIND[cat]
  const haystack = `${item.name ?? ''} ${item.brand ?? ''}`
  for (const { kind, re } of NAME_PATTERNS) {
    if (re.test(haystack)) return kind
  }
  return null
}

export function isRescueItem(item: RescueItemInput): boolean {
  return rescueKindOf(item) !== null
}

/**
 * Is "how many of these do you get through in a day?" a real question here?
 *
 * Not for glucagon: you hope never to use it, and one use empties the device.
 * Not for ketone strips either, which are reached for when someone is ill or
 * running high, so a daily average describes nobody. But fast carbs are
 * genuinely eaten, by anyone who has hypos, and a tube runs out.
 *
 * The app used to ask about all three and then ignore every answer, because
 * status came from expiry alone. Six tablets left with a stated 4-a-day habit
 * read as "well stocked": a day and a half of hypo treatment, presented as fine.
 * This is the line that decides who gets asked and whose answer counts.
 */
export function tracksDailyUse(item: RescueItemInput): boolean {
  const kind = rescueKindOf(item)
  return kind === null || kind === 'hypo'
}

/**
 * Should this item's headline be its expiry date rather than a runway?
 *
 * Yes for glucagon and ketones always, and for fast carbs until someone tells us
 * how quickly they go through them: with no rate there is no runway to show, so
 * the date is all there honestly is. Once a rate IS known, a tube of glucose
 * tabs is an ordinary consumable that also happens to expire, and
 * effectiveRunwayDays already reports the sooner of the two.
 */
export function rescueLeadsWithExpiry(
  item: RescueItemInput & { usageRatePerDay?: number | null }
): boolean {
  if (!isRescueItem(item)) return false
  return !tracksDailyUse(item) || isRateEstimated(item.usageRatePerDay)
}

/** Urgency order, so two real clocks can be combined by taking the worse one. */
const URGENCY: Record<DisplayStatus, number> = { unset: 0, ok: 1, low: 2, out: 3 }
const worse = (a: DisplayStatus, b: DisplayStatus): DisplayStatus =>
  (URGENCY[a] >= URGENCY[b] ? a : b)

/**
 * Status for a rescue item, driven purely by its expiration date:
 *   - no quantity on hand              → 'out' (you don't have one)
 *   - no expiry recorded               → 'unset' (prompt to add the date, NOT a
 *                                         usage rate)
 *   - already expired                  → 'out'
 *   - expiring within the kind's warn  → 'low'
 *   - otherwise                        → 'ok'
 */
export function rescueExpiryStatus(
  item: RescueItemInput & { quantity: number; expirationDate?: string | null },
  now: Date = new Date()
): DisplayStatus {
  if (item.quantity <= 0) return 'out'
  const days = daysUntilExpiration(item.expirationDate, now)
  if (days === null) return 'unset'
  if (days <= 0) return 'out'
  const kind = rescueKindOf(item)
  const warn = kind ? RESCUE_EXPIRY_WARN_DAYS[kind] : RESCUE_EXPIRY_WARN_DAYS.hypo
  return days <= warn ? 'low' : 'ok'
}

/**
 * The single status resolver every surface should use: a rescue item is judged
 * on expiry (ignoring usage runway + shipping lead time, which don't apply);
 * everything else uses the normal usage/expiry depletion status. Keeps the whole
 * app consistent from one call.
 */
export function itemDisplayStatus(
  item: RunwayInput & RescueItemInput,
  bufferDays?: number,
  leadTimeDays: number = 0,
  now: Date = new Date()
): DisplayStatus {
  if (!isRescueItem(item)) return displayStatus(item, bufferDays, leadTimeDays, now)

  const byExpiry = rescueExpiryStatus({ ...item, quantity: item.quantity }, now)
  if (rescueLeadsWithExpiry(item)) return byExpiry

  // Fast carbs with a rate the user actually gave us: BOTH clocks are real, so
  // neither may quietly win. Take the more urgent. Expiry keeps its long rescue
  // warning, because a tube must never lapse unnoticed, and running low now
  // shows up as well, which it could not before. 'unset' loses to anything, so a
  // missing expiry date can no longer hide a real shortage.
  return worse(byExpiry, displayStatus(item, bufferDays, leadTimeDays, now))
}

/**
 * Sentinel for "there is nothing here to act on". Sorts last, and stays a finite
 * number so a subtracting comparator cannot hand back NaN and scramble the list,
 * which Infinity would do the moment two such items met.
 */
export const NO_ACTION_NEEDED = 1e9

/**
 * Days until this item needs acting on. The honest sort key for "most urgent".
 *
 * Home used to rank by `remainingDays` alone, and for a rescue item that number
 * is the 1-a-day fallback, because rescue items have no usage rate. So a
 * glucagon pen with fifty good days left reported a runway of 1 and outranked
 * pods running out in three. That did not just mis-word the headline: Home's
 * primary button is `reorderTargetFor(mostUrgent)`, so the one action on the
 * screen pointed at the glucagon.
 *
 * The fix is to rank by whatever actually makes an item urgent, which is the
 * same thing its status is computed from:
 *
 *   - nothing on hand    -> 0. You have none; it does not matter what kind it is.
 *   - judged on expiry   -> days until it expires (negative once it has lapsed,
 *                           so an expired rescue med sorts to the very front).
 *   - judged on usage    -> its runway, which already caps itself at the expiry.
 *   - no expiry recorded -> NO_ACTION_NEEDED. Its status is 'unset' anyway, so
 *                           it is filtered out before this matters.
 */
export function daysUntilActionNeeded(
  item: RunwayInput & RescueItemInput,
  now: Date = new Date()
): number {
  if (item.quantity <= 0) return 0
  if (!rescueLeadsWithExpiry(item)) return effectiveRunwayDays(item, now)
  const exp = daysUntilExpiration(item.expirationDate, now)
  return exp === null ? NO_ACTION_NEEDED : exp
}

/** Comparator for `Array.prototype.sort`: soonest action first. */
export function byUrgency(now: Date = new Date()) {
  return (a: RunwayInput & RescueItemInput, b: RunwayInput & RescueItemInput) =>
    daysUntilActionNeeded(a, now) - daysUntilActionNeeded(b, now)
}

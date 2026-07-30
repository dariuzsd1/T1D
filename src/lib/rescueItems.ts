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

import { daysUntilExpiration, displayStatus, type DisplayStatus, type RunwayInput } from './depletion'

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
  if (isRescueItem(item)) {
    return rescueExpiryStatus({ ...item, quantity: item.quantity }, now)
  }
  return displayStatus(item, bufferDays, leadTimeDays)
}

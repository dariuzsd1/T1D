/**
 * Reorder-loop tracking — the honest half of "closing the loop" that's buildable
 * without a supplier API (CLAUDE.md §0: the moat needs a closed reorder loop, but
 * true one-tap ordering is vendor-blocked). Today "Reorder" only hands the user
 * off to a supplier's site; this module lets the app remember that a hand-off
 * happened, so it can stop nagging about something the user already acted on
 * without ever hiding a real problem.
 *
 * Honesty rule (CLAUDE.md §9.1): a "Mark as ordered" note only softens the
 * proactive nags (banner, push) for a *low* item — it never hides a true
 * stockout, and it never fabricates a delivery date. It's the user's own report
 * of their own action, not a guess about the world.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** How many days a "marked as ordered" note keeps the urgent banner/push quiet for
 *  this item before it resumes nagging — generous enough to cover normal DME
 *  shipping, conservative enough that an order that never actually arrived gets
 *  flagged again rather than going quiet forever. */
export const ORDER_GRACE_DAYS = 10

/** True while a reported order is still within its grace window. */
export function isOrderPending(
  lastOrderedDate: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!lastOrderedDate) return false
  const ordered = new Date(lastOrderedDate).getTime()
  if (Number.isNaN(ordered)) return false
  const daysSince = (now.getTime() - ordered) / MS_PER_DAY
  return daysSince >= 0 && daysSince <= ORDER_GRACE_DAYS
}

/** Whole days since the order was marked, for display ("Ordered 3 days ago").
 *  Null when there's nothing to report or the note has expired. */
export function daysSinceOrdered(
  lastOrderedDate: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!isOrderPending(lastOrderedDate, now)) return null
  const ordered = new Date(lastOrderedDate!).getTime()
  return Math.max(0, Math.floor((now.getTime() - ordered) / MS_PER_DAY))
}

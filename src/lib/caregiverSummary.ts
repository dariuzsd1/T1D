import {
  DEFAULT_SAFETY_BUFFER_DAYS,
  displayStatus,
  effectiveLeadTimeDays,
  effectiveRunwayDays,
  type DisplayStatus,
} from '@/lib/depletion'
import type { Product } from '@/lib/store'

/**
 * What a caregiver needs from someone else's inventory.
 *
 * The parent view answers a different question from the patient's own screens.
 * A patient browses; a parent wants one thing: **is anything about to run out,
 * and do I need to do something about it this week?** Answering that badly is
 * worse than not answering, because a parent who is told "everything's covered"
 * stops looking.
 *
 * The numbers therefore come from the same engine the patient sees. An earlier
 * version of the parent view computed its own, and drifted in three ways that
 * all pointed the same, wrong way — it showed MORE comfort than the patient had:
 *   - it rounded the runway where the engine floors, so 4.6 days read as 5;
 *   - it ignored per-item delivery time, so an item the patient was told to
 *     reorder still looked fine to the parent;
 *   - it dropped openedDate/inUseDays, so an opened vial's discard date never
 *     capped anything.
 */

/** Everything the parent view needs about one item. */
export interface CaregiverItem {
  product: Product
  /** Quantity after any optimistic local edit. */
  quantity: number
  runwayDays: number
  status: DisplayStatus
}

export interface CaregiverSummary {
  items: CaregiverItem[]
  outCount: number
  lowCount: number
  /** Fewest days left among items that are actually alarming. */
  mostUrgent: CaregiverItem | null
  /** Items whose runway falls inside the window a parent can act within. */
  actingSoon: CaregiverItem[]
  overall: 'good' | 'watch' | 'act'
}

/** A parent plans in weeks, so "do I need to act" means "within seven days". */
export const ACT_WINDOW_DAYS = 7

export function summarizeForCaregiver(
  inventory: Product[],
  quantityOverrides: Record<string, number> = {},
  bufferDays: number = DEFAULT_SAFETY_BUFFER_DAYS,
  accountLeadTimeDays?: number,
): CaregiverSummary {
  const items: CaregiverItem[] = inventory.map((product) => {
    const quantity = quantityOverrides[product.id] ?? product.quantity
    // Same inputs the patient's own view uses, including the in-use clock.
    const input = {
      quantity,
      usageRatePerDay: product.usageRatePerDay,
      expirationDate: product.expirationDate,
      openedDate: product.openedDate,
      inUseDays: product.inUseDays,
    }
    const lead = effectiveLeadTimeDays(product, accountLeadTimeDays)
    return {
      product,
      quantity,
      runwayDays: effectiveRunwayDays(input),
      status: displayStatus(input, bufferDays, lead),
    }
  })

  const alarming = items
    .filter((i) => i.status === 'out' || i.status === 'low')
    .sort((a, b) => a.runwayDays - b.runwayDays)

  const outCount = items.filter((i) => i.status === 'out').length
  const lowCount = items.filter((i) => i.status === 'low').length

  return {
    items,
    outCount,
    lowCount,
    mostUrgent: alarming[0] ?? null,
    // "Out" always counts: it needs acting on today, not in seven days.
    actingSoon: alarming.filter((i) => i.status === 'out' || i.runwayDays <= ACT_WINDOW_DAYS),
    overall: outCount > 0 ? 'act' : lowCount > 0 ? 'watch' : 'good',
  }
}

/**
 * The date an item runs out, as a real date rather than a day count. "Runs out
 * Thursday" is actionable; "4 days left" makes a parent do arithmetic before
 * they can decide whether it collides with the weekend.
 */
export function runOutDate(runwayDays: number, from: Date = new Date()): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + Math.max(0, runwayDays))
  return d
}

/**
 * Duplicate-supply policy: is a scanned box one the user already holds, and what
 * is a merged inventory row allowed to claim about itself?
 *
 * Pure and dependency-free, like `gs1`/`ppn`/`depletion`, because these rules are
 * safety-critical and belong under test rather than inline in a React component:
 *
 *  - A merged row physically contains BOTH boxes, so it must describe the worse
 *    case. It carries the EARLIEST expiry; claiming the later one would
 *    over-promise on the older stock and break the depletion engine's rule that a
 *    runway is never more optimistic than reality.
 *  - Once two lots sit in one row it can no longer claim a single lot number, or a
 *    recall check would read a lot the row may not actually contain.
 *  - A different expiry or lot is positive evidence these are DIFFERENT physical
 *    boxes, which the UI uses to steer toward a separate entry (preserving
 *    first-expiry-first-out rotation and lot traceability). An *unknown* value is
 *    never treated as evidence of difference.
 */

/** The inventory row already on file for this code. */
export interface StoredSupply {
  quantity: number
  /** ISO YYYY-MM-DD, or null when the row has no expiry on file. */
  expirationDate: string | null
  lotNumber: string | null
}

/** What was just read off the box being scanned. */
export interface ScannedBox {
  /** ISO YYYY-MM-DD, or null/undefined when the code carried no date. */
  expirationDate?: string | null
  lot?: string | null
}

/**
 * The earlier of two ISO (YYYY-MM-DD) dates, ignoring unknowns. ISO dates sort
 * lexicographically, so a string compare is correct and timezone-free.
 */
export function earliestDate(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

/**
 * Which stored columns identify this box, in priority order. A GTIN is the
 * strongest key; the German PZN is the fallback for medicines that carry no GTIN.
 */
export function duplicateLookupKeys(
  code: { gtin?: string | null; pzn?: string | null }
): ['barcode' | 'pzn', string][] {
  const keys: ['barcode' | 'pzn', string][] = []
  if (code.gtin) keys.push(['barcode', code.gtin])
  if (code.pzn) keys.push(['pzn', code.pzn])
  return keys
}

export interface BoxComparison {
  /** Both expiries are known and disagree. */
  mixedExpiry: boolean
  /** Both lots are known and disagree. */
  mixedLot: boolean
  /** The scanned box is demonstrably NOT the stored one. */
  differentBox: boolean
}

/**
 * Compare a scanned box against the stored row. Only a KNOWN mismatch counts as
 * evidence of a different box; a missing date or lot proves nothing either way.
 */
export function compareBox(stored: StoredSupply, scanned: ScannedBox): BoxComparison {
  const mixedExpiry = !!(
    stored.expirationDate && scanned.expirationDate && stored.expirationDate !== scanned.expirationDate
  )
  const mixedLot = !!(stored.lotNumber && scanned.lot && stored.lotNumber !== scanned.lot)
  return { mixedExpiry, mixedLot, differentBox: mixedExpiry || mixedLot }
}

export interface RestockPlan {
  /** The merged on-hand count. */
  quantity: number
  /**
   * Present ONLY when the merged row must adopt an expiry different from the one
   * it already stores, so an unchanged date is never rewritten.
   */
  expirationDate?: string
  /** The row now spans two lots and may no longer claim either. */
  clearLot: boolean
}

/**
 * What to write when merging a scanned box into an existing row. `addQuantity` is
 * clamped to at least 1 so a blank quantity field can never record a no-op restock.
 */
export function planRestock(
  stored: StoredSupply,
  scanned: ScannedBox,
  addQuantity: number
): RestockPlan {
  const added = Number.isFinite(addQuantity) && addQuantity > 0 ? Math.floor(addQuantity) : 1
  const { mixedLot } = compareBox(stored, scanned)
  const merged = earliestDate(stored.expirationDate, scanned.expirationDate ?? null)
  const plan: RestockPlan = {
    quantity: stored.quantity + added,
    clearLot: mixedLot,
  }
  // `merged` can only differ from the stored value by being a real, earlier date.
  if (merged !== stored.expirationDate && merged) plan.expirationDate = merged
  return plan
}

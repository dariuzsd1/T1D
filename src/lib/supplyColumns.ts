/**
 * The one place that decides which product facts land on a new supply row.
 *
 * Both intake paths -- the scan page and the starter kits -- insert the core
 * columns first and then write the optional ones in a best-effort follow-up
 * update, so a database missing a column can never break the add itself. That
 * shape is right. Having each path hand-roll its own payload was not: the two
 * drifted every single time a column was added, and nothing failed loudly
 * because a missing optional column just reads NULL.
 *
 * Six instances of exactly that, all found by querying a real database rather
 * than by running the test suite:
 *
 *   - in_use_days, written by neither path at first, so no insulin had a
 *     discard window;
 *   - catalog_refill_interval_days, written by the scan path only, so anything
 *     from onboarding had no refill-eligible date and the feature CLAUDE.md
 *     calls the moat was dark for every kit user;
 *   - usage_rate_per_day, missing on rows old enough to predate it;
 *   - category, passed to the zustand store by the scan path but never written
 *     to the row, which quietly demoted rescue detection to keyword matching;
 *   - discontinued, written by the scan path only -- and three of the five CGM
 *     starter kits build from products Abbott and Dexcom have discontinued, so
 *     the "ask for a replacement" override in refillList never fired and the
 *     app kept telling people to reorder a sensor nobody makes;
 *   - the kit product NAMES themselves, which did not match the catalog at all.
 *
 * So the mapping lives here once. A new column is added to `COLUMN_OF` and both
 * paths get it, and `supplyColumns.test.ts` fails if a fact is declared without
 * a column to go in.
 */

/**
 * Everything we might know about a supply at the moment it is created, in the
 * app's own camelCase terms. Every field is optional because each intake path
 * knows a different subset: a scan has a barcode and a lot number, a starter
 * kit has neither and never will.
 */
export interface SupplyFacts {
  /** Catalog category ('cgm_sensor', 'glucagon', ...). Drives rescue detection. */
  category?: string | null
  /** Containers (or units) per day. 0/null leaves the runway a labelled estimate. */
  usageRatePerDay?: number | null
  /** Days an opened container stays usable. */
  inUseDays?: number | null
  /** The catalog's TYPICAL dispensing cycle. Never the user's own figure. */
  catalogRefillIntervalDays?: number | null
  /** The manufacturer has stopped making it. */
  discontinued?: boolean | null
  /** GS1 GTIN read from the box. */
  barcode?: string | null
  /** German Pharmazentralnummer, for EU medicine codes with no GTIN. */
  pzn?: string | null
  /** Lot number read from the box, for recall checks. */
  lotNumber?: string | null
}

/**
 * Fact -> column. The complete list; `supplyColumns` writes nothing else, and
 * the test asserts every key of SupplyFacts appears here.
 */
export const COLUMN_OF: Record<keyof SupplyFacts, string> = {
  category: 'category',
  usageRatePerDay: 'usage_rate_per_day',
  inUseDays: 'in_use_days',
  catalogRefillIntervalDays: 'catalog_refill_interval_days',
  discontinued: 'discontinued',
  barcode: 'barcode',
  pzn: 'pzn',
  lotNumber: 'lot_number',
}

/** 'unknown' is the app's placeholder for an unidentified product, not a category. */
const isRealCategory = (v: unknown) =>
  typeof v === 'string' && v.trim() !== '' && v.trim() !== 'unknown'

/**
 * The payload for the optional-columns update: only facts we actually have.
 *
 * A blank is omitted rather than written as null, so this can never overwrite
 * something already on the row with an absence. `discontinued` is the one
 * exception to "omit falsy": it is a boolean, and only `true` is worth writing
 * since the column defaults to false.
 *
 * Returns an empty object when nothing is known, which both callers already
 * treat as "skip the update entirely".
 */
export function supplyColumns(facts: SupplyFacts): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  if (isRealCategory(facts.category)) out[COLUMN_OF.category] = facts.category!.trim()

  for (const key of ['usageRatePerDay', 'inUseDays', 'catalogRefillIntervalDays'] as const) {
    const v = facts[key]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[COLUMN_OF[key]] = v
  }

  if (facts.discontinued === true) out[COLUMN_OF.discontinued] = true

  for (const key of ['barcode', 'pzn', 'lotNumber'] as const) {
    const v = facts[key]
    if (typeof v === 'string' && v.trim() !== '') out[COLUMN_OF[key]] = v.trim()
  }

  return out
}

/**
 * One-tap reorder hand-off (CLAUDE.md §7-V2: "deep-links first, then real
 * integrations").
 *
 * We don't have supplier API integrations yet, so the honest first step is a
 * deep link: open the right manufacturer/DME reorder page in a new tab. This is
 * a hand-off, not an automated order — the UI labels it as such. Brands we don't
 * recognize fall back to a web search so the button is never a dead end.
 */

export interface ReorderTarget {
  url: string
  /** Where the tap sends them, e.g. "Omnipod" or "find a supplier". */
  label: string
  /** true = a known manufacturer/DME page; false = a search fallback. */
  isDirect: boolean
}

/** Known manufacturer / DME reorder pages, matched on brand keywords. */
const SUPPLIER_LINKS: { match: RegExp; label: string; url: string }[] = [
  { match: /omnipod|insulet/i, label: 'Omnipod', url: 'https://www.omnipod.com/podder-resources' },
  { match: /dexcom|g6|g7/i, label: 'Dexcom', url: 'https://www.dexcom.com/order' },
  { match: /tandem|t:slim|tslim|control-?iq/i, label: 'Tandem', url: 'https://www.tandemdiabetes.com/support/order-supplies' },
  { match: /libre|freestyle|abbott/i, label: 'FreeStyle Libre', url: 'https://www.freestyle.abbott/us-en/order.html' },
  { match: /medtronic|guardian|minimed/i, label: 'Medtronic', url: 'https://www.medtronicdiabetes.com/products/order-supplies' },
]

/** Large DME distributors, offered as a generic hand-off for any supply. */
export const DME_SUPPLIERS: { label: string; url: string }[] = [
  { label: 'Edgepark', url: 'https://www.edgepark.com' },
  { label: 'Byram Healthcare', url: 'https://www.byramhealthcare.com' },
  { label: 'US MED', url: 'https://www.usmed.com' },
  { label: 'CCS Medical', url: 'https://www.ccsmed.com' },
]

/**
 * Pick the best reorder destination for an item. Matches on brand first, then
 * name, and falls back to a web search so the action always goes somewhere.
 */
export function reorderTargetFor(item: { brand?: string; name?: string }): ReorderTarget {
  const haystack = `${item.brand ?? ''} ${item.name ?? ''}`
  for (const s of SUPPLIER_LINKS) {
    if (s.match.test(haystack)) {
      return { url: s.url, label: s.label, isDirect: true }
    }
  }
  const query = encodeURIComponent(`${item.brand ?? ''} ${item.name ?? ''} reorder supplies`.trim())
  return {
    url: `https://www.google.com/search?q=${query}`,
    label: 'find a supplier',
    isDirect: false,
  }
}

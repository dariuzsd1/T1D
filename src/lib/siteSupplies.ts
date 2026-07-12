/**
 * "Is this supply worn or inserted at a rotating body site?" — used by the site
 * tracker's log dialog so its supply picker only offers things that actually go
 * into or onto the body at a site (CGM sensors, pump pods, infusion sets), not
 * emergency/oral items (glucagon like Baqsimi, glucose tabs), test strips,
 * lancets, insulin pens, or reservoirs/cartridges (which live inside the pump,
 * not at a site on the body).
 *
 * Matched on the supply's name + brand because the loaded inventory does not
 * carry a reliable per-supply category (the API returns a constant). Extends the
 * same brand-matching approach used in quickActions.ts and suppliers.ts. Pure so
 * it can be unit-tested and reused.
 */

// CGM sensors, pump pods, and infusion sets / cannulas. Word-boundary aware so
// "pods" matches but an unrelated word does not. Deliberately does NOT include
// reservoir/cartridge (internal to the pump) or pen/needle/syringe/lancet.
const WORN_SITE_RE =
  /\b(?:pods?|omnipod|insulet|dexcom|g[67]|guardian|libre|freestyle|cgm|sensors?|enlite|stelo|simplera|infusion|cannula|inset|quick[- ]?set|autosoft|silhouette|sure[- ]?t|mio)\b/i

export function isSiteSupply(item: { name?: string | null; brand?: string | null }): boolean {
  return WORN_SITE_RE.test(`${item.name ?? ''} ${item.brand ?? ''}`)
}

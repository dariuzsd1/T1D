import { createClient } from '@/lib/supabase/server'

export interface CatalogProduct {
  product_name: string
  brand: string | null
  category: string | null
  unit: string | null
  units_per_box: number | null
  typical_usage_per_day: number | null
  default_refill_interval_days: number | null
}

const PRODUCT_COLUMNS =
  'product_name, brand, category, unit, units_per_box, typical_usage_per_day, default_refill_interval_days'

export async function lookupProductByGtin(gtin: string): Promise<CatalogProduct | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('gtin', gtin)
    .maybeSingle()
  return data ?? null
}

/** Lowercase and strip everything but letters/digits so "Omnipod 5", "omnipod5",
 *  and "OP 5" all collapse to the same key. */
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Identify a typed product by an EXACT normalized match against the catalog's
 * product name or its curated `common_names` aliases (e.g. "g7|dexcom g7|dex g7").
 * This is identification, not fuzzy guessing: we only return a product when the
 * typed text equals a known name/alias, so applying that product's verified wear
 * rate stays honest (CLAUDE.md §9 — never fabricate). Returns null on no match.
 */
export async function lookupProductByName(name: string): Promise<CatalogProduct | null> {
  const target = normalizeName(name)
  if (!target) return null

  const supabase = await createClient()
  // The catalog is ~100 rows; pull the matchable columns and resolve in JS so the
  // alias comparison is exact rather than a fuzzy SQL ILIKE.
  const { data } = await supabase
    .from('products')
    .select(`${PRODUCT_COLUMNS}, common_names`)

  if (!data) return null

  for (const row of data as (CatalogProduct & { common_names: string | null })[]) {
    const names = [row.product_name, ...(row.common_names?.split('|') ?? [])]
      .map(normalizeName)
      .filter(Boolean)
    if (names.includes(target)) {
      const { common_names, ...product } = row
      void common_names
      return product
    }
  }
  return null
}

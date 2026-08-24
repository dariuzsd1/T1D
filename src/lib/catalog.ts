import { createClient } from '@/lib/supabase/server'

export interface CatalogProduct {
  product_name: string
  brand: string | null
  category: string | null
  unit: string | null
  units_per_box: number | null
  typical_usage_per_day: number | null
  default_refill_interval_days: number | null
  /** The manufacturer has stopped making it: identify it, never suggest reordering. */
  discontinued: boolean | null
}

const PRODUCT_COLUMNS =
  'product_name, brand, category, unit, units_per_box, typical_usage_per_day, default_refill_interval_days, discontinued'

type CodeType = 'gtin' | 'pzn' | 'ndc' | 'cip'

/**
 * Resolve a code via the normalized `product_codes` table (one product ↔ many
 * codes). A hit returns the joined product, with the code row's pack-size
 * override applied when present (a specific GTIN can pin a specific box count).
 * Returns null on no match — the caller then tries the legacy single-code column.
 */
async function lookupViaCodeTable(codeType: CodeType, code: string): Promise<CatalogProduct | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_codes')
    .select(`units_per_box, products ( ${PRODUCT_COLUMNS} )`)
    .eq('code_type', codeType)
    .eq('code', code)
    .maybeSingle()

  const row = data as { units_per_box: number | null; products: CatalogProduct | CatalogProduct[] | null } | null
  if (!row?.products) return null
  // A to-one embed comes back as an object, but tolerate an array shape too.
  const product = Array.isArray(row.products) ? row.products[0] : row.products
  if (!product) return null
  // Pack size specific to this code wins over the product's generic default.
  return row.units_per_box != null ? { ...product, units_per_box: row.units_per_box } : product
}

export async function lookupProductByGtin(gtin: string): Promise<CatalogProduct | null> {
  const viaCodes = await lookupViaCodeTable('gtin', gtin)
  if (viaCodes) return viaCodes

  // Legacy fallback: the single `products.gtin` column, for rows not yet migrated
  // into product_codes.
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('gtin', gtin)
    .maybeSingle()
  return data ?? null
}

/**
 * Resolve a German Pharmazentralnummer (PZN) to its catalog product. This is the
 * national join key for EU-FMD / securPharm medicine barcodes (PPN, an NTIN GTIN
 * that embeds the PZN, or the bare PZN linear barcode) which carry no plain GTIN.
 * Returns null on no match.
 */
export async function lookupProductByPzn(pzn: string): Promise<CatalogProduct | null> {
  const viaCodes = await lookupViaCodeTable('pzn', pzn)
  if (viaCodes) return viaCodes

  // Legacy fallback: the single `products.pzn` column.
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('pzn', pzn)
    .maybeSingle()
  return data ?? null
}

/** Resolve a French CIP via the product_codes table. Null on no match. */
export async function lookupProductByCip(cip: string): Promise<CatalogProduct | null> {
  return lookupViaCodeTable('cip', cip)
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

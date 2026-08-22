import type { SupabaseClient } from '@supabase/supabase-js'
import type { Product } from './store'

export interface NewSupply {
  name: string
  brand?: string
  category?: string
  quantity: number
  /** units/day; 0/undefined leaves the runway a labelled estimate. */
  usageRatePerDay?: number
  expirationDate?: string | null
}

/**
 * Insert one or more supplies for the current user and return them as store
 * Products. Mirrors the scan page's saveSupply: core columns first, then a
 * best-effort update for the optional usage_rate_per_day column so an un-migrated
 * DB can never break the core insert. A single multi-row insert preserves order,
 * so results line up with `items` by index.
 */
export async function createSupplies(
  supabase: SupabaseClient,
  userId: string,
  items: NewSupply[],
): Promise<Product[]> {
  const rows = items.map(it => ({
    user_id: userId,
    name: it.name.trim(),
    brand: it.brand?.trim() || null,
    category_id: null,
    quantity: it.quantity,
    unit: 'pieces',
    expiration_date: it.expirationDate || null,
  }))

  const { data, error } = await supabase.from('supplies').insert(rows).select()
  if (error || !data) throw new Error(error?.message || 'Failed to add supplies')

  // Best-effort per-row optional columns (both optional pre-migration): the usage
  // rate, and the catalog `category` the rescue-item logic keys on. Written
  // separately so a "column does not exist" error can't break the core insert.
  await Promise.all(
    data.map((row: { id: string }, i: number) => {
      const patch: Record<string, unknown> = {}
      const rate = items[i]?.usageRatePerDay ?? 0
      if (rate > 0) patch.usage_rate_per_day = rate
      const category = items[i]?.category?.trim()
      if (category && category !== 'unknown') patch.category = category
      return Object.keys(patch).length
        ? supabase.from('supplies').update(patch).eq('id', row.id)
        : Promise.resolve()
    }),
  )

  return data.map((row: { id: string; name: string; brand: string | null; quantity: number; expiration_date: string | null }, i: number) => ({
    id: row.id,
    name: row.name,
    brand: row.brand || '',
    category: items[i]?.category ?? 'unknown',
    quantity: row.quantity,
    remainingDays: 30, // Recomputed honestly by the store's withRunway().
    lastScanned: new Date().toISOString().split('T')[0],
    usageRatePerDay: items[i]?.usageRatePerDay ?? 0,
    expirationDate: row.expiration_date || null,
  }))
}

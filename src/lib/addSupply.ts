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

  // Best-effort per-row usage rate (the column is optional pre-migration).
  await Promise.all(
    data.map((row: { id: string }, i: number) => {
      const rate = items[i]?.usageRatePerDay ?? 0
      return rate > 0
        ? supabase.from('supplies').update({ usage_rate_per_day: rate }).eq('id', row.id)
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

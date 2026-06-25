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

export async function lookupProductByGtin(gtin: string): Promise<CatalogProduct | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('product_name, brand, category, unit, units_per_box, typical_usage_per_day, default_refill_interval_days')
    .eq('gtin', gtin)
    .maybeSingle()
  return data ?? null
}

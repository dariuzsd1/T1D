import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CATEGORY_ORDER = [
  'cgm_sensor', 'patch_pump', 'infusion_set', 'mdi_supply', 'insulin',
  'bg_supply', 'ketone_supply', 'glucagon', 'hypo_treatment', 'skin_care', 'other',
]

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('product_name, brand, category, units_per_box, default_refill_interval_days, gtin')
    .order('brand', { ascending: true })
    .order('product_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const grouped: Record<string, typeof data> = {}
  for (const row of data ?? []) {
    const cat = row.category ?? 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat]!.push(row)
  }

  const ordered = CATEGORY_ORDER
    .filter(cat => grouped[cat]?.length)
    .map(cat => ({ category: cat, products: grouped[cat]! }))

  // Append any categories not in the canonical order
  for (const cat of Object.keys(grouped)) {
    if (!CATEGORY_ORDER.includes(cat)) {
      ordered.push({ category: cat, products: grouped[cat]! })
    }
  }

  return NextResponse.json(ordered)
}

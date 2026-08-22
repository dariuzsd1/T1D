import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createSupabaseServerMock } from '@/lib/testUtils/supabaseServerMock'
import { lookupProductByGtin, lookupProductByPzn } from './catalog'

function mockTables(tables: Record<string, { data?: unknown; error?: { message: string } | null }>) {
  vi.mocked(createClient).mockResolvedValue(
    createSupabaseServerMock({ user: null, tables }) as never
  )
}

const reservoir = {
  product_name: 'MiniMed Reservoir',
  brand: 'Medtronic',
  category: 'infusion_set',
  unit: 'reservoirs',
  units_per_box: 10,
  typical_usage_per_day: 0.33,
  default_refill_interval_days: 90,
}

beforeEach(() => vi.clearAllMocks())

describe('lookupProductByGtin — product_codes first, legacy fallback', () => {
  it('resolves via product_codes and applies the code-specific pack size', async () => {
    // The scanned carton is 2x20 = 40, overriding the product default of 10.
    mockTables({
      product_codes: { data: { units_per_box: 40, products: reservoir } },
    })
    const p = await lookupProductByGtin('00763000532222')
    expect(p?.product_name).toBe('MiniMed Reservoir')
    expect(p?.units_per_box).toBe(40)
  })

  it('keeps the product default when the code row has no pack-size override', async () => {
    mockTables({
      product_codes: { data: { units_per_box: null, products: reservoir } },
    })
    const p = await lookupProductByGtin('00763000532222')
    expect(p?.units_per_box).toBe(10)
  })

  it('falls back to the legacy products.gtin column when no code row exists', async () => {
    mockTables({
      product_codes: { data: null },
      products: { data: reservoir },
    })
    const p = await lookupProductByGtin('00763000532222')
    expect(p?.product_name).toBe('MiniMed Reservoir')
    expect(p?.units_per_box).toBe(10)
  })

  it('returns null when neither path matches', async () => {
    mockTables({ product_codes: { data: null }, products: { data: null } })
    expect(await lookupProductByGtin('00000000000000')).toBeNull()
  })

  it('tolerates a to-one embed returned as an array', async () => {
    mockTables({ product_codes: { data: { units_per_box: 40, products: [reservoir] } } })
    const p = await lookupProductByGtin('00763000532222')
    expect(p?.product_name).toBe('MiniMed Reservoir')
    expect(p?.units_per_box).toBe(40)
  })
})

describe('lookupProductByPzn — product_codes first, legacy fallback', () => {
  it('resolves a PZN via product_codes with its pack size', async () => {
    const humalog = { ...reservoir, product_name: 'Humalog 100 (5x10 ml vials, DE)', unit: 'vials', units_per_box: 1 }
    mockTables({ product_codes: { data: { units_per_box: 5, products: humalog } } })
    const p = await lookupProductByPzn('07242491')
    expect(p?.product_name).toBe('Humalog 100 (5x10 ml vials, DE)')
    expect(p?.units_per_box).toBe(5)
  })

  it('falls back to the legacy products.pzn column', async () => {
    mockTables({ product_codes: { data: null }, products: { data: reservoir } })
    const p = await lookupProductByPzn('07242491')
    expect(p?.product_name).toBe('MiniMed Reservoir')
  })
})

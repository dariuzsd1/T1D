import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createSupabaseServerMock } from '@/lib/testUtils/supabaseServerMock'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { GET } from './route'

function mockProducts(data: unknown) {
  vi.mocked(createClient).mockResolvedValue(
    // No auth needed: the catalog is public reference data.
    createSupabaseServerMock({ user: null, tables: { products: { data, error: null } } }) as never
  )
}

function req(query: string) {
  return new NextRequest(`http://localhost/api/scan/lookup${query}`)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/scan/lookup', () => {
  const g7 = {
    product_name: 'Dexcom G7 Sensor',
    brand: 'Dexcom',
    category: 'cgm_sensor',
    unit: 'sensors',
    units_per_box: 3,
    typical_usage_per_day: 0.1,
    default_refill_interval_days: 90,
    common_names: 'g7|dexcom g7|dex g7',
  }

  it('resolves a GTIN to its catalog product', async () => {
    // GTIN lookup uses maybeSingle() -> the mock returns the single object.
    mockProducts(g7)
    const res = await GET(req('?gtin=00386270002839'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.product_name).toBe('Dexcom G7 Sensor')
    expect(body.typical_usage_per_day).toBe(0.1)
  })

  it('returns null (not an error) for an unknown GTIN', async () => {
    mockProducts(null)
    const res = await GET(req('?gtin=00000000000000'))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('identifies a product by an exact normalized name/alias match', async () => {
    // Name lookup pulls the list and matches in JS: "Dex G7" -> alias "dex g7".
    mockProducts([g7])
    const res = await GET(req('?name=Dex%20G7'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.product_name).toBe('Dexcom G7 Sensor')
    // The alias column is stripped from the returned product.
    expect(body.common_names).toBeUndefined()
  })

  it('returns null for a name that matches nothing (never a fuzzy guess)', async () => {
    mockProducts([g7])
    const res = await GET(req('?name=some%20random%20thing'))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('returns null when neither gtin nor name is provided', async () => {
    mockProducts([g7])
    const res = await GET(req(''))
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })
})

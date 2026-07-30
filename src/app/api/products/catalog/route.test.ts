import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseServerMock } from '@/lib/testUtils/supabaseServerMock'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { GET } from './route'

function mockCatalog(result: { data?: unknown; error?: { message: string } | null }) {
  vi.mocked(createClient).mockResolvedValue(
    createSupabaseServerMock({ user: null, tables: { products: result } }) as never
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/products/catalog', () => {
  it('groups products by category and returns them in canonical order', async () => {
    mockCatalog({
      data: [
        { product_name: 'Humalog', category: 'insulin' },
        { product_name: 'Dexcom G7 Sensor', category: 'cgm_sensor' },
      ],
      error: null,
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    const categories = body.map((g: { category: string }) => g.category)
    // CATEGORY_ORDER puts cgm_sensor before insulin.
    expect(categories).toEqual(['cgm_sensor', 'insulin'])
    expect(body[0].products).toHaveLength(1)
  })

  it("defaults a null category to 'other' and appends unknown categories last", async () => {
    mockCatalog({
      data: [
        { product_name: 'Mystery Widget', category: 'not_a_known_category' },
        { product_name: 'Alcohol Wipes', category: null },
        { product_name: 'Dexcom G7 Sensor', category: 'cgm_sensor' },
      ],
      error: null,
    })

    const res = await GET()
    const body = await res.json()
    const categories = body.map((g: { category: string }) => g.category)
    // Known category first, then 'other', then the unknown one appended at the end.
    expect(categories[0]).toBe('cgm_sensor')
    expect(categories).toContain('other')
    expect(categories[categories.length - 1]).toBe('not_a_known_category')
  })

  it('returns 500 with the message when the query errors', async () => {
    mockCatalog({ data: null, error: { message: 'boom' } })
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('boom')
  })

  it('returns an empty array when there are no products', async () => {
    mockCatalog({ data: [], error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

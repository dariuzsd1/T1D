import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createSupabaseServerMock } from '@/lib/testUtils/supabaseServerMock'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { GET, POST } from './route'

function mockAuthed(tables: Parameters<typeof createSupabaseServerMock>[0]['tables'] = {}) {
  vi.mocked(createClient).mockResolvedValue(
    createSupabaseServerMock({ user: { id: 'user-1' }, tables }) as never
  )
}

function mockUnauthenticated() {
  vi.mocked(createClient).mockResolvedValue(createSupabaseServerMock({ user: null }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/inventory', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockUnauthenticated()
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 500 when the supplies query errors', async () => {
    mockAuthed({ supplies: { data: null, error: { message: 'boom' } } })
    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('maps a supply row to the honest runway-shaped response', async () => {
    mockAuthed({
      supplies: {
        data: [
          {
            id: 'supply-1',
            brand: 'Omnipod',
            name: '5 Pods',
            quantity: 20,
            usage_rate_per_day: 2,
            expiration_date: null,
            updated_at: '2026-07-01T00:00:00.000Z',
            refill_interval_days: null,
            last_filled_date: null,
            refill_rule_kind: null,
            refill_threshold_pct: null,
            refill_days_before: null,
            copay: null,
            device_id: null,
            prescription_id: null,
            opened_date: null,
            in_use_days: null,
            last_ordered_date: null,
          },
        ],
        error: null,
      },
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    const item = body.data[0]
    expect(item.id).toBe('supply-1')
    expect(item.name).toBe('5 Pods')
    expect(item.usageRatePerDay).toBe(2)
    // quantity 20 at 2/day, no expiration, no in-use clock -> 10 days, exactly.
    expect(item.remainingDays).toBe(10)
    // Optional/un-migrated fields default to null, never fabricated.
    expect(item.refillIntervalDays).toBeNull()
    expect(item.lastOrderedDate).toBeNull()
    expect(item.copay).toBeNull()
  })

  it('returns an empty list rather than erroring when there are no supplies', async () => {
    mockAuthed({ supplies: { data: [], error: null } })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})

describe('POST /api/inventory', () => {
  function postRequest(body: unknown) {
    return new NextRequest('http://localhost/api/inventory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 when there is no authenticated user', async () => {
    mockUnauthenticated()
    const res = await POST(postRequest({ name: 'Test' }))
    expect(res.status).toBe(401)
  })

  it('returns 201 with the inserted row on success', async () => {
    mockAuthed({
      supplies: { data: { id: 'new-1', name: 'Test Strips', quantity: 1 }, error: null },
    })
    const res = await POST(postRequest({ name: 'Test Strips', brand: 'Contour' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBe('new-1')
  })

  it('returns 400 with the database message on an insert error', async () => {
    mockAuthed({
      supplies: { data: null, error: { message: 'duplicate key' } },
    })
    const res = await POST(postRequest({ name: 'Test' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('duplicate key')
  })
})

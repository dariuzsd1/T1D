import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createSupabaseServerMock } from '@/lib/testUtils/supabaseServerMock'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { GET, PATCH } from './route'

const OWNER_ID = 'owner-1'
const params = Promise.resolve({ ownerId: OWNER_ID })

function mockAuthed(tables: Parameters<typeof createSupabaseServerMock>[0]['tables'] = {}) {
  vi.mocked(createClient).mockResolvedValue(
    createSupabaseServerMock({ user: { id: 'caregiver-1' }, tables }) as never
  )
}

function mockUnauthenticated() {
  vi.mocked(createClient).mockResolvedValue(createSupabaseServerMock({ user: null }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/caregiver/[ownerId]/inventory', () => {
  it('returns 401 when there is no authenticated user', async () => {
    mockUnauthenticated()
    const res = await GET(new NextRequest('http://localhost/api/caregiver/owner-1/inventory'), { params })
    expect(res.status).toBe(401)
  })

  it('returns 403 when there is no accepted share for this owner', async () => {
    mockAuthed({ caregiver_shares: { data: null, error: null } })
    const res = await GET(new NextRequest('http://localhost/api/caregiver/owner-1/inventory'), { params })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('No accepted share')
  })

  it('returns 500 when the supplies query errors even with an accepted share', async () => {
    mockAuthed({
      caregiver_shares: { data: { role: 'view', owner_email: 'owner@example.com' }, error: null },
      supplies: { data: null, error: { message: 'boom' } },
    })
    const res = await GET(new NextRequest('http://localhost/api/caregiver/owner-1/inventory'), { params })
    expect(res.status).toBe(500)
  })

  it('returns the mapped inventory plus the caregiver role and owner email', async () => {
    mockAuthed({
      caregiver_shares: { data: { role: 'manage', owner_email: 'owner@example.com' }, error: null },
      supplies: {
        data: [
          {
            id: 'supply-1',
            brand: 'Dexcom',
            name: 'G7 Sensor',
            quantity: 3,
            usage_rate_per_day: 1,
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

    const res = await GET(new NextRequest('http://localhost/api/caregiver/owner-1/inventory'), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.role).toBe('manage')
    expect(body.ownerEmail).toBe('owner@example.com')
    expect(body.data).toHaveLength(1)
    expect(body.data[0].remainingDays).toBe(3)
  })
})

describe('PATCH /api/caregiver/[ownerId]/inventory', () => {
  function patchRequest(body: unknown) {
    return new NextRequest('http://localhost/api/caregiver/owner-1/inventory', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 when there is no authenticated user', async () => {
    mockUnauthenticated()
    const res = await PATCH(patchRequest({ supplyId: 's1', quantity: 2 }), { params })
    expect(res.status).toBe(401)
  })

  it('returns 400 when supplyId is missing', async () => {
    mockAuthed()
    const res = await PATCH(patchRequest({ quantity: 2 }), { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/supplyId/)
  })

  it('rejects a negative quantity (tampered request can never store bad data)', async () => {
    mockAuthed()
    const res = await PATCH(patchRequest({ supplyId: 's1', quantity: -1 }), { params })
    expect(res.status).toBe(400)
  })

  it('rejects a non-numeric quantity', async () => {
    mockAuthed()
    const res = await PATCH(patchRequest({ supplyId: 's1', quantity: 'lots' }), { params })
    expect(res.status).toBe(400)
  })

  it('accepts a valid update and returns ok', async () => {
    mockAuthed({ supplies: { error: null } })
    const res = await PATCH(patchRequest({ supplyId: 's1', quantity: 0 }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 400 with the database message when the update errors (e.g. RLS denies a view-only caregiver)', async () => {
    mockAuthed({ supplies: { error: { message: 'permission denied' } } })
    const res = await PATCH(patchRequest({ supplyId: 's1', quantity: 2 }), { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('permission denied')
  })
})

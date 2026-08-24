import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  findSupplyByCode,
  findPriorSupplyByCode,
  findCodelessSupplies,
  readSupplyForRestock,
} from './supplyLookup'

/**
 * These assert one security property that cannot otherwise be proved without a
 * second account: every read of `supplies` is scoped to the signed-in user.
 *
 * It matters because Row Level Security does NOT enforce it. `supplies` carries
 * additive caregiver policies for select AND update, so an unscoped query lets an
 * accepted caregiver match, and then restock, the row belonging to the person
 * they care for. The fix was one `.eq('user_id', ...)` per query; these tests are
 * what stop it being quietly dropped again.
 */

/** Records every filter applied, so a test can inspect the query that was built. */
function spyClient(rows: unknown) {
  const calls: [string, unknown][] = []
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'order', 'limit', 'not'] as const) {
    builder[m] = () => builder
  }
  builder.eq = (col: string, val: unknown) => {
    calls.push([col, val])
    return builder
  }
  builder.maybeSingle = async () => ({ data: Array.isArray(rows) ? rows[0] : rows })
  builder.then = (res: (v: { data: unknown }) => unknown) => Promise.resolve({ data: rows }).then(res)
  return {
    calls,
    client: { from: () => builder } as unknown as SupabaseClient,
  }
}

const OWNER = 'user-abc'
const row = {
  id: 's1', name: 'MiniMed Reservoir - Kit', brand: 'MiniMed', quantity: 40,
  expiration_date: '2029-03-08', lot_number: 'L1', opened_date: null,
  in_use_days: null, usage_rate_per_day: 0.33, barcode: null, pzn: null,
}

describe('every supplies read is scoped to the signed-in user', () => {
  it('findSupplyByCode filters on user_id as well as the code', async () => {
    const { client, calls } = spyClient(row)
    await findSupplyByCode(client, OWNER, 'barcode', '00763000532222')
    expect(calls).toContainEqual(['user_id', OWNER])
    expect(calls).toContainEqual(['barcode', '00763000532222'])
  })

  it('findPriorSupplyByCode filters on user_id', async () => {
    const { client, calls } = spyClient(row)
    await findPriorSupplyByCode(client, OWNER, 'pzn', '07242491')
    expect(calls).toContainEqual(['user_id', OWNER])
  })

  it('findCodelessSupplies filters on user_id', async () => {
    const { client, calls } = spyClient([row])
    await findCodelessSupplies(client, OWNER)
    expect(calls).toContainEqual(['user_id', OWNER])
  })

  it('readSupplyForRestock filters on user_id as well as the row id', async () => {
    const { client, calls } = spyClient(row)
    await readSupplyForRestock(client, OWNER, 's1')
    expect(calls).toContainEqual(['user_id', OWNER])
    expect(calls).toContainEqual(['id', 's1'])
  })
})

describe('supply lookup shapes', () => {
  it('maps a duplicate row and coerces a string quantity', async () => {
    const { client } = spyClient({ ...row, quantity: '40' })
    const hit = await findSupplyByCode(client, OWNER, 'barcode', 'x')
    expect(hit).toMatchObject({ id: 's1', quantity: 40, expirationDate: '2029-03-08', lotNumber: 'L1' })
  })

  it('returns null rather than a half-built row when nothing matches', async () => {
    const { client } = spyClient(null)
    expect(await findSupplyByCode(client, OWNER, 'barcode', 'x')).toBeNull()
    expect(await findPriorSupplyByCode(client, OWNER, 'barcode', 'x')).toBeNull()
    expect(await readSupplyForRestock(client, OWNER, 's1')).toBeNull()
  })

  it('excludes rows that carry a code from the name-match candidates', async () => {
    // A row with a DIFFERENT code is a different box; matching it by name would
    // merge two products that are not the same thing.
    const { client } = spyClient([
      row,
      { ...row, id: 's2', barcode: '05705244018877' },
      { ...row, id: 's3', pzn: '07242491' },
    ])
    const out = await findCodelessSupplies(client, OWNER)
    expect(out.map((r) => r.id)).toEqual(['s1'])
  })
})

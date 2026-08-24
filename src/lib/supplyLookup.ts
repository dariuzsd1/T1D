import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Every read of the `supplies` table that the scan flow performs.
 *
 * These live together, and out of the component, for one reason: each MUST be
 * scoped by `user_id`, and that is easy to forget and impossible to see in a
 * 1,000-line component. Row Level Security does NOT cover it here. `supplies`
 * carries additive caregiver policies for both select AND update, so an accepted
 * caregiver scanning their own box can otherwise match, and then restock, the row
 * belonging to the person they care for: the wrong person's medical inventory
 * silently changes, and an inflated count suppresses the reorder alert this app
 * exists to raise.
 *
 * `src/lib/supplyLookup.test.ts` asserts the scoping on every function here.
 */

/** The columns the duplicate guard needs to tell one physical box from another. */
export interface DuplicateSupplyRow {
  id: string
  name: string
  quantity: number
  expirationDate: string | null
  lotNumber: string | null
  openedDate: string | null
  inUseDays: number | null
}

/** A supply the user previously scanned and named: their personal catalog. */
export interface PriorSupplyRow {
  name: string
  brand: string | null
  usageRatePerDay: number
}

/** A code-less row, matchable only by name (added by hand or from the catalog). */
export interface CodelessSupplyRow extends DuplicateSupplyRow {
  brand: string | null
}

type CodeColumn = 'barcode' | 'pzn'

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** The user's own supply carrying this exact code, most recently touched first. */
export async function findSupplyByCode(
  supabase: SupabaseClient,
  userId: string,
  column: CodeColumn,
  value: string,
): Promise<DuplicateSupplyRow | null> {
  const { data } = await supabase
    .from('supplies')
    .select('id, name, quantity, expiration_date, lot_number, opened_date, in_use_days')
    .eq('user_id', userId)
    .eq(column, value)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.id) return null
  return {
    id: data.id,
    name: data.name,
    quantity: num(data.quantity),
    expirationDate: data.expiration_date ?? null,
    lotNumber: data.lot_number ?? null,
    openedDate: data.opened_date ?? null,
    inUseDays: data.in_use_days ?? null,
  }
}

/** What the user themselves last called this code, for their personal catalog. */
export async function findPriorSupplyByCode(
  supabase: SupabaseClient,
  userId: string,
  column: CodeColumn,
  value: string,
): Promise<PriorSupplyRow | null> {
  const { data } = await supabase
    .from('supplies')
    .select('name, brand, usage_rate_per_day')
    .not('name', 'is', null)
    .eq('user_id', userId)
    .eq(column, value)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data?.name) return null
  return { name: data.name, brand: data.brand ?? null, usageRatePerDay: num(data.usage_rate_per_day) }
}

/**
 * The user's supplies that carry NO code, the only ones a name match may claim.
 * A row with a DIFFERENT code is a different box, so matching it by name would
 * merge two things that are not the same product.
 */
export async function findCodelessSupplies(
  supabase: SupabaseClient,
  userId: string,
): Promise<CodelessSupplyRow[]> {
  const { data } = await supabase
    .from('supplies')
    .select('id, name, brand, quantity, expiration_date, lot_number, opened_date, in_use_days, barcode, pzn')
    .eq('user_id', userId)
    .not('name', 'is', null)
  return (data ?? [])
    .filter((r: Record<string, unknown>) => !r.barcode && !r.pzn)
    .map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      brand: (r.brand as string) ?? null,
      quantity: num(r.quantity),
      expirationDate: (r.expiration_date as string) ?? null,
      lotNumber: (r.lot_number as string) ?? null,
      openedDate: (r.opened_date as string) ?? null,
      inUseDays: (r.in_use_days as number) ?? null,
    }))
}

/**
 * Re-read a row immediately before restocking it, so the "+N" arithmetic is based
 * on the current count rather than whatever was on screen when the box was scanned.
 */
export async function readSupplyForRestock(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ quantity: number; expirationDate: string | null; lotNumber: string | null } | null> {
  const { data } = await supabase
    .from('supplies')
    .select('quantity, expiration_date, lot_number')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  return {
    quantity: num(data.quantity),
    expirationDate: data.expiration_date ?? null,
    lotNumber: data.lot_number ?? null,
  }
}

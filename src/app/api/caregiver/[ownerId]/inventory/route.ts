import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { effectiveRunwayDays } from '@/lib/depletion'

/**
 * GET /api/caregiver/[ownerId]/inventory
 *
 * Returns the patient's supply inventory to an authenticated caregiver. The
 * RLS policy "caregiver can view shared supplies" enforces access server-side
 * (SELECT where accepted share exists); this route also does a belt-and-suspenders
 * share check to return the caregiver's role so the UI knows whether actions are
 * enabled. Mirrors /api/inventory but scoped to a different user.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> }
) {
  try {
    const { ownerId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Belt-and-suspenders: verify the caregiver has an accepted share for this
    // owner. RLS also enforces, but checking here lets us return the role.
    const { data: share } = await supabase
      .from('caregiver_shares')
      .select('role, owner_email')
      .eq('owner_id', ownerId)
      .eq('status', 'accepted')
      .maybeSingle()

    if (!share) {
      return NextResponse.json({ error: 'No accepted share' }, { status: 403 })
    }

    // RLS policy "caregiver can view shared supplies" allows this SELECT.
    const { data: supplies, error } = await supabase
      .from('supplies')
      .select('*')
      .eq('user_id', ownerId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Caregiver inventory fetch error:', error.message)
      return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
    }

    const inventory = (supplies ?? []).map((supply: any) => {
      const usageRatePerDay =
        supply.usage_rate_per_day != null && Number(supply.usage_rate_per_day) > 0
          ? Number(supply.usage_rate_per_day)
          : 0
      const remainingDays = effectiveRunwayDays({
        quantity: Number(supply.quantity) || 0,
        usageRatePerDay,
        expirationDate: supply.expiration_date,
      })
      return {
        id: supply.id,
        brand: supply.brand || '',
        name: supply.name,
        category: 'medical_supply',
        quantity: supply.quantity,
        remainingDays,
        lastScanned: supply.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        usageRatePerDay,
        expirationDate: supply.expiration_date || null,
        refillIntervalDays: supply.refill_interval_days ?? null,
        lastFilledDate: supply.last_filled_date ?? null,
        copay: supply.copay ?? null,
        deviceId: supply.device_id ?? null,
      }
    })

    return NextResponse.json({
      data: inventory,
      role: share.role,
      ownerEmail: share.owner_email,
    })
  } catch (err: any) {
    console.error('Caregiver inventory API error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/caregiver/[ownerId]/inventory
 *
 * Allows a manage-role caregiver to update one of the patient's supplies
 * (e.g. "Use One" / quantity decrement). The update is a targeted single-column
 * write — RLS policy "caregiver can manage shared supplies" enforces the
 * role=manage check server-side.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> }
) {
  try {
    const { ownerId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supplyId, quantity } = await request.json()
    if (!supplyId || quantity == null) {
      return NextResponse.json({ error: 'supplyId and quantity required' }, { status: 400 })
    }

    // RLS "caregiver can manage shared supplies" enforces manage-role check.
    const { error } = await supabase
      .from('supplies')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', supplyId)
      .eq('user_id', ownerId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

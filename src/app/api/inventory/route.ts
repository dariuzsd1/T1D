import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { effectiveRunwayDays } from '@/lib/depletion'

/**
 * GET /api/inventory
 * Fetch authenticated user's supply inventory
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Select * so optional refill-cycle columns surface automatically once the
    // migration in docs/REFILL_RULES_MIGRATION.md is applied — no code change
    // needed. The client only receives the explicitly mapped fields below.
    const { data: supplies, error: suppliesError } = await supabase
      .from('supplies')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (suppliesError) {
      console.error('Supabase error:', suppliesError)
      return NextResponse.json(
        { error: 'Failed to fetch inventory' },
        { status: 500 }
      )
    }

    // Map supplies to the frontend format, deriving runway from the SAME shared
    // engine the client/Edge Function use (src/lib/depletion.ts) so every surface
    // agrees. runway = sooner of (stock ÷ usage) and (shelf-life expiry). No more
    // dishonest "default 30"; usage rate is the user's real value or 0 (which the
    // engine treats as a conservative estimate, never a fabricated number).
    const inventory = supplies?.map((supply: any) => {
      const usageRatePerDay =
        supply.usage_rate_per_day != null && Number(supply.usage_rate_per_day) > 0
          ? Number(supply.usage_rate_per_day)
          : 0

      const remainingDays = effectiveRunwayDays({
        quantity: Number(supply.quantity) || 0,
        usageRatePerDay,
        expirationDate: supply.expiration_date,
        openedDate: supply.opened_date ?? null,
        inUseDays: supply.in_use_days ?? null,
      })

      return {
        id: supply.id,
        brand: supply.brand || '',
        name: supply.name,
        category: 'medical_supply', // Default; could map category_id to name
        quantity: supply.quantity,
        remainingDays,
        lastScanned: supply.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        usageRatePerDay,
        expirationDate: supply.expiration_date || null,
        // Optional refill-cycle fields (null until the migration is applied).
        refillIntervalDays: supply.refill_interval_days ?? null,
        lastFilledDate: supply.last_filled_date ?? null,
        // Cost & savings layer (null until copay is entered / column exists).
        copay: supply.copay ?? null,
        // Device this consumable feeds (null until linked / column exists).
        deviceId: supply.device_id ?? null,
        // Prescription covering this supply (null until linked / column exists).
        prescriptionId: supply.prescription_id ?? null,
        // Insulin in-use clock (null until set / columns exist).
        openedDate: supply.opened_date ?? null,
        inUseDays: supply.in_use_days ?? null,
        // Reorder-loop tracking (null until marked ordered / column exists).
        lastOrderedDate: supply.last_ordered_date ?? null,
      }
    })

    return NextResponse.json({ data: inventory || [] })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory
 * Create new supply (for future use via scan confirm)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Insert supply
    const { data, error } = await supabase
      .from('supplies')
      .insert({
        user_id: user.id,
        name: body.name,
        brand: body.brand,
        category_id: body.category_id,
        quantity: body.quantity || 1,
        unit: body.unit || 'pieces',
        expiration_date: body.expiration_date,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

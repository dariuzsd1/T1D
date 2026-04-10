import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * GET /api/inventory
 * Fetch authenticated user's supply inventory
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieStore,
      }
    )

    // Get authenticated user
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's supplies
    const { data: supplies, error: suppliesError } = await supabase
      .from('supplies')
      .select(
        `
        id,
        name,
        brand,
        category_id,
        quantity,
        unit,
        expiration_date,
        created_at,
        updated_at
      `
      )
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })

    if (suppliesError) {
      console.error('Supabase error:', suppliesError)
      return NextResponse.json(
        { error: 'Failed to fetch inventory' },
        { status: 500 }
      )
    }

    // Fetch site changes to calculate remaining days
    const { data: siteChanges, error: siteChangesError } = await supabase
      .from('site_changes')
      .select('supply_id, applied_date, expected_duration_days')
      .eq('user_id', session.user.id)
      .order('applied_date', { ascending: false })

    if (siteChangesError) {
      console.error('Supabase error:', siteChangesError)
    }

    // Map supplies to frontend format
    const inventory = supplies?.map((supply: any) => {
      const releventSiteChange = siteChanges?.find(
        (sc: any) => sc.supply_id === supply.id
      )

      let remainingDays = 30 // Default

      if (releventSiteChange) {
        const appliedDate = new Date(releventSiteChange.applied_date)
        const daysElapsed = Math.floor(
          (Date.now() - appliedDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        remainingDays = Math.max(
          0,
          releventSiteChange.expected_duration_days - daysElapsed
        )
      }

      if (supply.expiration_date) {
        const expirationDate = new Date(supply.expiration_date)
        const daysUntilExpiration = Math.floor(
          (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        remainingDays = Math.min(remainingDays, daysUntilExpiration)
      }

      return {
        id: supply.id,
        brand: supply.brand || '',
        name: supply.name,
        category: 'medical_supply', // Default; could map category_id to name
        quantity: supply.quantity,
        remainingDays: Math.max(0, remainingDays),
        lastScanned: supply.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        usageRatePerDay: supply.unit === 'pieces' ? 1 : 0.5,
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
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieStore,
      }
    )

    // Get authenticated user
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Insert supply
    const { data, error } = await supabase
      .from('supplies')
      .insert({
        user_id: session.user.id,
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

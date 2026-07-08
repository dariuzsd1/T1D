'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeAutoDepletion } from '@/lib/autoDepletion'
import { logActivity } from '@/lib/activity'

interface SupplyRow {
  id: string
  name: string
  quantity: number
  usage_rate_per_day: number | null
  auto_depleted_through: string | null
  updated_at: string | null
}

/**
 * Wear-clock auto-depletion (supplement model — see src/lib/autoDepletion.ts
 * for the honesty rules). Runs once per session: for every wear-cycle supply,
 * infers whole elapsed cycles since the most recent known reference point and
 * applies any pending decrement.
 *
 * The reference point is `max(auto_depleted_through, updated_at, latest
 * linked site_changes.applied_date)`. Because `updated_at` is bumped by a DB
 * trigger on ANY write to the row, a manual tap through an existing flow
 * (ProductCard's "Use one", a restock, a site-tracker log) is automatically
 * treated as a fresh reference point here — nothing elsewhere in the app
 * needs to know this feature exists, and a manual log can never be
 * double-counted by the auto-clock.
 *
 * Renders nothing. Silent on any failure: this is a best-effort background
 * reconciliation, not a user-facing action, and must never block or error the
 * dashboard. Eventually consistent — a supply depleted by this check reflects
 * the new quantity on the next natural data fetch, not necessarily the one
 * already in flight when this runs.
 */
export function AutoDepleteSync() {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    void (async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [{ data: supplies }, { data: changes }] = await Promise.all([
          supabase
            .from('supplies')
            .select('id, name, quantity, usage_rate_per_day, auto_depleted_through, updated_at')
            .eq('user_id', user.id)
            .gt('quantity', 0)
            .not('usage_rate_per_day', 'is', null),
          supabase
            .from('site_changes')
            .select('supply_id, applied_date')
            .eq('user_id', user.id)
            .not('supply_id', 'is', null),
        ])
        if (!supplies?.length) return

        const lastChangeBySupply = new Map<string, string>()
        for (const c of (changes ?? []) as { supply_id: string; applied_date: string }[]) {
          const prev = lastChangeBySupply.get(c.supply_id)
          if (!prev || c.applied_date > prev) lastChangeBySupply.set(c.supply_id, c.applied_date)
        }

        const now = new Date()
        for (const s of supplies as SupplyRow[]) {
          const candidates = [s.auto_depleted_through, s.updated_at, lastChangeBySupply.get(s.id)]
            .filter((d): d is string => !!d)
          if (candidates.length === 0) continue
          const accountedThrough = candidates.reduce((a, b) => (a > b ? a : b))

          const result = computeAutoDepletion(
            { quantity: s.quantity, usageRatePerDay: s.usage_rate_per_day ?? 0, accountedThrough },
            now
          )
          if (!result) continue

          const { error } = await supabase
            .from('supplies')
            .update({
              quantity: s.quantity - result.unitsToDeplete,
              auto_depleted_through: result.newAccountedThrough,
            })
            .eq('id', s.id)
          if (!error) void logActivity('supply_used', s.name)
        }
      } catch {
        /* best-effort background reconciliation — never surface to the user */
      }
    })()
  }, [])

  return null
}

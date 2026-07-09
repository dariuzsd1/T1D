import { createClient } from '@/lib/supabase/client'
import type { TKey } from '@/lib/i18n/dictionaries'

/**
 * Personal activity log — the user's own recent actions, shown back to them on
 * the profile page. Row-Level Security keeps it strictly own-row; user_id
 * defaults to auth.uid() in the DB, so inserts only need action + detail.
 *
 * This is the user's own data (it may name supplies), distinct from the opt-in,
 * non-PHI analytics in analytics.ts.
 */

export type ActivityAction = 'supply_added' | 'supply_used' | 'supply_restocked' | 'supply_reordered'

export interface ActivityEntry {
  id: string
  action: string
  detail: string | null
  createdAt: string
}

interface ActivityRow {
  id: string
  action: string
  detail: string | null
  created_at: string
}

/** i18n keys for each known action (unknown actions fall back to the raw string). */
export const ACTIVITY_LABEL: Record<ActivityAction, TKey> = {
  supply_added: 'activity.supplyAdded',
  supply_used: 'activity.supplyUsed',
  supply_restocked: 'activity.supplyRestocked',
  supply_reordered: 'activity.supplyReordered',
}

/** Best-effort: record an action. Never throws — logging must not break a flow. */
export async function logActivity(action: ActivityAction, detail?: string): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.from('activity_log').insert({ action, detail: detail ?? null })
  } catch {
    /* ignore — activity logging is non-critical */
  }
}

/** Fetch the most recent activity entries for the signed-in user. */
export async function fetchRecentActivity(limit = 10): Promise<ActivityEntry[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('activity_log')
      .select('id, action, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return (data as ActivityRow[]).map((r) => ({
      id: r.id,
      action: r.action,
      detail: r.detail,
      createdAt: r.created_at,
    }))
  } catch {
    return []
  }
}

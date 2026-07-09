import { createClient } from '@/lib/supabase/client'

/**
 * Privacy-first usage analytics — OPT-IN only, NO PHI.
 *
 * Only a coarse event name + timestamp are ever stored, and only when the user
 * has turned analytics on (profiles.analytics_opt_in). Never pass supply names,
 * counts, emails, or any health data as an event. The DB policy also blocks
 * inserts unless the user has opted in, so this is enforced on both sides.
 */

/** Allowed, non-PHI event names. Keep this list coarse and harmless.
 *  marked_ordered/restocked exist to compute the moat's core success metric
 *  (CLAUDE.md §0): how often a proactive nag (opened_reorder) actually turns
 *  into a closed reorder loop, not just how often the app is opened. */
export type AnalyticsEvent =
  | 'opened_dashboard'
  | 'opened_reorder'
  | 'opened_supplies'
  | 'added_supply'
  | 'marked_ordered'
  | 'restocked'

/**
 * Record an event IF the user has opted in. `optedIn` is read from the loaded
 * profile by the caller, so we don't issue an extra query on every event.
 * Best-effort and silent.
 */
export async function trackEvent(event: AnalyticsEvent, optedIn: boolean): Promise<void> {
  if (!optedIn) return
  try {
    const supabase = createClient()
    await supabase.from('analytics_events').insert({ event })
  } catch {
    /* ignore — analytics must never affect the app */
  }
}

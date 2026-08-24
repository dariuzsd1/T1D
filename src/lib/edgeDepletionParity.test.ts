import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The push Edge Function runs on Deno and cannot import from src/, so it keeps a
 * hand-ported copy of the depletion math. That copy silently drifted: the client
 * fired "reorder soon" at buffer + the item's delivery time, while the push fired
 * at the bare buffer, so the one channel meant to reach the user without them
 * opening the app was the last to warn, and latest of all on slow-shipping items.
 *
 * A full behavioural comparison is not possible across runtimes, so this guards
 * the specific things that drifted, and fails loudly if the copy loses them.
 */
const edge = readFileSync(
  join(process.cwd(), 'supabase/functions/notify-refills/index.ts'),
  'utf8',
)

describe('notify-refills keeps parity with src/lib/depletion.ts', () => {
  it('reads the per-supply delivery time out of the row', () => {
    expect(edge).toContain('lead_time_days')
    // It must actually be selected, not just typed.
    const select = edge.match(/'id, user_id, name, quantity[^']*'/)?.[0] ?? ''
    expect(select).toContain('lead_time_days')
  })

  it('adds delivery time to the buffer rather than alarming on the buffer alone', () => {
    expect(edge).toContain('function reorderThresholdDays')
    expect(edge).toMatch(/runwayDays <= reorderThresholdDays\(/)
    // The pre-fix form compared straight against the buffer.
    expect(edge).not.toMatch(/runwayDays <= bufferDays/)
  })

  it('applies the same threshold to an expiry-driven alert', () => {
    expect(edge).not.toMatch(/exp <= bufferDays/)
    expect(edge).toMatch(/exp <= reorderThresholdDays\(/)
  })

  it('shares the safety-buffer and lead-time defaults with the client', () => {
    expect(edge).toContain('DEFAULT_SAFETY_BUFFER_DAYS = 14')
    expect(edge).toContain('DEFAULT_SHIPPING_LEAD_TIME_DAYS = 5')
  })
})

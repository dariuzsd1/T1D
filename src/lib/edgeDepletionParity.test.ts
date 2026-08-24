import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The app and the notify-refills Edge Function must run the SAME depletion math.
 *
 * They used to keep hand-ported copies, because Deno cannot import from src/, and
 * the copies drifted: the app fired "reorder soon" at buffer plus an item's
 * delivery time while the push fired at the bare buffer, so the channel meant to
 * reach a user without them opening the app warned latest, and latest of all on
 * the slowest-shipping items.
 *
 * That is now one file that both import. These assertions defend the arrangement
 * itself, because the tempting "quick fix" when Deno complains is to paste the
 * function back in locally, which silently restores the old failure.
 */
const SHARED = 'supabase/functions/_shared/depletion.ts'
const EDGE = 'supabase/functions/notify-refills/index.ts'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('one depletion engine, shared by the app and the push function', () => {
  it('keeps the shared module where both runtimes can reach it', () => {
    expect(existsSync(join(process.cwd(), SHARED))).toBe(true)
  })

  it('stays importable by Deno: no imports of its own', () => {
    // Deno resolves this file directly. An import of a bare npm/@ specifier here
    // would break the function at deploy time, not at build time.
    const shared = read(SHARED)
    expect(shared).not.toMatch(/^\s*import\s/m)
  })

  it('is what the app re-exports, rather than a second definition', () => {
    const lib = read('src/lib/depletion.ts')
    expect(lib).toContain("export * from '../../supabase/functions/_shared/depletion'")
    expect(lib).not.toMatch(/export function (stockStatus|displayStatus|effectiveRunwayDays)/)
  })

  it('is what the Edge Function imports, with the .ts extension Deno requires', () => {
    expect(read(EDGE)).toMatch(/from '\.\.\/_shared\/depletion\.ts'/)
  })

  it('is never re-declared locally inside the Edge Function', () => {
    // The regression that matters: pasting the helper back in to silence Deno.
    const edge = read(EDGE)
    for (const fn of [
      'isRateEstimated', 'daysOfStock', 'daysUntilExpiration', 'inUseDaysRemaining',
      'effectiveRunwayDays', 'reorderThresholdDays', 'effectiveLeadTimeDays',
      'stockStatus', 'displayStatus',
    ]) {
      expect(edge).not.toMatch(new RegExp(`^\s*function ${fn}\b`, 'm'))
    }
  })

  it('still applies a per-supply delivery time to the push threshold', () => {
    const edge = read(EDGE)
    expect(edge).toMatch(/lead_time_days/)
    expect(edge).toMatch(/effectiveLeadTimeDays\(\{ leadTimeDays: s\.lead_time_days \}/)
  })
})

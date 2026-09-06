import { describe, it, expect } from 'vitest'
import {
  rescueKindOf,
  isRescueItem,
  rescueExpiryStatus,
  itemDisplayStatus,
  tracksDailyUse,
  rescueLeadsWithExpiry,
  RESCUE_EXPIRY_WARN_DAYS,
} from './rescueItems'

const NOW = new Date(2026, 6, 2) // 2026-07-02 local
const MS_PER_DAY = 1000 * 60 * 60 * 24
const isoInDays = (n: number) =>
  new Date(NOW.getTime() + n * MS_PER_DAY).toISOString().slice(0, 10)

describe('rescueKindOf', () => {
  it('classifies by real stored category first', () => {
    expect(rescueKindOf({ category: 'glucagon' })).toBe('glucagon')
    expect(rescueKindOf({ category: 'ketone_supply' })).toBe('ketone')
    expect(rescueKindOf({ category: 'hypo_treatment' })).toBe('hypo')
  })
  it('is case/space tolerant on the category', () => {
    expect(rescueKindOf({ category: '  Glucagon ' })).toBe('glucagon')
  })
  it('falls back to name/brand keywords when no category is stored', () => {
    expect(rescueKindOf({ name: 'Baqsimi (nasal glucagon)' })).toBe('glucagon')
    expect(rescueKindOf({ name: 'Gvoke HypoPen', brand: 'Xeris' })).toBe('glucagon')
    expect(rescueKindOf({ name: 'Zegalogue' })).toBe('glucagon')
    expect(rescueKindOf({ brand: 'Keto-Mojo', name: 'Blood Ketone Strips' })).toBe('ketone')
    expect(rescueKindOf({ name: 'Dex4 Glucose Tablets' })).toBe('hypo')
  })
  it('returns null for an ordinary supply', () => {
    expect(rescueKindOf({ category: 'cgm_sensor', name: 'Dexcom G7 Sensor' })).toBeNull()
    expect(rescueKindOf({ name: 'Omnipod 5 Pods' })).toBeNull()
    expect(rescueKindOf({})).toBeNull()
  })
  it('category wins over a misleading name', () => {
    // A real category label is authoritative even if the name looks generic.
    expect(rescueKindOf({ category: 'glucagon', name: 'Emergency Kit' })).toBe('glucagon')
  })
})

describe('isRescueItem', () => {
  it('is true for any recognized rescue kind, false otherwise', () => {
    expect(isRescueItem({ category: 'glucagon' })).toBe(true)
    expect(isRescueItem({ name: 'GlucaGen HypoKit' })).toBe(true)
    expect(isRescueItem({ name: 'Humalog' })).toBe(false)
  })
})

describe('rescueExpiryStatus', () => {
  it('is out when none on hand', () => {
    expect(rescueExpiryStatus({ category: 'glucagon', quantity: 0, expirationDate: isoInDays(400) }, NOW)).toBe('out')
  })
  it('is unset (prompt for a date, not a usage rate) when no expiry is recorded', () => {
    expect(rescueExpiryStatus({ category: 'glucagon', quantity: 1, expirationDate: null }, NOW)).toBe('unset')
  })
  it('is out when already expired', () => {
    expect(rescueExpiryStatus({ category: 'glucagon', quantity: 1, expirationDate: isoInDays(-1) }, NOW)).toBe('out')
  })
  it('warns (low) far earlier for glucagon than for hypo carbs', () => {
    // 50 days out: inside glucagon's 60-day window (low) but outside hypo's 30 (ok).
    expect(rescueExpiryStatus({ category: 'glucagon', quantity: 1, expirationDate: isoInDays(50) }, NOW)).toBe('low')
    expect(rescueExpiryStatus({ category: 'hypo_treatment', quantity: 1, expirationDate: isoInDays(50) }, NOW)).toBe('ok')
  })
  it('is ok when the expiry is comfortably far out', () => {
    expect(rescueExpiryStatus({ category: 'glucagon', quantity: 1, expirationDate: isoInDays(400) }, NOW)).toBe('ok')
  })
  it('uses the documented per-kind warning horizons', () => {
    expect(RESCUE_EXPIRY_WARN_DAYS).toEqual({ glucagon: 60, ketone: 45, hypo: 30 })
  })
})

describe('itemDisplayStatus (dispatch)', () => {
  it('routes a rescue item through the expiry path, ignoring usage/runway', () => {
    // No usage rate + a fresh box would normally be 'unset'; as glucagon expiring
    // in 30 days it must be 'low' instead.
    const glucagon = { category: 'glucagon', quantity: 1, usageRatePerDay: 0, expirationDate: isoInDays(30) }
    expect(itemDisplayStatus(glucagon, 14, 0, NOW)).toBe('low')
  })
  it('routes an ordinary item through the normal depletion status', () => {
    // Known rate, plenty of runway → ok, unaffected by rescue logic.
    const pods = { category: 'patch_pump', name: 'Omnipod 5', quantity: 30, usageRatePerDay: 1 }
    expect(itemDisplayStatus(pods, 14, 0, NOW)).toBe('ok')
  })
  it('a lead time still applies to ordinary items via the normal path', () => {
    const pods = { name: 'Omnipod 5', quantity: 18, usageRatePerDay: 1 }
    expect(itemDisplayStatus(pods, 14, 0, NOW)).toBe('ok')
    expect(itemDisplayStatus(pods, 14, 7, NOW)).toBe('low')
  })
})

describe('tracksDailyUse', () => {
  it('is true for fast carbs, which people genuinely eat', () => {
    expect(tracksDailyUse({ category: 'hypo_treatment' })).toBe(true)
  })

  it('is false for the two that are used only when something goes wrong', () => {
    // One glucagon use empties the device; ketones are checked when ill or
    // running high. A daily average describes nobody in either case.
    expect(tracksDailyUse({ category: 'glucagon' })).toBe(false)
    expect(tracksDailyUse({ category: 'ketone_supply' })).toBe(false)
  })

  it('is true for anything that is not rescue kit at all', () => {
    expect(tracksDailyUse({ category: 'patch_pump', name: 'Omnipod 5' })).toBe(true)
  })
})

describe('rescueLeadsWithExpiry', () => {
  it('keeps glucagon and ketones on the date, rate or no rate', () => {
    expect(rescueLeadsWithExpiry({ category: 'glucagon', usageRatePerDay: 0 })).toBe(true)
    expect(rescueLeadsWithExpiry({ category: 'glucagon', usageRatePerDay: 2 })).toBe(true)
    expect(rescueLeadsWithExpiry({ category: 'ketone_supply', usageRatePerDay: 3 })).toBe(true)
  })

  it('keeps fast carbs on the date only while we have no rate', () => {
    expect(rescueLeadsWithExpiry({ category: 'hypo_treatment', usageRatePerDay: 0 })).toBe(true)
    expect(rescueLeadsWithExpiry({ category: 'hypo_treatment', usageRatePerDay: 4 })).toBe(false)
  })

  it('never claims an ordinary item', () => {
    expect(rescueLeadsWithExpiry({ category: 'bg_supply', usageRatePerDay: 0 })).toBe(false)
  })
})

describe('fast carbs running out (the answer that used to be discarded)', () => {
  const tabs = (quantity: number, extra: Record<string, unknown> = {}) => ({
    category: 'hypo_treatment',
    name: 'Dex4 Glucose Tablets',
    quantity,
    usageRatePerDay: 4,
    expirationDate: isoInDays(900),
    ...extra,
  })

  it('reads low when the tube is nearly gone, which it could not before', () => {
    // Six tablets at four a day is a day and a half of hypo treatment. The
    // expiry is years out, so the old expiry-only path called this 'ok'.
    expect(itemDisplayStatus(tabs(6), 14, 0, NOW)).toBe('low')
  })

  it('still reads ok when there is genuinely plenty', () => {
    expect(itemDisplayStatus(tabs(200), 14, 0, NOW)).toBe('ok')
  })

  it('keeps the long rescue expiry warning as well, not instead', () => {
    // 40 days out is comfortably past the ordinary 14-day buffer but inside the
    // 30-day rescue window, so expiry has to win here. Both clocks, worse one.
    const soon = tabs(200, { expirationDate: isoInDays(20) })
    expect(itemDisplayStatus(soon, 14, 0, NOW)).toBe('low')
  })

  it('does not let a missing expiry date hide a real shortage', () => {
    // rescueExpiryStatus alone returns 'unset' with no date on file. That must
    // not outrank a runway we actually know.
    const undated = tabs(6, { expirationDate: null })
    expect(rescueExpiryStatus({ ...undated }, NOW)).toBe('unset')
    expect(itemDisplayStatus(undated, 14, 0, NOW)).toBe('low')
  })

  it('leaves fast carbs on expiry alone until a rate is given', () => {
    // No rate: nothing to forecast from, so this stays exactly as it was.
    const noRate = tabs(6, { usageRatePerDay: 0 })
    expect(itemDisplayStatus(noRate, 14, 0, NOW)).toBe('ok')
  })

  it('an empty tube is out either way', () => {
    expect(itemDisplayStatus(tabs(0), 14, 0, NOW)).toBe('out')
  })

  it('honours the now it was handed, on both clocks', () => {
    // itemDisplayStatus always took a `now`, but only the expiry half used it:
    // the depletion half read the real system clock. Nobody noticed while rescue
    // items went down one path only. Combining them made it reachable, and a
    // test dated from a fake NOW read 'out' because the other half thought the
    // expiry was months past. Both halves take `now` now, so a date a year out
    // from NOW is comfortable and one just behind NOW is expired.
    expect(itemDisplayStatus(tabs(200, { expirationDate: isoInDays(365) }), 14, 0, NOW)).toBe('ok')
    expect(itemDisplayStatus(tabs(200, { expirationDate: isoInDays(-1) }), 14, 0, NOW)).toBe('out')
  })
})

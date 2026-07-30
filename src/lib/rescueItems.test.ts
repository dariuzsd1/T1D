import { describe, it, expect } from 'vitest'
import {
  rescueKindOf,
  isRescueItem,
  rescueExpiryStatus,
  itemDisplayStatus,
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

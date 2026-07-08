import { describe, it, expect } from 'vitest'
import { computeAutoDepletion } from './autoDepletion'

const DAY = 1000 * 60 * 60 * 24
const now = new Date('2026-07-07T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY).toISOString()

describe('computeAutoDepletion — supplement-model wear clock', () => {
  it('does nothing for a consumption-rate item (>1/day), even with old history', () => {
    // 5 test strips/day is not a wear item — daysPerUnitFromRate returns null for it.
    expect(
      computeAutoDepletion({ quantity: 50, usageRatePerDay: 5, accountedThrough: daysAgo(30) }, now)
    ).toBeNull()
  })

  it('does nothing with no reference date — never fabricates elapsed time', () => {
    expect(
      computeAutoDepletion({ quantity: 5, usageRatePerDay: 1 / 3, accountedThrough: null }, now)
    ).toBeNull()
  })

  it('does nothing when less than one full wear-cycle has elapsed', () => {
    // 3-day wear item, only 2 days since the reference point.
    expect(
      computeAutoDepletion({ quantity: 5, usageRatePerDay: 1 / 3, accountedThrough: daysAgo(2) }, now)
    ).toBeNull()
  })

  it('deletes exactly one unit when exactly one cycle has elapsed, advancing the clock by one cycle', () => {
    const result = computeAutoDepletion(
      { quantity: 5, usageRatePerDay: 1 / 3, accountedThrough: daysAgo(3) },
      now
    )
    expect(result).not.toBeNull()
    expect(result!.unitsToDeplete).toBe(1)
    expect(new Date(result!.newAccountedThrough).toISOString()).toBe(
      new Date(new Date(daysAgo(3)).getTime() + 3 * DAY).toISOString()
    )
  })

  it('deletes multiple units when multiple cycles have elapsed (user was away)', () => {
    // 10 days elapsed on a 3-day item -> 3 whole cycles.
    const result = computeAutoDepletion(
      { quantity: 10, usageRatePerDay: 1 / 3, accountedThrough: daysAgo(10) },
      now
    )
    expect(result!.unitsToDeplete).toBe(3)
  })

  it('never depletes more than what is actually on hand', () => {
    // 10 days elapsed implies 3 cycles, but only 2 units exist.
    const result = computeAutoDepletion(
      { quantity: 2, usageRatePerDay: 1 / 3, accountedThrough: daysAgo(10) },
      now
    )
    expect(result!.unitsToDeplete).toBe(2)
  })

  it('does nothing when quantity is already 0 — stays "out", never goes negative', () => {
    expect(
      computeAutoDepletion({ quantity: 0, usageRatePerDay: 1 / 3, accountedThrough: daysAgo(30) }, now)
    ).toBeNull()
  })

  it('advances the reference date by cycles consumed, not all the way to now (preserves phase)', () => {
    // 7 days elapsed on a 3-day item -> 2 cycles (6 days accounted), 1 day remainder untouched.
    const result = computeAutoDepletion(
      { quantity: 10, usageRatePerDay: 1 / 3, accountedThrough: daysAgo(7) },
      now
    )
    expect(result!.unitsToDeplete).toBe(2)
    const expected = new Date(new Date(daysAgo(7)).getTime() + 2 * 3 * DAY)
    expect(new Date(result!.newAccountedThrough).getTime()).toBe(expected.getTime())
  })
})

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SAFETY_BUFFER_DAYS,
  DEFAULT_USAGE_RATE_PER_DAY,
  isRateEstimated,
  rateFromDaysPerUnit,
  daysPerUnitFromRate,
  daysOfStock,
  daysUntilExpiration,
  effectiveRunwayDays,
  stockStatus,
  reorderByDate,
} from './depletion'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const isoInDays = (n: number) =>
  new Date(Date.now() + n * MS_PER_DAY).toISOString().slice(0, 10)

describe('constants', () => {
  it('match the documented defaults', () => {
    expect(DEFAULT_SAFETY_BUFFER_DAYS).toBe(14)
    expect(DEFAULT_USAGE_RATE_PER_DAY).toBe(1)
  })
})

describe('isRateEstimated', () => {
  it('treats missing / zero / negative rates as estimated', () => {
    expect(isRateEstimated(undefined)).toBe(true)
    expect(isRateEstimated(null)).toBe(true)
    expect(isRateEstimated(0)).toBe(true)
    expect(isRateEstimated(-2)).toBe(true)
  })
  it('treats a positive rate as known (not estimated)', () => {
    expect(isRateEstimated(0.5)).toBe(false)
    expect(isRateEstimated(3)).toBe(false)
  })
})

describe('rateFromDaysPerUnit / daysPerUnitFromRate', () => {
  it('converts "each one lasts N days" to a daily rate', () => {
    expect(rateFromDaysPerUnit(7)).toBeCloseTo(1 / 7) // a 7-day sensor
    expect(rateFromDaysPerUnit(3)).toBeCloseTo(1 / 3) // a 3-day pod
    expect(rateFromDaysPerUnit(0)).toBe(0) // blank → unknown
    expect(rateFromDaysPerUnit(-2)).toBe(0)
  })
  it('round-trips a wear duration back to whole days', () => {
    expect(daysPerUnitFromRate(rateFromDaysPerUnit(7))).toBe(7)
    expect(daysPerUnitFromRate(0.1)).toBe(10)
  })
  it('returns null when "days per unit" is not meaningful', () => {
    expect(daysPerUnitFromRate(0)).toBeNull()
    expect(daysPerUnitFromRate(null)).toBeNull()
    expect(daysPerUnitFromRate(5)).toBeNull() // consumption item, 5/day
  })
  it('fixes the box-of-5-sensors case end-to-end', () => {
    // 5 Guardian 4 sensors, each worn 7 days, should read ~35 days — NOT the
    // 1-unit/day fallback's 5.
    const rate = rateFromDaysPerUnit(7)
    expect(daysOfStock(5, rate)).toBe(35)
  })
})

describe('daysOfStock', () => {
  it('divides quantity by usage and floors', () => {
    expect(daysOfStock(10, 1)).toBe(10)
    expect(daysOfStock(6, 0.34)).toBe(17) // floor(17.6)
    expect(daysOfStock(9, 0.1)).toBe(90)
  })
  it('falls back to the conservative default when the rate is unknown', () => {
    // rate 0 → treated as 1/day, NOT Infinity
    expect(daysOfStock(10, 0)).toBe(10)
    expect(daysOfStock(10, -5)).toBe(10)
  })
  it('never returns negative', () => {
    expect(daysOfStock(0, 1)).toBe(0)
  })
})

describe('daysUntilExpiration', () => {
  it('returns null for missing or invalid dates', () => {
    expect(daysUntilExpiration(null)).toBeNull()
    expect(daysUntilExpiration(undefined)).toBeNull()
    expect(daysUntilExpiration('not-a-date')).toBeNull()
  })
  it('computes whole days until a future expiry', () => {
    expect(daysUntilExpiration(isoInDays(30))).toBeGreaterThanOrEqual(29)
    expect(daysUntilExpiration(isoInDays(30))).toBeLessThanOrEqual(30)
  })
  it('is negative for a past expiry', () => {
    expect(daysUntilExpiration(isoInDays(-5))).toBeLessThan(0)
  })
})

describe('effectiveRunwayDays', () => {
  it('uses stock alone when there is no expiry', () => {
    expect(effectiveRunwayDays({ quantity: 9, usageRatePerDay: 0.1 })).toBe(90)
  })
  it('is capped by an earlier expiry (the sooner of the two)', () => {
    // 4 sensors at 0.07/day = ~57 days of stock, but expires in ~20 days
    const runway = effectiveRunwayDays({
      quantity: 4,
      usageRatePerDay: 0.07,
      expirationDate: isoInDays(20),
    })
    expect(runway).toBeGreaterThanOrEqual(19)
    expect(runway).toBeLessThanOrEqual(21)
  })
  it('is never more optimistic than the stock when stock is the limit', () => {
    const runway = effectiveRunwayDays({
      quantity: 1,
      usageRatePerDay: 0.1, // 10 days of stock
      expirationDate: isoInDays(300),
    })
    expect(runway).toBe(10)
  })
})

describe('stockStatus', () => {
  it('flags a true stockout as out', () => {
    expect(stockStatus(0)).toBe('out')
    expect(stockStatus(-3)).toBe('out')
  })
  it('flags dipping into the reserve as low', () => {
    expect(stockStatus(10, 14)).toBe('low')
    expect(stockStatus(14, 14)).toBe('low') // exactly at the buffer
  })
  it('is ok above the buffer', () => {
    expect(stockStatus(15, 14)).toBe('ok')
    expect(stockStatus(90, 14)).toBe('ok')
  })
})

describe('reorderByDate', () => {
  it('is today when already at/under the buffer', () => {
    const today = new Date().setHours(0, 0, 0, 0)
    expect(reorderByDate(10, 14).setHours(0, 0, 0, 0)).toBe(today)
  })
  it('is in the future when there is slack above the buffer', () => {
    expect(reorderByDate(30, 14).getTime()).toBeGreaterThan(Date.now())
  })
})

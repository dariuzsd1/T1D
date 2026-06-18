import { describe, it, expect } from 'vitest'
import { annualCost, monthlyCost, isYearEndStockUpWindow, formatUsd } from './cost'

describe('annualCost', () => {
  it('returns null when copay is missing or non-positive', () => {
    expect(annualCost(null, 90)).toBeNull()
    expect(annualCost(undefined, 90)).toBeNull()
    expect(annualCost(0, 90)).toBeNull()
    expect(annualCost(-5, 90)).toBeNull()
  })
  it('returns null when the refill cadence is missing or non-positive', () => {
    expect(annualCost(30, null)).toBeNull()
    expect(annualCost(30, 0)).toBeNull()
  })
  it('annualizes copay by how many refills fit in a year', () => {
    // $30 every 90 days → 365/90 ≈ 4.06 refills → ≈ $121.67
    expect(annualCost(30, 90)).toBeCloseTo(121.67, 1)
    // $25 every 30 days → ≈ 12.17 refills → ≈ $304.17
    expect(annualCost(25, 30)).toBeCloseTo(304.17, 1)
  })
})

describe('monthlyCost', () => {
  it('is the annual cost divided by 12, or null when unknown', () => {
    expect(monthlyCost(30, 90)).toBeCloseTo(121.67 / 12, 1)
    expect(monthlyCost(null, 90)).toBeNull()
  })
})

describe('isYearEndStockUpWindow', () => {
  it('is true in Oct–Dec', () => {
    expect(isYearEndStockUpWindow(new Date('2026-10-01T12:00:00Z'))).toBe(true)
    expect(isYearEndStockUpWindow(new Date('2026-12-20T12:00:00Z'))).toBe(true)
  })
  it('is false earlier in the year', () => {
    expect(isYearEndStockUpWindow(new Date('2026-06-18T12:00:00Z'))).toBe(false)
    expect(isYearEndStockUpWindow(new Date('2026-01-05T12:00:00Z'))).toBe(false)
  })
})

describe('formatUsd', () => {
  it('renders whole-cent USD', () => {
    expect(formatUsd(121.666)).toBe('$121.67')
    expect(formatUsd(0)).toBe('$0.00')
  })
})

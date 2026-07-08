import { describe, it, expect } from 'vitest'
import { isOrderPending, daysSinceOrdered, ORDER_GRACE_DAYS } from './orderTracking'

const NOW = new Date('2026-07-09T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('isOrderPending', () => {
  it('is false when no order was ever marked', () => {
    expect(isOrderPending(null, NOW)).toBe(false)
    expect(isOrderPending(undefined, NOW)).toBe(false)
  })

  it('is true just after marking', () => {
    expect(isOrderPending(daysAgo(0), NOW)).toBe(true)
  })

  it('stays true through the grace window', () => {
    expect(isOrderPending(daysAgo(ORDER_GRACE_DAYS), NOW)).toBe(true)
  })

  it('expires after the grace window so a never-arrived order resumes nagging', () => {
    expect(isOrderPending(daysAgo(ORDER_GRACE_DAYS + 1), NOW)).toBe(false)
  })

  it('is false for a malformed date rather than throwing', () => {
    expect(isOrderPending('not-a-date', NOW)).toBe(false)
  })

  it('is false for a future date (never applies retroactively-broken data as pending)', () => {
    expect(isOrderPending(new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString(), NOW)).toBe(false)
  })
})

describe('daysSinceOrdered', () => {
  it('is null when nothing is pending', () => {
    expect(daysSinceOrdered(null, NOW)).toBeNull()
    expect(daysSinceOrdered(daysAgo(ORDER_GRACE_DAYS + 1), NOW)).toBeNull()
  })

  it('counts whole days since marking', () => {
    expect(daysSinceOrdered(daysAgo(3), NOW)).toBe(3)
  })

  it('is 0 on the day it was marked', () => {
    expect(daysSinceOrdered(daysAgo(0), NOW)).toBe(0)
  })
})

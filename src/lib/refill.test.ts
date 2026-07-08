import { describe, it, expect } from 'vitest'
import {
  DEFAULT_REFILL_THRESHOLD,
  nextEligibleRefillDate,
  daysUntilRefillEligible,
  assessRefill,
  refillRuleFrom,
} from './refill'

const MS_PER_DAY = 1000 * 60 * 60 * 24
// Fixed "now" (noon UTC) so day math is stable regardless of the test machine TZ.
const NOW = new Date('2026-06-17T12:00:00Z')
const isoDaysFromNow = (n: number) =>
  new Date(NOW.getTime() + n * MS_PER_DAY).toISOString().slice(0, 10)

// A 40-day supply at the default 0.75 threshold becomes eligible 30 days after fill.
const rule40 = { supplyDays: 40 }

describe('DEFAULT_REFILL_THRESHOLD', () => {
  it('is 0.75 (most US plans)', () => {
    expect(DEFAULT_REFILL_THRESHOLD).toBe(0.75)
  })
})

describe('nextEligibleRefillDate', () => {
  it('returns null when inputs are missing', () => {
    expect(nextEligibleRefillDate(null, rule40)).toBeNull()
    expect(nextEligibleRefillDate(isoDaysFromNow(-10), null)).toBeNull()
    expect(nextEligibleRefillDate(isoDaysFromNow(-10), { supplyDays: 0 })).toBeNull()
    expect(nextEligibleRefillDate('not-a-date', rule40)).toBeNull()
  })
  it('is fill date + supplyDays * threshold', () => {
    const filled = '2026-06-01'
    const eligible = nextEligibleRefillDate(filled, rule40)!
    // 40 * 0.75 = 30 days after 2026-06-01 → 2026-07-01
    const expected = new Date(new Date(filled).getTime() + 30 * MS_PER_DAY)
    expect(eligible.getTime()).toBe(expected.getTime())
  })

  it('honors an explicit percent threshold (80% of 90-day = day 72)', () => {
    const filled = '2026-06-01'
    const eligible = nextEligibleRefillDate(filled, { kind: 'percent', supplyDays: 90, refillThreshold: 0.8 })!
    const expected = new Date(new Date(filled).getTime() + 72 * MS_PER_DAY)
    expect(eligible.getTime()).toBe(expected.getTime())
  })

  it('supports the days-before-runout shape (90-day, 10 days before = day 80)', () => {
    const filled = '2026-06-01'
    const eligible = nextEligibleRefillDate(filled, { kind: 'days-before', supplyDays: 90, daysBeforeRunout: 10 })!
    const expected = new Date(new Date(filled).getTime() + 80 * MS_PER_DAY)
    expect(eligible.getTime()).toBe(expected.getTime())
  })

  it('days-before clamps: a huge daysBeforeRunout never yields a date before the fill', () => {
    const filled = '2026-06-01'
    const eligible = nextEligibleRefillDate(filled, { kind: 'days-before', supplyDays: 30, daysBeforeRunout: 999 })!
    expect(eligible.getTime()).toBe(new Date(filled).getTime()) // day 0, not negative
  })
})

describe('refillRuleFrom', () => {
  it('returns null without a dispensed-days value', () => {
    expect(refillRuleFrom({})).toBeNull()
    expect(refillRuleFrom({ refillIntervalDays: 0 })).toBeNull()
    expect(refillRuleFrom({ refillIntervalDays: null })).toBeNull()
  })

  it('defaults to the percent shape when no kind is stored', () => {
    const rule = refillRuleFrom({ refillIntervalDays: 90 })!
    expect(rule.kind).toBe('percent')
    expect(rule.supplyDays).toBe(90)
    expect(rule.refillThreshold).toBeUndefined() // falls back to DEFAULT in the engine
  })

  it('converts a stored percent (0-100) to the engine fraction', () => {
    const rule = refillRuleFrom({ refillIntervalDays: 90, refillThresholdPct: 80 })!
    expect(rule.refillThreshold).toBeCloseTo(0.8)
  })

  it("maps the DB snake_case 'days_before' kind to the engine enum", () => {
    const rule = refillRuleFrom({ refillIntervalDays: 90, refillRuleKind: 'days_before', refillDaysBefore: 7 })!
    expect(rule.kind).toBe('days-before')
    expect(rule.daysBeforeRunout).toBe(7)
  })

  it('round-trips through nextEligibleRefillDate for a days-before plan', () => {
    const rule = refillRuleFrom({ refillIntervalDays: 30, refillRuleKind: 'days_before', refillDaysBefore: 5 })!
    const eligible = nextEligibleRefillDate('2026-06-01', rule)! // day 25
    const expected = new Date(new Date('2026-06-01').getTime() + 25 * MS_PER_DAY)
    expect(eligible.getTime()).toBe(expected.getTime())
  })
})

describe('daysUntilRefillEligible', () => {
  it('returns null when it cannot be computed', () => {
    expect(daysUntilRefillEligible(null, rule40, NOW)).toBeNull()
  })
  it('is 0 (never negative) once already eligible', () => {
    // filled 40 days ago → eligible 30 days ago → 0
    expect(daysUntilRefillEligible(isoDaysFromNow(-40), rule40, NOW)).toBe(0)
  })
  it('counts whole days until eligibility', () => {
    // filled 10 days ago → eligible at day 30 → 20 days from now
    const d = daysUntilRefillEligible(isoDaysFromNow(-10), rule40, NOW)
    expect(d).toBeGreaterThanOrEqual(19)
    expect(d).toBeLessThanOrEqual(21)
  })
})

describe('assessRefill', () => {
  it('is "unknown" without a refill cycle', () => {
    const a = assessRefill(5, null, null, NOW)
    expect(a.state).toBe('unknown')
    expect(a.eligibleDate).toBeNull()
  })

  it('is "eligible-now" when the refill window has opened', () => {
    const a = assessRefill(5, isoDaysFromNow(-40), rule40, NOW)
    expect(a.state).toBe('eligible-now')
    expect(a.daysUntilEligible).toBe(0)
  })

  it('is "gap" when you run out before insurance allows a refill', () => {
    // eligible in ~20 days, but only 5 days of supply left
    const a = assessRefill(5, isoDaysFromNow(-10), rule40, NOW)
    expect(a.state).toBe('gap')
    expect(a.shortfallDays).toBeGreaterThan(0)
    expect(a.message.toLowerCase()).toContain('override')
  })

  it('is "covered" when supply outlasts the wait for eligibility', () => {
    // eligible in ~20 days, and 25 days of supply left
    const a = assessRefill(25, isoDaysFromNow(-10), rule40, NOW)
    expect(a.state).toBe('covered')
    expect(a.shortfallDays).toBe(0)
  })
})

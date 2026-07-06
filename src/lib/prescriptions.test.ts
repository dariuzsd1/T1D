import { describe, it, expect } from 'vitest'
import { rxSupplyStatus, renewalStatus, type Prescription } from './prescriptions'

const NOW = new Date('2026-07-01T12:00:00Z')

function rx(over: Partial<Prescription>): Prescription {
  return {
    id: 'r', medicationName: 'Humalog', dosage: null, prescriber: null,
    pharmacy: null, rxNumber: null, writtenDate: null, expirationDate: null,
    refillsRemaining: null, lastFilledDate: null, notes: null, ...over,
  }
}

describe('rxSupplyStatus — the runway ↔ refills reconciliation', () => {
  const base = { supplyName: 'Humalog vials', runwayDays: 9, rateEstimated: false, now: NOW }

  it('is null when nothing is actionable (refills left, not expiring)', () => {
    expect(rxSupplyStatus({ ...base, prescription: rx({ refillsRemaining: 3 }) })).toBeNull()
    expect(rxSupplyStatus({ ...base, prescription: rx({}) })).toBeNull() // unknown refills → no claim
  })

  it('flags no-refills-left as act, with the runway clause when the rate is real', () => {
    const s = rxSupplyStatus({ ...base, prescription: rx({ refillsRemaining: 0 }) })
    expect(s?.level).toBe('act')
    expect(s?.message).toContain('No refills left')
    expect(s?.message).toContain('about 9 days')
  })

  it('omits the day claim when the rate is estimated (a guess is not a deadline)', () => {
    const s = rxSupplyStatus({
      ...base, rateEstimated: true, prescription: rx({ refillsRemaining: 0 }),
    })
    expect(s?.level).toBe('act')
    expect(s?.message).not.toContain('about')
    expect(s?.message).toContain('No refills left')
  })

  it('flags an expired prescription as act even with refills on paper', () => {
    const s = rxSupplyStatus({
      ...base, prescription: rx({ refillsRemaining: 2, expirationDate: '2026-06-01' }),
    })
    expect(s?.level).toBe('act')
    expect(s?.message).toContain('expired')
  })

  it('treats one refill left as plan (heads-up, not an alarm)', () => {
    const s = rxSupplyStatus({ ...base, prescription: rx({ refillsRemaining: 1 }) })
    expect(s?.level).toBe('plan')
    expect(s?.message).toContain('One refill left')
  })

  it('never uses an em-dash (house copy rule)', () => {
    for (const p of [rx({ refillsRemaining: 0 }), rx({ refillsRemaining: 1 }), rx({ expirationDate: '2026-06-01' })]) {
      const s = rxSupplyStatus({ ...base, prescription: p })
      expect(s?.message).not.toContain('—')
    }
  })
})

describe('renewalStatus (existing behavior, pinned)', () => {
  it('needs-renewal on 0 refills or expiry; due-soon on last refill', () => {
    expect(renewalStatus(rx({ refillsRemaining: 0 }), 30, NOW)).toBe('needs-renewal')
    expect(renewalStatus(rx({ expirationDate: '2026-06-01' }), 30, NOW)).toBe('needs-renewal')
    expect(renewalStatus(rx({ refillsRemaining: 1 }), 30, NOW)).toBe('due-soon')
    expect(renewalStatus(rx({ refillsRemaining: 5 }), 30, NOW)).toBe('ok')
  })
})

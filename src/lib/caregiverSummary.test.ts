import { describe, it, expect } from 'vitest'
import type { Product } from '@/lib/store'
import { ACT_WINDOW_DAYS, runOutDate, summarizeForCaregiver } from './caregiverSummary'

/**
 * A parent who is told "everything's covered" stops looking, so this summary is
 * only useful if it is never more comfortable than the patient's own view.
 *
 * The earlier hand-rolled version drifted three ways and all three pointed the
 * same, wrong direction. These pin the corrections.
 */
function product(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Guardian 4 Sensor',
    brand: 'MiniMed',
    category: 'cgm_sensor',
    quantity: 5,
    remainingDays: 35,
    lastScanned: '2026-08-01',
    usageRatePerDay: 0.143,
    ...over,
  }
}

describe('the parent never sees a rosier number than the patient', () => {
  it('floors a partial day instead of rounding it up', () => {
    // 5 / 1.1 = 4.54 days. Rounding gives 5, which promises a day that is not there.
    const { items } = summarizeForCaregiver([product({ quantity: 5, usageRatePerDay: 1.1 })])
    expect(items[0].runwayDays).toBe(4)
  })

  it('lets an expiry cut the runway short', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 3)
    const { items } = summarizeForCaregiver([
      product({ quantity: 50, usageRatePerDay: 1, expirationDate: soon.toISOString().slice(0, 10) }),
    ])
    // Fifty left, but they expire in three days.
    expect(items[0].runwayDays).toBeLessThanOrEqual(3)
  })

  it('lets an opened vial discard date cut the runway short', () => {
    const opened = new Date()
    opened.setDate(opened.getDate() - 26)
    const { items } = summarizeForCaregiver([
      product({
        quantity: 1,
        usageRatePerDay: 0.05,
        openedDate: opened.toISOString().slice(0, 10),
        inUseDays: 28,
      }),
    ])
    // Twenty days of insulin left in the vial, but it must be discarded in two.
    expect(items[0].runwayDays).toBeLessThanOrEqual(2)
  })

  it('counts delivery time, so the parent is not told to relax after the patient was warned', () => {
    // 20 days left, 14-day buffer: fine on its own, not fine with 10 days shipping.
    const p = product({ quantity: 20, usageRatePerDay: 1, leadTimeDays: 10 })
    expect(summarizeForCaregiver([p], {}, 14).items[0].status).toBe('low')
    // Same item with a same-day pickup is genuinely fine.
    expect(summarizeForCaregiver([product({ quantity: 20, usageRatePerDay: 1, leadTimeDays: 0 })], {}, 14)
      .items[0].status).toBe('ok')
  })
})

describe('do I need to act this week?', () => {
  const out = product({ id: 'a', name: 'Reservoirs', quantity: 0 })
  const soon = product({ id: 'b', name: 'Sensors', quantity: 3, usageRatePerDay: 1 })
  const later = product({ id: 'c', name: 'Sets', quantity: 60, usageRatePerDay: 1, leadTimeDays: 0 })

  it('includes anything running out inside the window', () => {
    const { actingSoon } = summarizeForCaregiver([soon], {}, 14)
    expect(actingSoon.map((i) => i.product.name)).toEqual(['Sensors'])
  })

  it('always includes something already out, whatever the window says', () => {
    const { actingSoon } = summarizeForCaregiver([out], {}, 14)
    expect(actingSoon.map((i) => i.product.name)).toEqual(['Reservoirs'])
  })

  it('leaves out what is comfortably far away', () => {
    const { actingSoon } = summarizeForCaregiver([later], {}, 14)
    expect(actingSoon).toEqual([])
  })

  it('puts the most urgent item first', () => {
    const { actingSoon, mostUrgent } = summarizeForCaregiver([later, soon, out], {}, 14)
    expect(mostUrgent?.product.name).toBe('Reservoirs')
    expect(actingSoon[0].product.name).toBe('Reservoirs')
  })

  it('plans in weeks', () => {
    expect(ACT_WINDOW_DAYS).toBe(7)
  })
})

describe('the overall state', () => {
  it('says act when something is out', () => {
    expect(summarizeForCaregiver([product({ quantity: 0 })]).overall).toBe('act')
  })

  it('says watch when something is low but nothing is out', () => {
    expect(summarizeForCaregiver([product({ quantity: 3, usageRatePerDay: 1 })], {}, 14).overall)
      .toBe('watch')
  })

  it('says good only when nothing is alarming', () => {
    const { overall, actingSoon } = summarizeForCaregiver(
      [product({ quantity: 60, usageRatePerDay: 1, leadTimeDays: 0 })], {}, 14,
    )
    expect(overall).toBe('good')
    expect(actingSoon).toEqual([])
  })

  it('is good, not act, when the shelf is simply empty', () => {
    // Nothing tracked is not the same as nothing left.
    expect(summarizeForCaregiver([]).overall).toBe('good')
  })

  it('respects an optimistic quantity edit the parent just made', () => {
    // "Use one" updates the screen before the write lands; the state must follow.
    const p = product({ id: 'x', quantity: 1, usageRatePerDay: 1 })
    expect(summarizeForCaregiver([p], { x: 0 }).outCount).toBe(1)
  })
})

describe('runOutDate', () => {
  it('turns a day count into a date the parent can plan around', () => {
    const from = new Date('2026-08-23T12:00:00')
    expect(runOutDate(4, from).getDate()).toBe(27)
  })

  it('treats an already-empty item as today, never yesterday', () => {
    const from = new Date('2026-08-23T12:00:00')
    expect(runOutDate(-3, from).getDate()).toBe(23)
  })
})

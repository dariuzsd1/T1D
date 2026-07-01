import { describe, it, expect } from 'vitest'
import { buildAgenda, formatAgendaDate } from './homeAgenda'
import type { Product } from './store'
import type { Appointment } from './appointments'
import type { Prescription } from './prescriptions'

const NOW = new Date('2026-07-01T12:00:00Z')

function product(over: Partial<Product>): Product {
  return {
    id: 'p', brand: '', name: 'Item', category: 'other', quantity: 5,
    remainingDays: 20, lastScanned: '2026-07-01', usageRatePerDay: 0.33,
    ...over,
  }
}
function appt(over: Partial<Appointment>): Appointment {
  return { id: 'a', title: 'Endo', description: null, appointmentDate: '2026-07-20T15:00:00Z', appointmentType: 'endocrinology', notes: null, ...over }
}
function rx(over: Partial<Prescription>): Prescription {
  return { id: 'r', medicationName: 'Humalog', dosage: null, prescriber: null, pharmacy: null, rxNumber: null, writtenDate: null, expirationDate: '2026-08-01', refillsRemaining: 2, lastFilledDate: null, notes: null, ...over }
}

describe('buildAgenda — honesty (never fabricates)', () => {
  it('returns nothing when there is no dated data', () => {
    expect(buildAgenda({ inventory: [product({})], appointments: [], prescriptions: [], now: NOW })).toEqual([])
  })

  it('omits refill when interval OR last-filled is missing', () => {
    const noInterval = product({ lastFilledDate: '2026-06-01', refillIntervalDays: null })
    const noFill = product({ lastFilledDate: null, refillIntervalDays: 90 })
    expect(buildAgenda({ inventory: [noInterval, noFill], appointments: [], prescriptions: [], now: NOW })).toEqual([])
  })

  it('omits an appointment / prescription with no usable date', () => {
    const badAppt = appt({ appointmentDate: 'not-a-date' })
    const undatedRx = rx({ expirationDate: null })
    expect(buildAgenda({ inventory: [], appointments: [badAppt], prescriptions: [undatedRx], now: NOW })).toEqual([])
  })
})

describe('buildAgenda — content & ordering', () => {
  it('includes real rows and sorts by date ascending', () => {
    const items = buildAgenda({
      inventory: [product({ name: 'Omnipod 5 Pods', refillIntervalDays: 90, lastFilledDate: '2026-05-01' })],
      appointments: [appt({ appointmentDate: '2026-07-20T15:00:00Z' })],
      prescriptions: [rx({ expirationDate: '2026-08-01' })],
      now: NOW,
    })
    expect(items.map((i) => i.kind)).toEqual(['refill', 'appointment', 'prescription'])
    // refill eligible = 2026-05-01 + 90*0.75 = ~2026-07-05, before the appointment
    expect(items[0].date.getTime()).toBeLessThan(items[1].date.getTime())
    expect(items[1].date.getTime()).toBeLessThan(items[2].date.getTime())
  })

  it('drops past appointments but keeps future ones', () => {
    const items = buildAgenda({ inventory: [], appointments: [appt({ appointmentDate: '2026-06-01T00:00:00Z' })], prescriptions: [], now: NOW })
    expect(items).toEqual([])
  })

  it('clamps an already-eligible refill to today (never negative/stale)', () => {
    const items = buildAgenda({ inventory: [product({ refillIntervalDays: 30, lastFilledDate: '2026-01-01' })], appointments: [], prescriptions: [], now: NOW })
    expect(items).toHaveLength(1)
    expect(formatAgendaDate(items[0].date, NOW)).toBe('Today')
  })
})

describe('formatAgendaDate', () => {
  it('labels today and tomorrow', () => {
    expect(formatAgendaDate(new Date('2026-07-01T20:00:00Z'), NOW)).toBe('Today')
    expect(formatAgendaDate(new Date('2026-07-02T08:00:00Z'), NOW)).toBe('Tomorrow')
  })
})

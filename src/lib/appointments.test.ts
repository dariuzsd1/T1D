import { describe, it, expect } from 'vitest'
import { appointmentTiming, appointmentTypeLabel } from './appointments'

describe('appointmentTiming — date-boundary logic', () => {
  const now = new Date('2026-07-07T12:00:00Z')

  it('is "past" for any date before now', () => {
    expect(appointmentTiming('2026-07-06T12:00:00Z', 7, now)).toBe('past')
    expect(appointmentTiming('2020-01-01T00:00:00Z', 7, now)).toBe('past')
  })

  it('is "soon" for a date within the lead window (inclusive)', () => {
    expect(appointmentTiming('2026-07-10T12:00:00Z', 7, now)).toBe('soon')
    expect(appointmentTiming('2026-07-14T12:00:00Z', 7, now)).toBe('soon') // exactly 7 days
  })

  it('is "upcoming" for a date past the lead window', () => {
    expect(appointmentTiming('2026-07-15T00:00:00Z', 7, now)).toBe('upcoming')
    expect(appointmentTiming('2027-01-01T00:00:00Z', 7, now)).toBe('upcoming')
  })

  it('respects a custom lead window', () => {
    // 3 days out: "soon" under a 7-day window, "upcoming" under a 1-day window.
    expect(appointmentTiming('2026-07-10T12:00:00Z', 7, now)).toBe('soon')
    expect(appointmentTiming('2026-07-10T12:00:00Z', 1, now)).toBe('upcoming')
  })

  it('never fabricates a timing for an unparseable date — falls back to upcoming', () => {
    expect(appointmentTiming('not-a-date', 7, now)).toBe('upcoming')
  })
})

describe('appointmentTypeLabel — fallback for an unrecognized type', () => {
  it('labels every known type', () => {
    expect(appointmentTypeLabel('endocrinology')).toBe('Endocrinology')
    expect(appointmentTypeLabel('pump_trainer')).toBe('Pump trainer')
    expect(appointmentTypeLabel('other')).toBe('Other')
  })

  it('falls back to "Appointment" for an unrecognized value', () => {
    expect(appointmentTypeLabel('made_up_type')).toBe('Appointment')
    expect(appointmentTypeLabel('')).toBe('Appointment')
  })
})

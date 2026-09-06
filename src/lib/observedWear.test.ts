import { describe, it, expect } from 'vitest'
import {
  observedWear,
  effectiveWearRate,
  observedDiffersFromLabel,
  MIN_OBSERVED_INTERVALS,
} from './observedWear'

/** Dates n days apart, oldest first, as the site_changes rows would be. */
const every = (...gaps: number[]) => {
  const out = ['2026-01-01']
  let t = new Date('2026-01-01').getTime()
  for (const g of gaps) {
    t += g * 86400000
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

describe('observedWear', () => {
  it('says nothing until there is enough history', () => {
    expect(observedWear([])).toBeNull()
    expect(observedWear(['2026-01-01'])).toBeNull()
    // One early failure must not be allowed to rewrite a runway.
    expect(observedWear(every(3))).toBeNull()
    expect(observedWear(every(3, 3))).toBeNull()
    expect(observedWear(every(3, 3, 3))).not.toBeNull()
    expect(observedWear(every(3, 3, 3))!.intervals).toBe(MIN_OBSERVED_INTERVALS)
  })

  it('measures the cadence someone actually keeps', () => {
    // A 10-day sensor being replaced every 8: two failures in a run of five.
    const w = observedWear(every(10, 4, 10, 8, 10), 10)!
    expect(w.medianDays).toBe(10)
    // ...and someone having a worse time of it.
    const rough = observedWear(every(6, 8, 7, 9), 10)!
    expect(rough.medianDays).toBe(7.5)
    expect(rough.ratePerDay).toBeCloseTo(1 / 7.5)
  })

  it('takes the median, so one unlogged holiday cannot make it rosier', () => {
    // Four honest 8-day cycles and one 40-day silence. A mean would read 14.4
    // and hand back a runway nobody is going to get.
    const w = observedWear(every(8, 8, 40, 8, 8), 10)!
    expect(w.medianDays).toBe(8)
  })

  it('skips a gap too long to be a wear cycle at all', () => {
    // 5x the label is somebody who stopped logging. Counting it as one long wear
    // would invent a cycle that never happened, so it is dropped, not clamped.
    const w = observedWear(every(8, 8, 200, 8), 10)!
    expect(w.intervals).toBe(3)
    expect(w.medianDays).toBe(8)
  })

  it('ignores a same-day duplicate log', () => {
    const w = observedWear(every(8, 0, 8, 8, 8), 10)!
    expect(w.intervals).toBe(4)
    expect(w.medianDays).toBe(8)
  })

  it('does not care what order the rows arrive in', () => {
    const sorted = observedWear(every(6, 7, 8, 9), 10)!
    const shuffled = observedWear([...every(6, 7, 8, 9)].reverse(), 10)!
    expect(shuffled.medianDays).toBe(sorted.medianDays)
  })

  it('drops dates it cannot read rather than guessing at them', () => {
    const w = observedWear([...every(8, 8, 8), 'not-a-date'], 10)
    expect(w).not.toBeNull()
    expect(w!.medianDays).toBe(8)
  })

  it('weighs recent behaviour over an old habit', () => {
    // Twelve 3-day cycles followed by ten 2-day ones: the window keeps the ten.
    const w = observedWear(every(...Array(12).fill(3), ...Array(10).fill(2)), 3)!
    expect(w.medianDays).toBe(2)
  })
})

describe('effectiveWearRate', () => {
  it('speeds the forecast up when someone burns through faster than the box', () => {
    const label = 0.1 // a 10-day sensor
    const observed = observedWear(every(7, 8, 7, 8), 10)
    const rate = effectiveWearRate(label, observed)
    expect(rate).toBeCloseTo(1 / 7.5)
    expect(rate).toBeGreaterThan(label)
    expect(observedDiffersFromLabel(label, observed)).toBe(true)
  })

  it('will NOT slow it down for someone stretching a sensor', () => {
    // The dangerous direction. A forecast built on getting 14 days out of a
    // 10-day sensor is a promise the app cannot keep, so the label stands.
    const label = 0.1
    const observed = observedWear(every(14, 14, 14, 14), 10)
    expect(effectiveWearRate(label, observed)).toBe(label)
    expect(observedDiffersFromLabel(label, observed)).toBe(false)
  })

  it('leaves an item alone when there is no history yet', () => {
    expect(effectiveWearRate(0.1, null)).toBe(0.1)
    expect(observedDiffersFromLabel(0.1, null)).toBe(false)
  })

  it('never turns an unknown rate into a real-looking one', () => {
    // An item with no rate shows a labelled estimate. It must not acquire a
    // confident number through the back door just because sites were logged.
    const observed = observedWear(every(7, 7, 7, 7), 10)
    expect(effectiveWearRate(0, observed)).toBe(0)
  })
})

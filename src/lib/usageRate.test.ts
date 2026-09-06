import { describe, it, expect } from 'vitest'
import { needsUsageRate, needsInsulinRate, insulinRatePerDay, parseUsagePerDay } from './usageRate'

describe('needsUsageRate', () => {
  it('asks for the per-person consumables', () => {
    for (const c of ['bg_supply', 'mdi_supply', 'ketone_supply', 'hypo_treatment']) {
      expect(needsUsageRate(c, 0)).toBe(true)
    }
  })

  it('never asks for something the catalog already knows', () => {
    // A worn item has a verified rate that is the same for everyone.
    expect(needsUsageRate('cgm_sensor', 0.1)).toBe(false)
    expect(needsUsageRate('infusion_set', 0.33)).toBe(false)
    // Even a consumable stops asking once a rate is recorded.
    expect(needsUsageRate('bg_supply', 6)).toBe(false)
  })

  it('does not ask for categories where a daily rate is meaningless', () => {
    // Pumps and rescue meds are judged on equipment life and expiry, not usage.
    for (const c of ['patch_pump', 'glucagon', 'skin_care', 'other', 'insulin', 'cgm_sensor']) {
      expect(needsUsageRate(c, 0)).toBe(false)
    }
    expect(needsUsageRate(null, 0)).toBe(false)
    expect(needsUsageRate(undefined, 0)).toBe(false)
  })
})

describe('needsInsulinRate', () => {
  it('asks about insulin, which nothing used to', () => {
    expect(needsInsulinRate('insulin', 0)).toBe(true)
  })

  it('stops asking once a rate is recorded', () => {
    expect(needsInsulinRate('insulin', 0.04)).toBe(false)
  })

  it('claims nothing outside insulin', () => {
    for (const c of ['bg_supply', 'cgm_sensor', 'patch_pump', 'glucagon', 'other', null, undefined]) {
      expect(needsInsulinRate(c, 0)).toBe(false)
    }
  })

  it('never overlaps with the single-field prompt', () => {
    // The two prompts must be mutually exclusive. If insulin ever satisfied both,
    // a dose typed into the one-field prompt would be stored as a count of
    // containers -- see the note on needsInsulinRate.
    for (const c of ['insulin', 'bg_supply', 'mdi_supply', 'ketone_supply', 'hypo_treatment', 'cgm_sensor']) {
      expect(needsUsageRate(c, 0) && needsInsulinRate(c, 0)).toBe(false)
    }
  })
})

describe('insulinRatePerDay', () => {
  it('turns a dose and a container size into containers per day', () => {
    expect(insulinRatePerDay(40, 1000)).toBeCloseTo(0.04) // 25 days a vial
    expect(insulinRatePerDay(30, 300)).toBeCloseTo(0.1) // 10 days a pen
    expect(insulinRatePerDay(8, 1000)).toBeCloseTo(0.008)
  })

  it('is exactly what the app would otherwise get wrong by a factor of the container', () => {
    // The bug this shape prevents: 40 units a day read as 40 containers a day.
    const right = insulinRatePerDay(40, 1000)
    expect(right).toBeLessThan(1)
    expect(40 / right).toBeCloseTo(1000)
  })

  it('returns 0 for a half-filled or nonsense form rather than a wrong rate', () => {
    expect(insulinRatePerDay(40, 0)).toBe(0)
    expect(insulinRatePerDay(0, 1000)).toBe(0)
    expect(insulinRatePerDay(NaN, 1000)).toBe(0)
    expect(insulinRatePerDay(40, NaN)).toBe(0)
    expect(insulinRatePerDay(-40, 1000)).toBe(0)
    expect(insulinRatePerDay(40, -1000)).toBe(0)
    expect(insulinRatePerDay(Infinity, 1000)).toBe(0)
  })
})

describe('parseUsagePerDay', () => {
  it('accepts sensible answers, including decimals and a comma decimal mark', () => {
    expect(parseUsagePerDay('6')).toBe(6)
    expect(parseUsagePerDay(' 4.5 ')).toBe(4.5)
    expect(parseUsagePerDay('0,5')).toBe(0.5)
  })

  it('refuses anything that is not a usable rate', () => {
    // A stray keystroke must never silently become a usage rate.
    for (const bad of ['', '   ', 'abc', '0', '-2', 'NaN', 'Infinity', '1e9', '101']) {
      expect(parseUsagePerDay(bad)).toBeNull()
    }
  })
})

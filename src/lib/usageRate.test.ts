import { describe, it, expect } from 'vitest'
import { needsUsageRate, parseUsagePerDay } from './usageRate'

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

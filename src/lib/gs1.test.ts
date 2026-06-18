import { describe, it, expect } from 'vitest'
import { parseGs1, gs1DateToIso } from './gs1'

describe('gs1DateToIso', () => {
  it('converts YYMMDD to ISO', () => {
    expect(gs1DateToIso('261231')).toBe('2026-12-31')
    expect(gs1DateToIso('260115')).toBe('2026-01-15')
  })

  it('treats day 00 as the last day of the month', () => {
    expect(gs1DateToIso('260600')).toBe('2026-06-30') // June has 30 days
    expect(gs1DateToIso('260200')).toBe('2026-02-28') // Feb 2026 (not a leap year)
  })

  it('maps the two-digit year per the GS1 window (00-50 → 2000s, 51-99 → 1900s)', () => {
    expect(gs1DateToIso('500101')).toBe('2050-01-01')
    expect(gs1DateToIso('990101')).toBe('1999-01-01')
  })

  it('returns undefined for invalid input', () => {
    expect(gs1DateToIso('261301')).toBeUndefined() // month 13
    expect(gs1DateToIso('2612')).toBeUndefined() // too short
    expect(gs1DateToIso('abcdef')).toBeUndefined()
  })
})

describe('parseGs1', () => {
  it('treats a plain UPC/EAN as a bare GTIN (left-padded to 14)', () => {
    const r = parseGs1('012345678905')
    expect(r.gtin).toBe('00012345678905')
    expect(r.expirationDate).toBeUndefined()
    expect(r.raw).toBe('012345678905')
  })

  it('parses a GS1 element string: GTIN (01) + expiry (17)', () => {
    // 01 + 14-digit GTIN + 17 + YYMMDD
    const r = parseGs1('010031234567890617261231')
    expect(r.gtin).toBe('00312345678906')
    expect(r.expirationDate).toBe('2026-12-31')
  })

  it('captures a variable-length lot (AI 10) to the end of the string', () => {
    const r = parseGs1('010031234567890610ABC123')
    expect(r.gtin).toBe('00312345678906')
    expect(r.lot).toBe('ABC123')
  })

  it('always preserves the raw decoded value', () => {
    expect(parseGs1('whatever-raw').raw).toBe('whatever-raw')
  })
})

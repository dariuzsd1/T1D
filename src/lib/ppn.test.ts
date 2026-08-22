import { describe, it, expect } from 'vitest'
import { parsePpn, looksLikePpn, pznFromPpn } from './ppn'
import { parseSupplyCode, pznFromNtinGtin } from './supplyCode'

const GS = '\x1d'
const RS = '\x1e'
const EOT = '\x04'

// A real German Humalog pack: PZN 07242491, batch D934903A, serial
// 300973328536, expiry 06/2028. The PPN is PRA-code 11 + PZN + 2 check digits.
const humalogPpn =
  `[)>${RS}06${GS}9N110724249168${GS}1TD934903A${GS}S300973328536${GS}D280600${RS}${EOT}`

describe('parsePpn — IFA PPN / German securPharm', () => {
  it('parses the real Humalog PPN (envelope + all four fields)', () => {
    const p = parsePpn(humalogPpn)
    expect(p.ppn).toBe('110724249168')
    expect(p.pzn).toBe('07242491')
    expect(p.lot).toBe('D934903A')
    expect(p.serial).toBe('300973328536')
    // "06 2028" → YYMMDD 280600, day 00 → last day of the month.
    expect(p.expirationDate).toBe('2028-06-30')
  })

  it('parses a bare PPN string with no envelope and "#" separators', () => {
    const p = parsePpn('9N110724249168#1TD934903A#S300973328536#D280600')
    expect(p.pzn).toBe('07242491')
    expect(p.lot).toBe('D934903A')
    expect(p.expirationDate).toBe('2028-06-30')
  })

  it('recovers the PZN with or without trailing check digits', () => {
    expect(pznFromPpn('110724249168')).toBe('07242491')
    expect(pznFromPpn('1107242491')).toBe('07242491')
    // Wrong PRA-code or wrong length → no guess.
    expect(pznFromPpn('120724249168')).toBeUndefined()
    expect(pznFromPpn('11abc')).toBeUndefined()
  })

  it('only surfaces fields it actually decoded', () => {
    const p = parsePpn(`9N110724249168${GS}D280600`)
    expect(p.pzn).toBe('07242491')
    expect(p.expirationDate).toBe('2028-06-30')
    expect(p.lot).toBeUndefined()
    expect(p.serial).toBeUndefined()
  })

  it('detects PPN vs GS1', () => {
    expect(looksLikePpn(humalogPpn)).toBe(true)
    expect(looksLikePpn('9N110724249168')).toBe(true)
    // A GS1 device code is not a PPN.
    expect(looksLikePpn('0100763000532222172903081002338373152001')).toBe(false)
  })
})

describe('parseSupplyCode — one entry point, any country', () => {
  it('routes a German PPN medicine to the PPN parser', () => {
    const c = parseSupplyCode(humalogPpn)
    expect(c.codeType).toBe('ppn')
    expect(c.pzn).toBe('07242491')
    expect(c.gtin).toBeUndefined()
    expect(c.expirationDate).toBe('2028-06-30')
  })

  it('routes a GS1 device code to the GS1 parser (box 3, real Reservoir)', () => {
    const c = parseSupplyCode('0100763000532222172903081002338373152001')
    expect(c.codeType).toBe('gs1')
    expect(c.gtin).toBe('00763000532222')
    expect(c.expirationDate).toBe('2029-03-08')
  })

  it('reads a plain EAN-13 (box 1, Mio Advance) as a bare GTIN', () => {
    const c = parseSupplyCode('5705244018877')
    expect(c.codeType).toBe('plain')
    expect(c.gtin).toBe('05705244018877')
  })

  it('recovers the PZN from a German NTIN (a GTIN that embeds the PZN)', () => {
    // NTIN GTIN-14: 0 + 4150 + PZN(07242491) + check(8).
    expect(pznFromNtinGtin('04150072424918')).toBe('07242491')
    const c = parseSupplyCode('0104150072424918')
    expect(c.codeType).toBe('gs1')
    expect(c.gtin).toBe('04150072424918')
    expect(c.pzn).toBe('07242491')
  })

  it('reads a German PZN linear barcode (the small Code 39 on the Humalog box)', () => {
    // Explicit "PZN"/dash markers work regardless of symbology.
    expect(parseSupplyCode('PZN-07242491').pzn).toBe('07242491')
    expect(parseSupplyCode('PZN 07242491').pzn).toBe('07242491')
    expect(parseSupplyCode('-07242491').pzn).toBe('07242491')
    // A bare number is a PZN only when the scanner reports Code 39.
    const fromScanner = parseSupplyCode('07242491', 'CODE_39')
    expect(fromScanner.codeType).toBe('ppn')
    expect(fromScanner.pzn).toBe('07242491')
  })

  it('parses a bracketed GS1 DataMatrix (NTIN medicine) and derives the PZN', () => {
    // The exact string a 2D decoder returned for a German Humalog box: the
    // human-readable "(AI)" form, with an NTIN GTIN that embeds PZN 07242491.
    const c = parseSupplyCode('(01)04150072424917(21)300979928536(17)280630(10)D934903A')
    expect(c.codeType).toBe('gs1')
    expect(c.gtin).toBe('04150072424917')
    expect(c.pzn).toBe('07242491')
    expect(c.expirationDate).toBe('2028-06-30')
    expect(c.lot).toBe('D934903A')
    expect(c.serial).toBe('300979928536')
  })

  it('does NOT extract an NDC from a device GTIN in the 003 range (Dexcom etc.)', () => {
    // The 003 UPC drug range is shared by many devices, so NDC is not derived at
    // all — a US product matches by GTIN, not a fabricated NDC.
    const c = parseSupplyCode('(01)00386270002839(17)261130(10)LOT9')
    expect(c.gtin).toBe('00386270002839')
    expect((c as { ndc?: string }).ndc).toBeUndefined()
  })

  it('derives a French CIP from a CIP13-based GTIN (3400…)', () => {
    const c = parseSupplyCode('(01)03400123456789(17)261031')
    expect(c.cip).toBe('3400123456789')
    expect(c.gtin).toBe('03400123456789')
  })

  it('reads NHRN AIs when the box states them outright — 710 (PZN), 711 (CIP)', () => {
    // Bracketed form
    expect(parseSupplyCode('(01)09999999999993(710)07242491(17)280630').pzn).toBe('07242491')
    expect(parseSupplyCode('(01)09999999999993(711)3400999888777').cip).toBe('3400999888777')
    // Raw FNC1-separated form: (01)09999999999993 (710)07242491 <GS> (17)280630
    const raw = parseSupplyCode(`010999999999999371007242491${GS}17280630`)
    expect(raw.pzn).toBe('07242491')
    expect(raw.expirationDate).toBe('2028-06-30')
  })

  it('does NOT mistake a bare numeric UPC/EAN for a PZN', () => {
    // No Code-39 hint → a bare 8-digit code stays a GTIN, not a PZN.
    const c = parseSupplyCode('07242491')
    expect(c.codeType).toBe('plain')
    expect(c.gtin).toBe('00000007242491')
    expect(c.pzn).toBeUndefined()
    // A 13-digit EAN is never a PZN even from a Code 39 misreport.
    expect(parseSupplyCode('5705244018877', 'CODE_39').pzn).toBeUndefined()
  })
})

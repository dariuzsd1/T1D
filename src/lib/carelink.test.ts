import { describe, it, expect } from 'vitest'
import { parseCareLink, parseCsvLine } from './carelink'

// ── parseCsvLine ──────────────────────────────────────────────────────────────

describe('parseCsvLine', () => {
  it('splits a simple comma-delimited line', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('handles quoted fields containing commas', () => {
    expect(parseCsvLine('"hello, world",b')).toEqual(['hello, world', 'b'])
  })

  it('handles escaped double-quotes inside quoted fields', () => {
    expect(parseCsvLine('"say ""hi""",b')).toEqual(['say "hi"', 'b'])
  })

  it('trims whitespace from unquoted fields', () => {
    expect(parseCsvLine('a , b , c')).toEqual(['a', 'b', 'c'])
  })

  it('returns a single-element array for a line with no commas', () => {
    expect(parseCsvLine('RESERVOIR_CHANGE')).toEqual(['RESERVOIR_CHANGE'])
  })
})

// ── Shared sample CSV data ────────────────────────────────────────────────────

// Minimal CareLink Personal CSV with the columns we care about.
// Real exports have ~30+ columns; the parser only uses Raw-Type and Date.
const HEADER =
  'Index,Date,Time,Timestamp (YYYY-MM-DDThh:mm:ss),Raw-Type,Raw-Values,Raw-ID'

function makeRow(
  date: string,
  time: string,
  rawType: string,
  index = 1
): string {
  return `${index},${date},${time},,${rawType},,`
}

// ── parseCareLink — format detection ─────────────────────────────────────────

describe('parseCareLink — format detection', () => {
  it('returns format=unknown for an empty string', () => {
    const result = parseCareLink('')
    expect(result.format).toBe('unknown')
    expect(result.recognized).toHaveLength(0)
  })

  it('returns format=unknown when no Raw-Type column is present', () => {
    const csv = 'Date,Time,Glucose\n2024-06-01,08:00,120\n'
    const result = parseCareLink(csv)
    expect(result.format).toBe('unknown')
  })

  it('returns format=carelink-personal when Raw-Type column is found', () => {
    const csv = [HEADER, makeRow('06/01/2024', '08:00:00', 'RESERVOIR_CHANGE')].join('\n')
    const result = parseCareLink(csv)
    expect(result.format).toBe('carelink-personal')
  })

  it('finds the header even when preceded by metadata rows', () => {
    const csv = [
      'CareLink Report',
      'Patient Name,Test User',
      '',
      HEADER,
      makeRow('06/01/2024', '08:00:00', 'SENSOR_INSERT'),
    ].join('\n')
    const result = parseCareLink(csv)
    expect(result.format).toBe('carelink-personal')
    expect(result.recognized).toHaveLength(1)
    expect(result.recognized[0].kind).toBe('sensor')
  })
})

// ── parseCareLink — event counting ───────────────────────────────────────────

describe('parseCareLink — event counting', () => {
  it('counts reservoir changes', () => {
    const csv = [
      HEADER,
      makeRow('06/01/2024', '08:00:00', 'RESERVOIR_CHANGE', 1),
      makeRow('06/04/2024', '08:00:00', 'RESERVOIR_CHANGE', 2),
      makeRow('06/07/2024', '08:00:00', 'RESERVOIR_CHANGE', 3),
    ].join('\n')
    const result = parseCareLink(csv)
    const r = result.recognized.find(k => k.kind === 'reservoir')
    expect(r?.count).toBe(3)
  })

  it('counts sensor insertions (SENSOR_INSERT)', () => {
    const csv = [
      HEADER,
      makeRow('06/01/2024', '08:00:00', 'SENSOR_INSERT', 1),
      makeRow('06/11/2024', '08:00:00', 'SENSOR_INSERT', 2),
    ].join('\n')
    const result = parseCareLink(csv)
    const r = result.recognized.find(k => k.kind === 'sensor')
    expect(r?.count).toBe(2)
  })

  it('counts sensor insertions (SENSOR_INSERTED alias)', () => {
    const csv = [HEADER, makeRow('06/01/2024', '08:00:00', 'SENSOR_INSERTED')].join('\n')
    const result = parseCareLink(csv)
    const r = result.recognized.find(k => k.kind === 'sensor')
    expect(r?.count).toBe(1)
  })

  it('counts infusion site changes (PRIME alias)', () => {
    const csv = [
      HEADER,
      makeRow('06/01/2024', '08:00:00', 'PRIME', 1),
      makeRow('06/04/2024', '08:00:00', 'PRIME', 2),
    ].join('\n')
    const result = parseCareLink(csv)
    const r = result.recognized.find(k => k.kind === 'infusion_set')
    expect(r?.count).toBe(2)
  })

  it('counts all three kinds independently', () => {
    const csv = [
      HEADER,
      makeRow('06/01/2024', '08:00:00', 'RESERVOIR_CHANGE', 1),
      makeRow('06/01/2024', '09:00:00', 'SENSOR_INSERT', 2),
      makeRow('06/01/2024', '09:05:00', 'PRIME', 3),
      makeRow('06/04/2024', '08:00:00', 'RESERVOIR_CHANGE', 4),
    ].join('\n')
    const result = parseCareLink(csv)
    expect(result.recognized.find(k => k.kind === 'reservoir')?.count).toBe(2)
    expect(result.recognized.find(k => k.kind === 'sensor')?.count).toBe(1)
    expect(result.recognized.find(k => k.kind === 'infusion_set')?.count).toBe(1)
  })

  it('skips unrecognised Raw-Type values', () => {
    const csv = [
      HEADER,
      makeRow('06/01/2024', '08:00:00', 'SENSOR_GLUCOSE_READINGS_EXTENDED_ITEM', 1),
      makeRow('06/01/2024', '08:05:00', 'BG_READING', 2),
      makeRow('06/01/2024', '08:10:00', 'NORMAL_BOLUS_DELIVERED', 3),
    ].join('\n')
    const result = parseCareLink(csv)
    expect(result.recognized).toHaveLength(0)
    expect(result.skippedRows).toBe(3)
    expect(result.dataRows).toBe(3)
  })

  it('is case-insensitive for Raw-Type values', () => {
    const csv = [HEADER, makeRow('06/01/2024', '08:00:00', 'reservoir_change')].join('\n')
    const result = parseCareLink(csv)
    expect(result.recognized.find(k => k.kind === 'reservoir')?.count).toBe(1)
  })
})

// ── parseCareLink — date range ────────────────────────────────────────────────

describe('parseCareLink — date range', () => {
  it('tracks first and last date for each kind', () => {
    const csv = [
      HEADER,
      makeRow('06/01/2024', '08:00:00', 'RESERVOIR_CHANGE', 1),
      makeRow('06/07/2024', '08:00:00', 'RESERVOIR_CHANGE', 2),
      makeRow('06/14/2024', '08:00:00', 'RESERVOIR_CHANGE', 3),
    ].join('\n')
    const result = parseCareLink(csv)
    const r = result.recognized.find(k => k.kind === 'reservoir')!
    expect(r.firstDate).toBe('06/01/2024')
    expect(r.lastDate).toBe('06/14/2024')
  })

  it('reports null dates when Date column is missing values', () => {
    const csvNoDate = 'Index,Time,Raw-Type\n1,08:00:00,RESERVOIR_CHANGE\n'
    const result = parseCareLink(csvNoDate)
    const r = result.recognized.find(k => k.kind === 'reservoir')
    expect(r?.firstDate).toBeNull()
    expect(r?.lastDate).toBeNull()
  })
})

// ── parseCareLink — row accounting ───────────────────────────────────────────

describe('parseCareLink — row accounting', () => {
  it('counts dataRows and skippedRows accurately', () => {
    const csv = [
      HEADER,
      makeRow('06/01/2024', '08:00:00', 'RESERVOIR_CHANGE', 1),
      makeRow('06/01/2024', '08:05:00', 'BG_READING', 2),
      makeRow('06/01/2024', '08:10:00', 'SENSOR_INSERT', 3),
      '',           // blank line should not count
    ].join('\n')
    const result = parseCareLink(csv)
    expect(result.dataRows).toBe(3)
    expect(result.skippedRows).toBe(1) // BG_READING skipped
  })

  it('handles Windows CRLF line endings', () => {
    const csv = `${HEADER}\r\n${makeRow('06/01/2024', '08:00:00', 'SENSOR_INSERT')}\r\n`
    const result = parseCareLink(csv)
    expect(result.recognized.find(k => k.kind === 'sensor')?.count).toBe(1)
  })
})

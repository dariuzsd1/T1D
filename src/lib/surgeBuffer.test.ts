import { describe, it, expect } from 'vitest'
import {
  isSurgeActive,
  surgeDaysLeft,
  effectiveBuffer,
  readStoredSurge,
  surgeUntilInDays,
  parseSurgeDate,
  type SurgeBuffer,
} from './surgeBuffer'

// Fixed "now" (local noon) so day-boundary math is unambiguous.
const NOW = new Date(2026, 6, 9, 12, 0, 0) // 2026-07-09

function until(days: number): string {
  return surgeUntilInDays(days, NOW)
}

describe('parseSurgeDate', () => {
  it('parses yyyy-mm-dd as a local date (no UTC shift)', () => {
    const d = parseSurgeDate('2026-07-20')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(20)
  })
  it('returns null on garbage', () => {
    expect(parseSurgeDate('nope')).toBeNull()
    expect(parseSurgeDate('2026-13-40')).not.toBeNull() // JS rolls over; still a Date
    expect(parseSurgeDate('')).toBeNull()
  })
})

describe('surgeUntilInDays', () => {
  it('produces a yyyy-mm-dd N days ahead', () => {
    expect(surgeUntilInDays(0, NOW)).toBe('2026-07-09')
    expect(surgeUntilInDays(7, NOW)).toBe('2026-07-16')
    expect(surgeUntilInDays(14, NOW)).toBe('2026-07-23')
  })
})

describe('isSurgeActive', () => {
  it('is false for null/undefined', () => {
    expect(isSurgeActive(null, NOW)).toBe(false)
    expect(isSurgeActive(undefined, NOW)).toBe(false)
  })
  it('is false when extraDays is 0 or negative', () => {
    expect(isSurgeActive({ extraDays: 0, untilDate: until(7) }, NOW)).toBe(false)
    expect(isSurgeActive({ extraDays: -5, untilDate: until(7) }, NOW)).toBe(false)
  })
  it('is true within the window and on the last day', () => {
    expect(isSurgeActive({ extraDays: 7, untilDate: until(3) }, NOW)).toBe(true)
    expect(isSurgeActive({ extraDays: 7, untilDate: until(0) }, NOW)).toBe(true) // ends today
  })
  it('is false after the window', () => {
    expect(isSurgeActive({ extraDays: 7, untilDate: '2026-07-08' }, NOW)).toBe(false)
  })
  it('is false on a malformed date', () => {
    expect(isSurgeActive({ extraDays: 7, untilDate: 'nope' }, NOW)).toBe(false)
  })
})

describe('surgeDaysLeft', () => {
  it('is null when inactive', () => {
    expect(surgeDaysLeft(null, NOW)).toBeNull()
    expect(surgeDaysLeft({ extraDays: 7, untilDate: '2026-07-01' }, NOW)).toBeNull()
  })
  it('counts whole days remaining, 0 on the last day', () => {
    expect(surgeDaysLeft({ extraDays: 7, untilDate: until(0) }, NOW)).toBe(0)
    expect(surgeDaysLeft({ extraDays: 7, untilDate: until(5) }, NOW)).toBe(5)
  })
})

describe('effectiveBuffer', () => {
  it('returns the plain base when no surge', () => {
    expect(effectiveBuffer(14, null, NOW)).toBe(14)
  })
  it('adds extra days while active', () => {
    expect(effectiveBuffer(14, { extraDays: 7, untilDate: until(3) }, NOW)).toBe(21)
  })
  it('reverts to base once expired (fails safe, never under-reserves)', () => {
    expect(effectiveBuffer(14, { extraDays: 7, untilDate: '2026-07-01' }, NOW)).toBe(14)
  })
  it('ignores a non-positive extra', () => {
    expect(effectiveBuffer(14, { extraDays: 0, untilDate: until(3) }, NOW)).toBe(14)
  })
})

describe('readStoredSurge', () => {
  it('returns null for missing / empty', () => {
    expect(readStoredSurge(null, NOW)).toBeNull()
    expect(readStoredSurge('', NOW)).toBeNull()
  })
  it('returns null for malformed JSON or wrong shape', () => {
    expect(readStoredSurge('{not json', NOW)).toBeNull()
    expect(readStoredSurge('42', NOW)).toBeNull()
    expect(readStoredSurge(JSON.stringify({ extraDays: 'x', untilDate: until(3) }), NOW)).toBeNull()
    expect(readStoredSurge(JSON.stringify({ extraDays: 7 }), NOW)).toBeNull()
  })
  it('returns null for an already-expired window', () => {
    expect(readStoredSurge(JSON.stringify({ extraDays: 7, untilDate: '2026-07-01' }), NOW)).toBeNull()
  })
  it('round-trips a valid active surge', () => {
    const surge: SurgeBuffer = { extraDays: 14, untilDate: until(10) }
    expect(readStoredSurge(JSON.stringify(surge), NOW)).toEqual(surge)
  })
})

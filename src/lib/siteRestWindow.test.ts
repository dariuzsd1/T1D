import { describe, it, expect } from 'vitest'
import { normalizeRestWindow, REST_WINDOW_OPTIONS } from './siteRestWindow'
import { RECENT_USE_DAYS } from './siteRotation'

describe('normalizeRestWindow', () => {
  it('accepts every offered option unchanged', () => {
    for (const opt of REST_WINDOW_OPTIONS) {
      expect(normalizeRestWindow(opt)).toBe(opt)
    }
  })

  it('parses a numeric string (as localStorage stores it)', () => {
    expect(normalizeRestWindow('21')).toBe(21)
  })

  it('falls back to the default for an unsupported or junk value', () => {
    expect(normalizeRestWindow(99)).toBe(RECENT_USE_DAYS) // out of range
    expect(normalizeRestWindow('not-a-number')).toBe(RECENT_USE_DAYS)
    expect(normalizeRestWindow(null)).toBe(RECENT_USE_DAYS)
    expect(normalizeRestWindow(undefined)).toBe(RECENT_USE_DAYS)
    expect(normalizeRestWindow(NaN)).toBe(RECENT_USE_DAYS)
  })

  it('keeps the default within the offered options (so the UI can always show it)', () => {
    expect((REST_WINDOW_OPTIONS as readonly number[]).includes(RECENT_USE_DAYS)).toBe(true)
  })
})

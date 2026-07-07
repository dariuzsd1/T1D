import { describe, it, expect } from 'vitest'
import { isValidEmail } from './caregivers'

describe('isValidEmail — catches typos before an invite is stored', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('parent@example.com')).toBe(true)
    expect(isValidEmail('first.last+tag@sub.example.co.uk')).toBe(true)
  })

  it('trims surrounding whitespace before checking', () => {
    expect(isValidEmail('  parent@example.com  ')).toBe(true)
  })

  it('rejects a missing @ or domain', () => {
    expect(isValidEmail('not-an-email')).toBe(false)
    expect(isValidEmail('missing@domain')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('   ')).toBe(false)
  })

  it('rejects embedded whitespace', () => {
    expect(isValidEmail('parent @example.com')).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { reorderTargetFor } from './suppliers'

describe('reorderTargetFor — brand/name matching with a search fallback', () => {
  it('matches a known brand directly (case-insensitive)', () => {
    const target = reorderTargetFor({ brand: 'Insulet', name: 'Omnipod 5 Pods' })
    expect(target.isDirect).toBe(true)
    expect(target.label).toBe('Omnipod')
    expect(target.url).toContain('omnipod.com')
  })

  it('matches on name alone when brand is missing', () => {
    const target = reorderTargetFor({ name: 'Dexcom G7 Sensors' })
    expect(target.isDirect).toBe(true)
    expect(target.label).toBe('Dexcom')
  })

  it('matches Tandem via a model-name keyword', () => {
    expect(reorderTargetFor({ name: 't:slim X2 Cartridge' }).label).toBe('Tandem')
  })

  it('matches FreeStyle Libre via the "libre" keyword', () => {
    expect(reorderTargetFor({ brand: 'Abbott', name: 'FreeStyle Libre 3 Sensors' }).label).toBe(
      'FreeStyle Libre'
    )
  })

  it('falls back to a search link for an unrecognized brand, never a dead end', () => {
    const target = reorderTargetFor({ brand: 'Acme Medical', name: 'Generic Lancets' })
    expect(target.isDirect).toBe(false)
    expect(target.label).toBe('find a supplier')
    expect(target.url).toContain('google.com/search')
    expect(target.url).toContain('Acme')
  })

  it('falls back gracefully with no brand or name at all', () => {
    const target = reorderTargetFor({})
    expect(target.isDirect).toBe(false)
    expect(target.url).toContain('google.com/search')
  })
})

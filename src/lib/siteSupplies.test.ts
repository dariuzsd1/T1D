import { describe, it, expect } from 'vitest'
import { isSiteSupply } from './siteSupplies'

describe('isSiteSupply', () => {
  it('accepts CGM sensors across brands', () => {
    expect(isSiteSupply({ name: 'G7 Sensor', brand: 'Dexcom' })).toBe(true)
    expect(isSiteSupply({ name: 'Guardian 4 Sensor', brand: 'Medtronic' })).toBe(true)
    expect(isSiteSupply({ name: 'FreeStyle Libre 3', brand: 'Abbott' })).toBe(true)
    expect(isSiteSupply({ name: 'Enlite sensor', brand: '' })).toBe(true)
  })

  it('accepts pump pods and infusion sets', () => {
    expect(isSiteSupply({ name: 'Omnipod 5 Pods', brand: 'Insulet' })).toBe(true)
    expect(isSiteSupply({ name: 'Pods', brand: '' })).toBe(true)
    expect(isSiteSupply({ name: 'Infusion set', brand: 'Tandem' })).toBe(true)
    expect(isSiteSupply({ name: 'AutoSoft 90', brand: 'Tandem' })).toBe(true)
    expect(isSiteSupply({ name: 'Quick-set', brand: 'Medtronic' })).toBe(true)
    expect(isSiteSupply({ name: 'Cannula', brand: '' })).toBe(true)
  })

  it('matches on brand alone when the name is generic', () => {
    expect(isSiteSupply({ name: 'Sensor', brand: 'Dexcom' })).toBe(true)
  })

  it('rejects emergency and oral items', () => {
    expect(isSiteSupply({ name: 'Baqsimi', brand: 'Lilly' })).toBe(false)
    expect(isSiteSupply({ name: 'Glucagon emergency kit', brand: '' })).toBe(false)
    expect(isSiteSupply({ name: 'Glucose tabs', brand: '' })).toBe(false)
  })

  it('rejects supplies that are not inserted at a body site', () => {
    expect(isSiteSupply({ name: 'Test strips', brand: 'Contour' })).toBe(false)
    expect(isSiteSupply({ name: 'Lancets', brand: '' })).toBe(false)
    expect(isSiteSupply({ name: 'Insulin pen needles', brand: 'BD' })).toBe(false)
    expect(isSiteSupply({ name: 'Humalog pen', brand: 'Lilly' })).toBe(false)
    expect(isSiteSupply({ name: 'Reservoir', brand: 'Tandem' })).toBe(false)
    expect(isSiteSupply({ name: 'Cartridge', brand: '' })).toBe(false)
  })

  it('handles missing fields safely', () => {
    expect(isSiteSupply({})).toBe(false)
    expect(isSiteSupply({ name: null, brand: null })).toBe(false)
  })
})

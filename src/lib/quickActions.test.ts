import { describe, it, expect } from 'vitest'
import { deriveDepletionActions } from './quickActions'
import type { Product } from './store'

function product(over: Partial<Product>): Product {
  return {
    id: 'p', brand: '', name: 'Item', category: 'other', quantity: 5,
    remainingDays: 20, lastScanned: '2026-07-01', usageRatePerDay: 0,
    ...over,
  }
}

describe('deriveDepletionActions — brand-agnostic quick log-use actions', () => {
  it('offers nothing for an empty inventory', () => {
    expect(deriveDepletionActions([])).toEqual([])
  })

  it('finds pods and sensors regardless of brand (Omnipod + Dexcom)', () => {
    const actions = deriveDepletionActions([
      product({ id: 'a', name: 'Omnipod 5 Pods' }),
      product({ id: 'b', name: 'Dexcom G7 Sensors' }),
    ])
    expect(actions.map((a) => a.kind)).toEqual(['pod', 'sensor'])
    expect(actions[0].productId).toBe('a')
    expect(actions[1].productId).toBe('b')
  })

  it('works for a Medtronic (tubed) + Libre user via reservoir/libre keywords', () => {
    const actions = deriveDepletionActions([
      product({ id: 'r', name: 'MiniMed Reservoir' }),
      product({ id: 's', name: 'FreeStyle Libre 3 Sensors' }),
    ])
    expect(actions.map((a) => a.kind)).toEqual(['site', 'sensor'])
    expect(actions.find((a) => a.kind === 'site')?.labelKey).toBe('quickActions.siteChange')
  })

  it('does not mistake the pump name "Omnipod" alone for a pods supply', () => {
    // A device-ish row named just "Omnipod 5" (no "Pods") should not match.
    const actions = deriveDepletionActions([product({ name: 'Omnipod 5' })])
    expect(actions).toEqual([])
  })

  it('never offers both a pod and a tubed site (they are the same pump site)', () => {
    const actions = deriveDepletionActions([
      product({ id: 'pod', name: 'Omnipod 5 Pods' }),
      product({ id: 'set', name: 'Infusion Set' }),
    ])
    expect(actions.filter((a) => a.kind === 'pod' || a.kind === 'site')).toHaveLength(1)
    expect(actions[0].kind).toBe('pod')
  })

  it('prefers a matching item that still has stock', () => {
    const actions = deriveDepletionActions([
      product({ id: 'empty', name: 'Dexcom G7 Sensors', quantity: 0 }),
      product({ id: 'stocked', name: 'Dexcom G7 Sensors', quantity: 3 }),
    ])
    expect(actions).toHaveLength(1)
    expect(actions[0].productId).toBe('stocked')
  })

  it('still surfaces an out-of-stock item when no stocked match exists', () => {
    const actions = deriveDepletionActions([
      product({ id: 'empty', name: 'Omnipod 5 Pods', quantity: 0 }),
    ])
    expect(actions).toHaveLength(1)
    expect(actions[0].productId).toBe('empty')
  })

  it('ignores non-wearable supplies like insulin vials', () => {
    expect(deriveDepletionActions([product({ name: 'Humalog U-100 Vial' })])).toEqual([])
  })
})

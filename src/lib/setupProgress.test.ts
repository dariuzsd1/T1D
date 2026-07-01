import { describe, it, expect } from 'vitest'
import { setupSteps, setupComplete, setupDoneCount } from './setupProgress'
import type { Product } from './store'

function product(over: Partial<Product>): Product {
  return {
    id: 'p', brand: '', name: 'Item', category: 'other', quantity: 5,
    remainingDays: 20, lastScanned: '2026-07-01', usageRatePerDay: 0,
    ...over,
  }
}

describe('setupSteps — counts reflect real data only', () => {
  it('a brand-new account has 0 of 4 done', () => {
    const steps = setupSteps({ inventory: [], deviceCount: 0 })
    expect(steps).toHaveLength(4)
    expect(setupDoneCount(steps)).toBe(0)
    expect(setupComplete(steps)).toBe(false)
  })

  it('adding a supply completes only the supply step', () => {
    const steps = setupSteps({ inventory: [product({})], deviceCount: 0 })
    expect(setupDoneCount(steps)).toBe(1)
    expect(steps.find((s) => s.key === 'supply')?.done).toBe(true)
    expect(steps.find((s) => s.key === 'usage')?.done).toBe(false)
  })

  it('a device row completes the ecosystem step', () => {
    const steps = setupSteps({ inventory: [], deviceCount: 1 })
    expect(steps.find((s) => s.key === 'device')?.done).toBe(true)
    expect(setupDoneCount(steps)).toBe(1)
  })

  it('usage and refill only count when the values are actually set', () => {
    const withUsage = setupSteps({ inventory: [product({ usageRatePerDay: 0.33 })], deviceCount: 0 })
    expect(withUsage.find((s) => s.key === 'usage')?.done).toBe(true)
    expect(withUsage.find((s) => s.key === 'refill')?.done).toBe(false)

    const withRefill = setupSteps({ inventory: [product({ refillIntervalDays: 90 })], deviceCount: 0 })
    expect(withRefill.find((s) => s.key === 'refill')?.done).toBe(true)
  })

  it('is complete only when all four are backed by data', () => {
    const steps = setupSteps({
      inventory: [product({ usageRatePerDay: 0.33, refillIntervalDays: 90 })],
      deviceCount: 2,
    })
    expect(setupDoneCount(steps)).toBe(4)
    expect(setupComplete(steps)).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import {
  earliestDate,
  duplicateLookupKeys,
  compareBox,
  planRestock,
  findByNameAndBrand,
  normalizeSupplyName,
  hidesInUseClock,
  type StoredSupply,
} from './duplicateSupply'

/** A stored row: 10 reservoirs, expiring 2029-03-08, lot 0233837315. */
const stored: StoredSupply = {
  quantity: 10,
  expirationDate: '2029-03-08',
  lotNumber: '0233837315',
}

describe('earliestDate', () => {
  it('returns the earlier of two known dates', () => {
    expect(earliestDate('2029-03-08', '2028-06-30')).toBe('2028-06-30')
    expect(earliestDate('2028-06-30', '2029-03-08')).toBe('2028-06-30')
  })
  it('falls back to whichever date is known', () => {
    expect(earliestDate(null, '2028-06-30')).toBe('2028-06-30')
    expect(earliestDate('2028-06-30', null)).toBe('2028-06-30')
  })
  it('stays null when neither is known', () => {
    expect(earliestDate(null, null)).toBeNull()
  })
})

describe('duplicateLookupKeys', () => {
  it('prefers the GTIN, then falls back to the PZN', () => {
    expect(duplicateLookupKeys({ gtin: '00763000532222', pzn: '07242491' })).toEqual([
      ['barcode', '00763000532222'],
      ['pzn', '07242491'],
    ])
  })
  it('uses the PZN alone for a medicine with no GTIN', () => {
    expect(duplicateLookupKeys({ pzn: '07242491' })).toEqual([['pzn', '07242491']])
  })
  it('returns nothing when the code identifies nothing', () => {
    expect(duplicateLookupKeys({})).toEqual([])
  })
})

describe('compareBox', () => {
  it('treats an identical expiry and lot as the same box', () => {
    const c = compareBox(stored, { expirationDate: '2029-03-08', lot: '0233837315' })
    expect(c).toEqual({ mixedExpiry: false, mixedLot: false, differentBox: false })
  })

  it('flags a different expiry as a different box', () => {
    const c = compareBox(stored, { expirationDate: '2028-06-30', lot: '0233837315' })
    expect(c.mixedExpiry).toBe(true)
    expect(c.differentBox).toBe(true)
  })

  it('flags a different lot as a different box', () => {
    const c = compareBox(stored, { expirationDate: '2029-03-08', lot: 'D934903A' })
    expect(c.mixedLot).toBe(true)
    expect(c.differentBox).toBe(true)
  })

  it('never treats an UNKNOWN value as evidence of a different box', () => {
    // A plain UPC carries no expiry or lot; that proves nothing either way.
    expect(compareBox(stored, {}).differentBox).toBe(false)
    expect(compareBox(stored, { expirationDate: null, lot: null }).differentBox).toBe(false)
    // Likewise when the STORED row is the one missing the data.
    const bare: StoredSupply = { quantity: 1, expirationDate: null, lotNumber: null }
    expect(compareBox(bare, { expirationDate: '2028-06-30', lot: 'D934903A' }).differentBox).toBe(false)
  })
})

describe('planRestock', () => {
  it('adds the scanned quantity to what is already on hand', () => {
    expect(planRestock(stored, { expirationDate: '2029-03-08' }, 40).quantity).toBe(50)
  })

  it('adopts the EARLIER expiry so the row never over-promises', () => {
    const plan = planRestock(stored, { expirationDate: '2028-06-30' }, 5)
    expect(plan.expirationDate).toBe('2028-06-30')
  })

  it('leaves the stored expiry alone when the scanned box outlives it', () => {
    // Writing the later date would over-promise on the older stock already there.
    const plan = planRestock(stored, { expirationDate: '2030-01-01' }, 5)
    expect(plan.expirationDate).toBeUndefined()
  })

  it('does not rewrite an unchanged or unknown expiry', () => {
    expect(planRestock(stored, { expirationDate: '2029-03-08' }, 1).expirationDate).toBeUndefined()
    expect(planRestock(stored, {}, 1).expirationDate).toBeUndefined()
    const bare: StoredSupply = { quantity: 2, expirationDate: null, lotNumber: null }
    expect(planRestock(bare, {}, 1).expirationDate).toBeUndefined()
  })

  it('fills in an expiry the stored row never had', () => {
    const bare: StoredSupply = { quantity: 2, expirationDate: null, lotNumber: null }
    expect(planRestock(bare, { expirationDate: '2028-06-30' }, 1).expirationDate).toBe('2028-06-30')
  })

  it('clears the lot once the row spans two lots (recall safety)', () => {
    expect(planRestock(stored, { lot: 'D934903A' }, 1).clearLot).toBe(true)
  })

  it('keeps the lot when it matches or is unknown', () => {
    expect(planRestock(stored, { lot: '0233837315' }, 1).clearLot).toBe(false)
    expect(planRestock(stored, {}, 1).clearLot).toBe(false)
  })

  it('never records a no-op restock for a blank or invalid quantity', () => {
    expect(planRestock(stored, {}, 0).quantity).toBe(11)
    expect(planRestock(stored, {}, -5).quantity).toBe(11)
    expect(planRestock(stored, {}, Number.NaN).quantity).toBe(11)
  })
})

describe('findByNameAndBrand (items with no barcode)', () => {
  const rows = [
    { id: 'a', name: 'Omnipod 5 Pods', brand: 'Insulet' },
    { id: 'b', name: 'Humalog 100', brand: 'Eli Lilly' },
    { id: 'c', name: 'Test Strips', brand: null },
  ]

  it('matches regardless of case, spacing and punctuation', () => {
    expect(findByNameAndBrand(rows, 'omnipod-5  PODS', 'insulet')?.id).toBe('a')
    expect(normalizeSupplyName('Omnipod 5 Pods')).toBe('omnipod5pods')
  })

  it('treats a missing brand on either side as unknown, not a mismatch', () => {
    expect(findByNameAndBrand(rows, 'Omnipod 5 Pods')?.id).toBe('a')
    expect(findByNameAndBrand(rows, 'Test Strips', 'Roche')?.id).toBe('c')
  })

  it('refuses a match when two KNOWN brands disagree', () => {
    expect(findByNameAndBrand(rows, 'Humalog 100', 'Novo Nordisk')).toBeNull()
  })

  it('never guesses on a partial or empty name', () => {
    expect(findByNameAndBrand(rows, 'Humalog')).toBeNull()
    expect(findByNameAndBrand(rows, '')).toBeNull()
    expect(findByNameAndBrand(rows, '   ')).toBeNull()
  })
})

describe('hidesInUseClock', () => {
  const openVial: StoredSupply = {
    quantity: 1,
    expirationDate: null,
    lotNumber: null,
    openedDate: '2026-08-01',
    inUseDays: 28,
  }

  it('flags a restock that pushes an OPEN single vial past one unit', () => {
    // depletion.ts stops applying the discard cap once quantity > 1.
    expect(hidesInUseClock(openVial, 4)).toBe(true)
  })

  it('stays quiet when the clock keeps applying', () => {
    expect(hidesInUseClock({ ...openVial, quantity: 3 }, 2)).toBe(false) // already > 1
  })

  it('stays quiet when the item runs no in-use clock', () => {
    expect(hidesInUseClock({ ...openVial, openedDate: null }, 4)).toBe(false)
    expect(hidesInUseClock({ ...openVial, inUseDays: null }, 4)).toBe(false)
    expect(hidesInUseClock({ ...openVial, inUseDays: 0 }, 4)).toBe(false)
  })
})

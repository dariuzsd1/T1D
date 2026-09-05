import { describe, it, expect } from 'vitest'
import type { Product } from '@/lib/store'
import type { Prescription } from '@/lib/prescriptions'
import { en } from '@/lib/i18n/dictionaries'
import type { TKey } from '@/lib/i18n/dictionaries'
import {
  buildRefillText,
  refillActionLabel,
  refillChannelFor,
  type RefillPlan,
} from './refillList'

/**
 * The refill list decides which real-world path resupplies each item, and prints
 * a version of that a pharmacist or prescriber reads. That text leaves the app
 * and gets acted on, so it is worth pinning down.
 *
 * The translator is the REAL English dictionary rather than a stub: half of what
 * matters here is whether the right message is chosen, and a stub that echoes
 * keys would let a wrong-but-plausible choice pass.
 */
const t = (key: TKey, vars?: Record<string, string | number>): string =>
  Object.entries(vars ?? {}).reduce<string>(
    (out, [k, v]) => out.replaceAll(`{${k}}`, String(v)),
    en[key],
  )

function rx(over: Partial<Prescription> = {}): Prescription {
  return {
    id: 'rx1',
    medicationName: 'Humalog',
    dosage: null,
    prescriber: null,
    pharmacy: null,
    rxNumber: null,
    writtenDate: null,
    expirationDate: null,
    refillsRemaining: 2,
    lastFilledDate: null,
    notes: null,
    ...over,
  }
}

function product(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Humalog 100',
    brand: 'Eli Lilly',
    category: 'insulin',
    quantity: 1,
    remainingDays: 4,
    lastScanned: '2026-08-01',
    usageRatePerDay: 0.2,
    ...over,
  }
}

function plan(over: Partial<RefillPlan> = {}): RefillPlan {
  const prescription = over.rx !== undefined ? over.rx : rx()
  return {
    product: product(),
    status: 'low',
    rx: prescription,
    channel: refillChannelFor(prescription),
    ...over,
  }
}

describe('refillChannelFor', () => {
  it('sends an item with refills left to the pharmacy', () => {
    expect(refillChannelFor(rx({ refillsRemaining: 2 }))).toBe('refill')
  })

  it('sends an item with no refills left to the prescriber', () => {
    // A pharmacy trip would be wasted: there is nothing left to dispense.
    expect(refillChannelFor(rx({ refillsRemaining: 0 }))).toBe('newRx')
  })

  it('treats an unlinked item as having no prescription on file', () => {
    expect(refillChannelFor(null)).toBe('noRx')
  })

  it('assumes refillable when the count is unknown', () => {
    // Sending someone to chase a prescriber they may not need is the worse error.
    expect(refillChannelFor(rx({ refillsRemaining: null }))).toBe('refill')
  })
})

describe('refillActionLabel', () => {
  it('names the pharmacy when one is known', () => {
    expect(refillActionLabel(plan({ rx: rx({ pharmacy: 'Apotheke Nord' }) }), t))
      .toBe('Refill at Apotheke Nord')
  })

  it('falls back to a generic instruction without a pharmacy', () => {
    expect(refillActionLabel(plan(), t)).toBe('Refill available')
  })

  it('names the prescriber when a new script is needed', () => {
    const p = plan({ rx: rx({ refillsRemaining: 0, prescriber: 'Dr Weber' }) })
    expect(refillActionLabel(p, t)).toBe('Ask Dr Weber for a new script')
  })

  it('asks for a prescription to be linked when there is none', () => {
    expect(refillActionLabel(plan({ rx: null }), t)).toBe('Link a prescription to track refills')
  })

  it('lets a discontinued product override every channel', () => {
    // The safety rule: never send someone to refill something nobody makes.
    for (const prescription of [rx(), rx({ refillsRemaining: 0 }), null]) {
      const p = plan({ product: product({ discontinued: true }), rx: prescription })
      expect(refillActionLabel(p, t)).toBe(
        'No longer made. Ask your prescriber for a replacement',
      )
    }
  })
})

describe('the text a prescriber actually reads', () => {
  const DATE = 'August 23, 2026'

  it('groups items under the right headings', () => {
    const text = buildRefillText(
      [
        plan({ product: product({ id: 'a', name: 'Humalog 100' }) }),
        plan({ product: product({ id: 'b', name: 'Guardian 4' }), rx: rx({ refillsRemaining: 0 }) }),
        plan({ product: product({ id: 'c', name: 'Lancets' }), rx: null }),
      ],
      t,
      DATE,
    )
    expect(text).toContain('Ready to refill:')
    expect(text).toContain('Needs a new prescription:')
    expect(text).toContain('No prescription on file:')
    // Order matters: the pharmacy section is the one most often acted on first.
    expect(text.indexOf('Ready to refill:')).toBeLessThan(text.indexOf('Needs a new prescription:'))
  })

  it('omits a heading with nothing under it', () => {
    const text = buildRefillText([plan()], t, DATE)
    expect(text).toContain('Ready to refill:')
    expect(text).not.toContain('No prescription on file:')
  })

  it('leads each line with out or low, since colour cannot survive plain text', () => {
    const text = buildRefillText([plan({ status: 'out' })], t, DATE)
    expect(text).toContain('- Humalog 100 (Eli Lilly): Out')
  })

  it('carries the Rx number, pharmacy and refills left', () => {
    const p = plan({ rx: rx({ rxNumber: 'A1234', pharmacy: 'Apotheke Nord', refillsRemaining: 2 }) })
    const text = buildRefillText([p], t, DATE)
    expect(text).toContain('Rx #A1234')
    expect(text).toContain('Apotheke Nord')
    expect(text).toContain('2 refills left')
  })

  it('says "1 refill left" rather than "1 refills left"', () => {
    const p = plan({ rx: rx({ refillsRemaining: 1 }) })
    expect(buildRefillText([p], t, DATE)).toContain('1 refill left')
  })

  it('names the prescriber on an item that needs a new script', () => {
    const p = plan({ rx: rx({ refillsRemaining: 0, prescriber: 'Dr Weber' }) })
    expect(buildRefillText([p], t, DATE)).toContain('Dr Weber')
  })

  it('flags a discontinued item in the printed copy too', () => {
    // This is the version a prescriber reads; the flag must not be screen-only.
    const p = plan({ product: product({ discontinued: true }) })
    expect(buildRefillText([p], t, DATE)).toContain('Discontinued')
  })

  it('is titled and dated so it stands alone once pasted', () => {
    const text = buildRefillText([plan()], t, DATE)
    expect(text.startsWith('REFILL REQUEST')).toBe(true)
    expect(text).toContain(DATE)
  })

  it('produces just the title and date when everything is deselected', () => {
    const text = buildRefillText([], t, DATE)
    expect(text).toBe(`REFILL REQUEST\n${DATE}`)
  })
})

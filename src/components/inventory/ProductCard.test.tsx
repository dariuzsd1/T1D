// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import type { Product } from '@/lib/store'
import { renderWithProviders, screen } from '@/lib/testUtils/renderWithProviders'
import { ProductCard } from './ProductCard'

/**
 * Guards the honesty rule at the point the user actually reads it.
 *
 * Without a real usage rate the engine falls back to one unit a day, which is
 * only conservative for items used less than once a day. For a box of 100 test
 * strips it produced "~100 days left" against a real figure nearer 16, while the
 * item sat silently out of every refill list: a reassuring number plus silence,
 * which is how "never run out" fails quietly. The card must show what is known
 * (the count on hand) and ask for the rate instead of printing the guess.
 */
function product(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'OneTouch Ultra Test Strips',
    brand: 'LifeScan',
    category: 'bg_supply',
    quantity: 100,
    // What the fallback produces for 100 units at the assumed 1/day.
    remainingDays: 100,
    lastScanned: '2026-08-01',
    usageRatePerDay: 0,
    expirationDate: null,
    ...over,
  }
}

describe('ProductCard headline number', () => {
  it('shows the count on hand, not a day count, when usage is unknown', () => {
    renderWithProviders(<ProductCard product={product()} />)
    expect(screen.getByText('On hand')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.queryAllByText('Days left')).toHaveLength(0)
    expect(screen.queryAllByText('Est. days left')).toHaveLength(0)
  })

  it('never claims ~100 days for a box that really lasts about sixteen', () => {
    // The specific regression: a tilde-prefixed fallback presented as a runway.
    const { container } = renderWithProviders(<ProductCard product={product()} />)
    expect(container.textContent).not.toMatch(/~\s*100/)
  })

  it('shows a real day count once the rate is known', () => {
    // 6 strips/day against 100 on hand is about 16 days, and that IS derived.
    renderWithProviders(
      <ProductCard product={product({ usageRatePerDay: 6, remainingDays: 16 })} />,
    )
    // The label also appears in the expanded detail, so assert presence not count.
    expect(screen.getAllByText('Days left').length).toBeGreaterThan(0)
    expect(screen.getAllByText('16').length).toBeGreaterThan(0)
    expect(screen.queryByText('On hand')).not.toBeInTheDocument()
  })

  it('still names the product and brand either way', () => {
    renderWithProviders(<ProductCard product={product()} />)
    expect(screen.getByText('OneTouch Ultra Test Strips')).toBeInTheDocument()
  })
})

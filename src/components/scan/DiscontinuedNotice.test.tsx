// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderWithProviders, screen } from '@/lib/testUtils/renderWithProviders'
import { DiscontinuedNotice } from './DiscontinuedNotice'

/**
 * Shown before a discontinued product is added. The item stays addable on
 * purpose — someone can hold stock for months and still needs to track it — so
 * the notice has to carry the whole message: you can keep tracking this, you
 * cannot reorder it, ask your prescriber.
 */
describe('DiscontinuedNotice', () => {
  it('says the product is no longer made', () => {
    renderWithProviders(<DiscontinuedNotice />)
    expect(screen.getByText(/stopped making this/i)).toBeInTheDocument()
  })

  it('makes clear you can still track what you already hold', () => {
    // Without this the notice reads as "do not add", and stock goes untracked.
    renderWithProviders(<DiscontinuedNotice />)
    expect(screen.getByText(/still track what you have/i)).toBeInTheDocument()
  })

  it('warns that it cannot be reordered, and points at the next step', () => {
    renderWithProviders(<DiscontinuedNotice />)
    expect(screen.getByText(/not be able to reorder it/i)).toBeInTheDocument()
    expect(screen.getByText(/ask your prescriber/i)).toBeInTheDocument()
  })

  it('is announced to a screen reader rather than being colour-only', () => {
    renderWithProviders(<DiscontinuedNotice />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

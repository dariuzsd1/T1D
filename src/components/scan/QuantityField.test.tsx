// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, renderWithProviders, screen } from '@/lib/testUtils/renderWithProviders'
import { QuantityField, nextQuantity, quantityOnBlur, type QuantityValue } from './QuantityField'

/**
 * A user reported they "still cannot edit the quantity field fully": a scanned
 * 40-count reservoir box showed 10, and clearing it to type 40 fought back.
 *
 * The cause was `parseInt(value) || 1`, which forces 1 the instant the field goes
 * empty — so the empty state between clearing and typing never survives, and the
 * leading digit is trapped. The fix makes empty a legal intermediate value that
 * only settles to 1 on blur, which is exactly what these pin down.
 */
describe('nextQuantity (what a keystroke produces)', () => {
  it('allows empty, so a field can be cleared before retyping', () => {
    // The whole bug in one assertion: clearing must NOT snap back to 1.
    expect(nextQuantity('')).toBe('')
  })

  it('keeps the number the user typed', () => {
    expect(nextQuantity('40')).toBe(40)
    expect(nextQuantity('4')).toBe(4)
    expect(nextQuantity('100')).toBe(100)
  })

  it('never goes below one, since a box holds at least one', () => {
    expect(nextQuantity('0')).toBe(1)
    expect(nextQuantity('-5')).toBe(1)
  })

  it('falls back to one rather than showing NaN', () => {
    expect(nextQuantity('abc')).toBe(1)
  })
})

describe('quantityOnBlur (what leaving the field settles on)', () => {
  it('turns an abandoned empty field into one', () => {
    expect(quantityOnBlur('')).toBe(1)
  })

  it('leaves a real number alone', () => {
    expect(quantityOnBlur(40)).toBe(40)
  })
})

/** Mirrors how the scan page holds this value, so the test drives real state. */
function Harness({ initial }: { initial: QuantityValue }) {
  const [quantity, setQuantity] = useState<QuantityValue>(initial)
  return <QuantityField id="q" value={quantity} onChange={setQuantity} />
}

describe('typing in the field', () => {
  it('lets a user replace 10 with 40 — the exact reported failure', () => {
    renderWithProviders(<Harness initial={10} />)
    const input = screen.getByLabelText(/^quantity$/i)
    // Clear it, as the user would, then type the real count.
    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue(null)
    fireEvent.change(input, { target: { value: '4' } })
    fireEvent.change(input, { target: { value: '40' } })
    expect(input).toHaveValue(40)
  })

  it('settles an abandoned empty field to one on blur', () => {
    renderWithProviders(<Harness initial={10} />)
    const input = screen.getByLabelText(/^quantity$/i)
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(input).toHaveValue(1)
  })

  it('reports each change to the page', () => {
    const onChange = vi.fn()
    renderWithProviders(<QuantityField id="q" value={10} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/^quantity$/i), { target: { value: '40' } })
    expect(onChange).toHaveBeenCalledWith(40)
  })

  it('binds its label to the input, so it is reachable and announced', () => {
    renderWithProviders(<QuantityField id="bc-quantity" value={1} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/^quantity$/i)).toHaveAttribute('id', 'bc-quantity')
  })
})

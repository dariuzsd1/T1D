// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import type { Product } from '@/lib/store'
import { fireEvent, renderWithProviders, screen, waitFor } from '@/lib/testUtils/renderWithProviders'
import { EditProductModal } from './EditProductModal'

/**
 * This dialog was reported unusable: on its long form the close button and the
 * Save/Cancel row were pushed off-screen with no way to reach them, and because
 * the dialog locks background scrolling only the page behind moved. It was the
 * one dialog in the app without a height cap or an internal scroll area.
 *
 * It also silently invalidated a safety test. The user set an expiry here to
 * check the earliest-expiry merge rule, could not reach Save, and reported the
 * rule as unverified — the rule was fine, the dialog was not.
 *
 * So the structure IS the feature here, and these tests pin it: the header and
 * the action row stay put, only the fields scroll, and every way out works.
 */
function product(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'MiniMed Reservoir - Kit',
    brand: 'MiniMed',
    category: 'infusion_set',
    quantity: 40,
    remainingDays: 120,
    lastScanned: '2026-08-01',
    usageRatePerDay: 0.33,
    expirationDate: '2029-03-08',
    ...over,
  }
}

function renderModal(over: Partial<Product> = {}) {
  const onClose = vi.fn()
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  const onSaved = vi.fn()
  renderWithProviders(
    <EditProductModal product={product(over)} onClose={onClose} onUpdate={onUpdate} onSaved={onSaved} />,
  )
  return { onClose, onUpdate, onSaved }
}

/** The scrolling region the fields live in: flex-1 with its own overflow. */
function scrollArea(): HTMLElement {
  const el = document.querySelector('.flex-1.overflow-y-auto')
  if (!el) throw new Error('no scrollable field area — the dialog would grow past the viewport')
  return el as HTMLElement
}

describe('the dialog stays usable on a long form', () => {
  it('caps its own height instead of growing past the viewport', () => {
    renderModal()
    // Without a cap the dialog grows and its ends leave the screen entirely.
    expect(screen.getByRole('dialog').className).toMatch(/max-h-/)
  })

  it('scrolls the fields, not the whole dialog', () => {
    renderModal()
    // The quantity field must live INSIDE the scroll area, or the form is stuck.
    expect(scrollArea().contains(screen.getByLabelText(/quantity on hand/i))).toBe(true)
  })

  it('keeps the close button reachable, outside the scrolling area', () => {
    renderModal()
    const close = screen.getByRole('button', { name: /close dialog/i })
    expect(scrollArea().contains(close)).toBe(false)
  })

  it('keeps Save and Cancel reachable, outside the scrolling area', () => {
    renderModal()
    for (const name of [/save changes/i, /^cancel$/i]) {
      expect(scrollArea().contains(screen.getByRole('button', { name }))).toBe(false)
    }
  })
})

describe('every way out works', () => {
  it('closes on the X', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Cancel', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape', () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('editing and saving', () => {
  it('is announced as a modal dialog and names the product', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('MiniMed Reservoir - Kit')).toBeInTheDocument()
  })

  it('prefills the stored expiry rather than starting blank', () => {
    // Starting blank would quietly wipe a real expiry on the next save.
    renderModal()
    expect(screen.getByLabelText(/expiration date/i)).toHaveValue('2029-03-08')
  })

  it('saves a changed expiry — the path that made the merge test look broken', async () => {
    const { onUpdate } = renderModal()
    fireEvent.change(screen.getByLabelText(/expiration date/i), { target: { value: '2031-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({ expirationDate: '2031-01-01' })),
    )
  })

  it('persists a cleared expiry as null, so it is actually removed', async () => {
    const { onUpdate } = renderModal()
    fireEvent.change(screen.getByLabelText(/expiration date/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({ expirationDate: null })),
    )
  })

  it('saves a changed quantity', async () => {
    const { onUpdate } = renderModal()
    fireEvent.change(screen.getByLabelText(/quantity on hand/i), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({ quantity: 25 })),
    )
  })

  it('closes once the save resolves', async () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('stays open and explains itself when the save fails', async () => {
    // Closing on failure would look like success and lose the user's edit. The
    // message is a plain, actionable one rather than the raw error, which is
    // deliberate: a thrown Error means nothing to the person reading it.
    const onClose = vi.fn()
    const onUpdate = vi.fn().mockRejectedValue(new Error('network died'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderWithProviders(
      <EditProductModal product={product()} onClose={onClose} onUpdate={onUpdate} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() =>
      expect(screen.getByText(/couldn't save your changes/i)).toBeInTheDocument(),
    )
    expect(onClose).not.toHaveBeenCalled()
    // The edit must survive the failure so the user can just retry.
    expect(screen.getByLabelText(/expiration date/i)).toHaveValue('2029-03-08')
    vi.restoreAllMocks()
  })
})

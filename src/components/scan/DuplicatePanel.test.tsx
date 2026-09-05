// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, renderWithProviders, screen } from '@/lib/testUtils/renderWithProviders'
import type { ScannedBox } from '@/lib/duplicateSupply'
import { DuplicatePanel, type DuplicateMatch } from './DuplicatePanel'

/**
 * The duplicate panel is where the app's most safety-critical decision is put to
 * the user: combine this box with one you already have, or keep them separate.
 *
 * Combining two boxes with different expiry dates is legitimate — the merged row
 * takes the EARLIER date — but it loses per-box lot detail that matters for a
 * recall. So the panel must make a re-scan of the same box feel routine and a
 * genuinely different box feel deliberate. That distinction is carried entirely
 * by wording and by how prominent the button is, which is why it is tested here
 * rather than trusted to review.
 */
const RESTOCK = /add \d+ to what i have/i
const MERGE_ANYWAY = /combine anyway/i

function match(over: Partial<DuplicateMatch> = {}): DuplicateMatch {
  return {
    id: 's1',
    name: 'MiniMed Reservoir - Kit',
    quantity: 40,
    expirationDate: '2029-03-08',
    lotNumber: 'D934903A',
    openedDate: null,
    inUseDays: null,
    matchedBy: 'code',
    ...over,
  }
}

/** The same physical box: expiry and lot agree with what is stored. */
const SAME_BOX: ScannedBox = { expirationDate: '2029-03-08', lot: 'D934903A' }

function renderPanel(
  over: Partial<DuplicateMatch> = {},
  scanned: ScannedBox = SAME_BOX,
  addQuantity = 40,
) {
  const onRestock = vi.fn()
  renderWithProviders(
    <DuplicatePanel
      duplicate={match(over)}
      scannedBox={scanned}
      addQuantity={addQuantity}
      saving={false}
      onRestock={onRestock}
    />,
  )
  return { onRestock }
}

describe('re-scanning the SAME box', () => {
  it('offers a plain restock with the resulting total', () => {
    renderPanel()
    expect(screen.getByText(/you already have MiniMed Reservoir - Kit/i)).toBeInTheDocument()
    // The total is the point: the user is agreeing to a number, not a vibe.
    expect(screen.getByRole('button', { name: /add 40 to what i have \(80 total\)/i })).toBeInTheDocument()
  })

  it('presents restocking as the primary action', () => {
    renderPanel()
    // Solid fill = the expected, safe choice.
    expect(screen.getByRole('button', { name: RESTOCK }).className).toContain('bg-caution')
  })

  it('calls back when the user confirms', () => {
    const { onRestock } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: RESTOCK }))
    expect(onRestock).toHaveBeenCalledTimes(1)
  })

  it('cannot be double-submitted while a save is in flight', () => {
    renderWithProviders(
      <DuplicatePanel
        duplicate={match()}
        scannedBox={SAME_BOX}
        addQuantity={40}
        saving
        onRestock={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: RESTOCK })).toBeDisabled()
  })
})

describe('a DIFFERENT box', () => {
  it('says so when the expiry disagrees, and demotes the merge button', () => {
    // The exact case the user verified by hand: stored 2031, box says 2029.
    renderPanel({ expirationDate: '2031-01-01' }, SAME_BOX)
    expect(screen.getByText(/different expiration date or lot number/i)).toBeInTheDocument()
    const button = screen.getByRole('button', { name: MERGE_ANYWAY })
    // Secondary styling: combining is allowed, but it must feel deliberate.
    expect(button.className).toContain('bg-surface')
    expect(button.className).not.toContain('bg-caution ')
  })

  it('says so when the lot disagrees', () => {
    renderPanel({ lotNumber: 'OTHER-LOT' }, SAME_BOX)
    expect(screen.getByRole('button', { name: MERGE_ANYWAY })).toBeInTheDocument()
  })

  it('tells the user the merge keeps the earliest expiry', () => {
    // Naming the consequence on the button is what makes this an informed choice.
    renderPanel({ expirationDate: '2031-01-01' }, SAME_BOX)
    expect(screen.getByText(/uses the earliest expiry/i)).toBeInTheDocument()
  })

  it('treats an unknown value as agreement, not as evidence of a different box', () => {
    // A box with no printed lot must not be reported as a different box.
    renderPanel({ lotNumber: null }, { expirationDate: '2029-03-08', lot: null })
    expect(screen.getByRole('button', { name: RESTOCK })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: MERGE_ANYWAY })).not.toBeInTheDocument()
  })
})

describe('a NAME match', () => {
  it('flags that it was matched by name and asks the user to check', () => {
    renderPanel({ matchedBy: 'name' })
    expect(screen.getByText(/matched by name rather than by a barcode/i)).toBeInTheDocument()
  })

  it('demotes the button even when expiry and lot agree', () => {
    // A name match is a suggestion, not proof, so it never gets the primary style.
    renderPanel({ matchedBy: 'name' })
    expect(screen.getByRole('button', { name: RESTOCK }).className).toContain('bg-surface')
  })
})

describe('the opened-vial discard clock', () => {
  const OPENED = { openedDate: '2026-08-01', inUseDays: 28, quantity: 1 }

  it('warns when restocking would stop the discard date capping the runway', () => {
    renderPanel(OPENED, SAME_BOX, 5)
    expect(screen.getByText(/already open and on its discard clock/i)).toBeInTheDocument()
  })

  it('stays quiet when nothing is open', () => {
    renderPanel({ quantity: 1 }, SAME_BOX, 5)
    expect(screen.queryByText(/discard clock/i)).not.toBeInTheDocument()
  })
})

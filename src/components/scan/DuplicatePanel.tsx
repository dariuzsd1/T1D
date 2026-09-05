'use client'

import { AlertCircle } from 'lucide-react'
import { compareBox, hidesInUseClock, type ScannedBox, type StoredSupply } from '@/lib/duplicateSupply'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** An inventory row this scan appears to match. */
export interface DuplicateMatch extends StoredSupply {
  id: string
  name: string
  /** A code match is proof; a name match is only a strong suggestion. */
  matchedBy: 'code' | 'name'
}

interface DuplicatePanelProps {
  duplicate: DuplicateMatch
  /** Expiry and lot read off the box being scanned right now. */
  scannedBox: ScannedBox
  /** How many the user is about to add. */
  addQuantity: number
  saving: boolean
  onRestock: () => void
}

/**
 * Offers to restock an existing row instead of creating a second one for the
 * same box.
 *
 * It deliberately derives its own flags from `duplicate` + `scannedBox` rather
 * than taking them as props: the wording and the button's prominence ARE the
 * safety signal, so they must follow from the same unit-tested rules in
 * `src/lib/duplicateSupply.ts` that the merge itself obeys. Passing booleans in
 * would let the panel say one thing while the merge did another.
 *
 * Extracted from the scan page so this can be tested directly
 * (`DuplicatePanel.test.tsx`); mounting the whole page would exercise camera,
 * router and network plumbing rather than the decision the user actually makes.
 */
export function DuplicatePanel({
  duplicate,
  scannedBox,
  addQuantity,
  saving,
  onRestock,
}: DuplicatePanelProps) {
  const { t } = useI18n()

  // The stored expiry/lot disagree with the box in hand, so this is probably a
  // different physical box rather than a re-scan of the same one.
  const mixedBox = compareBox(duplicate, scannedBox).differentBox
  // A name match is a suggestion, not proof, so it gets the same restrained
  // treatment as a box whose expiry or lot disagrees.
  const cautiousMerge = mixedBox || duplicate.matchedBy === 'name'
  // Would this restock quietly stop the opened-vial discard clock capping the runway?
  const inUseWarning = hidesInUseClock(duplicate, addQuantity)

  return (
    <div className="rounded-xl border border-caution/30 bg-caution-soft p-4 space-y-3" role="status">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-caution shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-ink">
          {duplicate.matchedBy === 'name'
            ? t('scan.duplicateNameBody', { name: duplicate.name, count: duplicate.quantity })
            : mixedBox
              ? t('scan.duplicateMixedBody', { name: duplicate.name, count: duplicate.quantity })
              : t('scan.duplicateBody', { name: duplicate.name, count: duplicate.quantity })}
        </p>
      </div>
      {inUseWarning && (
        <p className="text-xs leading-relaxed text-muted">{t('scan.duplicateInUseNote')}</p>
      )}
      <button
        onClick={onRestock}
        disabled={saving}
        className={cn(
          'w-full rounded-xl py-3 font-semibold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-caution',
          cautiousMerge
            ? 'border border-line bg-surface text-muted hover:text-ink'
            : 'bg-caution text-white'
        )}
      >
        {mixedBox
          ? t('scan.duplicateMergeAnyway')
          : t('scan.duplicateRestock', {
              count: addQuantity,
              total: duplicate.quantity + addQuantity,
            })}
      </button>
    </div>
  )
}

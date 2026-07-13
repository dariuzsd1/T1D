'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, X, RotateCcw } from 'lucide-react'
import { useDialog } from '@/lib/useDialog'
import { useI18n } from '@/lib/i18n'
import { type BodyZone, zoneLabelKey, RECENT_USE_DAYS } from '@/lib/siteRotation'

/**
 * "Are you sure?" gate shown when the user picks a zone they used recently (within
 * RECENT_USE_DAYS). Reusing a spot is allowed, but rotating to a rested area helps
 * insulin absorb evenly and prevents lipohypertrophy, so this nudges toward the
 * guide first. Accessible alertdialog (useDialog: focus trap, Escape, focus
 * restore, scroll lock; initial focus on the safe Cancel action).
 */
export function ReuseWarningModal({
  zone,
  elapsedLabel,
  onCancel,
  onLogAnyway,
  onViewGuide,
}: {
  zone: BodyZone
  /** Pre-translated elapsed text, e.g. "Last used 3 days ago". */
  elapsedLabel: string
  onCancel: () => void
  onLogAnyway: () => void
  onViewGuide: () => void
}) {
  const { t } = useI18n()
  const dialogRef = useDialog<HTMLDivElement>(onCancel)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onCancel} className="absolute inset-0 bg-ink/40" />

      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reuse-warn-title"
        aria-describedby="reuse-warn-body"
        className="relative w-full max-w-md bg-surface border border-line rounded-3xl p-7 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-caution-soft flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-caution" />
            </div>
            <div>
              <h2 id="reuse-warn-title" className="text-xl font-bold text-ink leading-tight">
                {t('reuseWarn.title')}
              </h2>
              <p className="text-sm text-muted">
                {t(zoneLabelKey(zone))} · {elapsedLabel}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p id="reuse-warn-body" className="text-sm text-muted leading-relaxed">
          {t('reuseWarn.body', { days: RECENT_USE_DAYS })}
        </p>

        <button
          type="button"
          onClick={onViewGuide}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          {t('reuseWarn.viewGuide')}
        </button>

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-surface-2 text-ink border border-line hover:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {t('reuseWarn.cancel')}
          </button>
          <button
            onClick={onLogAnyway}
            className="min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-caution text-white hover:bg-caution/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-caution"
          >
            {t('reuseWarn.logAnyway')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

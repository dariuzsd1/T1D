'use client'

import { AlertCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

/**
 * Shown on the confirm screen once the matched product is known to be out of
 * production.
 *
 * The product stays addable on purpose: someone can hold stock of a discontinued
 * item for months and still needs to track it. What must not happen is the app
 * presenting it as something they can reorder, so this says so before they
 * commit, and points at the only useful next step — asking their prescriber.
 */
export function DiscontinuedNotice() {
  const { t } = useI18n()
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl border border-caution/30 bg-caution-soft p-3.5"
      role="status"
    >
      <AlertCircle className="w-4 h-4 shrink-0 text-caution mt-0.5" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-ink">{t('scan.discontinuedNotice')}</p>
    </div>
  )
}

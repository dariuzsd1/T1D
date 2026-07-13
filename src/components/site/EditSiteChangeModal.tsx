'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2, Pencil } from 'lucide-react'
import { useDialog } from '@/lib/useDialog'
import { useI18n } from '@/lib/i18n'
import type { Product } from '@/lib/store'
import { BODY_ZONES, zoneLabelKey, type BodyView, type SiteChangeRow } from '@/lib/siteRotation'

/** Local YYYY-MM-DD (today, no timezone drift). */
function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export interface EditSiteChangeInput {
  zoneId: string | null
  supplyId: string | null
  appliedDate: string
  notes: string
}

/**
 * Edit a past logged change — its spot, the supply used, the date, or the note.
 * Mirrors the log dialog's a11y (useDialog: focus trap, Escape, focus restore).
 * Count reconciliation (if the supply changes) is handled by the caller on save.
 */
export function EditSiteChangeModal({
  change,
  inventory,
  onClose,
  onSave,
}: {
  change: SiteChangeRow
  inventory: Product[]
  onClose: () => void
  onSave: (values: EditSiteChangeInput) => Promise<void>
}) {
  const { t } = useI18n()
  const [zoneId, setZoneId] = useState(change.body_zone ?? '')
  const [supplyId, setSupplyId] = useState(change.supply_id ?? '')
  const [appliedDate, setAppliedDate] = useState(change.applied_date ?? todayLocal())
  const [notes, setNotes] = useState(change.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  const viewLabel = (v: BodyView) => (v === 'front' ? t('siteTracker.front') : t('siteTracker.back'))

  const handleSave = async () => {
    if (!appliedDate) {
      setError(t('siteModal.errChooseDate'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ zoneId: zoneId || null, supplyId: supplyId || null, appliedDate, notes: notes.trim() })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('siteTracker.errSaveGeneric'))
      setSaving(false)
    }
  }

  const fieldClass =
    'w-full bg-surface border border-line rounded-xl p-3 font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus:border-teal'
  const labelClass = 'block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/40" />

      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-site-title"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface border border-line rounded-3xl p-7 shadow-lg"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
              <Pencil className="w-5 h-5 text-teal" />
            </div>
            <h2 id="edit-site-title" className="text-xl font-bold text-ink leading-tight">{t('siteHistory.editTitle')}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="edit-zone" className={labelClass}>{t('siteHistory.zoneField')}</label>
            <select
              ref={firstFieldRef}
              id="edit-zone"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className={fieldClass}
            >
              <option value="">{t('siteHistory.noZone')}</option>
              {BODY_ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {t(zoneLabelKey(z))} · {viewLabel(z.view)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="edit-supply" className={labelClass}>{t('siteModal.deviceConsumable')}</label>
            <select
              id="edit-supply"
              value={supplyId}
              onChange={(e) => setSupplyId(e.target.value)}
              className={fieldClass}
            >
              <option value="">{t('siteModal.notSpecified')}</option>
              {inventory.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand ? `${p.name} (${p.brand})` : p.name}
                </option>
              ))}
            </select>
            {change.supply_id && supplyId !== change.supply_id && (
              <p className="mt-1.5 text-xs text-caution">{t('siteHistory.supplyChangeHint')}</p>
            )}
          </div>

          <div>
            <label htmlFor="edit-date" className={labelClass}>{t('siteModal.date')}</label>
            <input
              id="edit-date"
              type="date"
              max={todayLocal()}
              value={appliedDate}
              onChange={(e) => setAppliedDate(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="edit-notes" className={labelClass}>{t('siteModal.noteOptional')}</label>
            <textarea
              id="edit-notes"
              rows={2}
              placeholder={t('siteModal.notePlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={fieldClass}
            />
          </div>

          {error && <p className="text-sm font-medium text-urgent">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-surface-2 text-ink border border-line hover:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {t('siteHistory.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="min-h-[44px] px-5 rounded-xl text-sm font-semibold bg-teal text-white hover:bg-teal/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('siteHistory.saveBtn')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

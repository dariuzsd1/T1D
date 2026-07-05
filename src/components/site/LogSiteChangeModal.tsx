'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2, Syringe } from 'lucide-react'
import { useDialog } from '@/lib/useDialog'
import type { Product } from '@/lib/store'
import { type BodyZone, zoneLabel } from '@/lib/siteRotation'

/** Local YYYY-MM-DD (for the date input default — today, no timezone drift). */
function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export interface SiteChangeInput {
  supplyId: string | null
  appliedDate: string
  notes: string
}

/**
 * Accessible "log a site change" dialog. Mirrors AppointmentModal (useDialog:
 * focus trap, Escape, focus restore, scroll lock). When a consumable is selected,
 * saving also logs one of it as used (the page decrements the supply) — the hint
 * under the picker tells the user before they confirm.
 */
export function LogSiteChangeModal({
  zone,
  inventory,
  onClose,
  onSave,
}: {
  zone: BodyZone
  inventory: Product[]
  onClose: () => void
  onSave: (values: SiteChangeInput) => Promise<void>
}) {
  const [supplyId, setSupplyId] = useState('')
  const [appliedDate, setAppliedDate] = useState(todayLocal())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  const handleSave = async () => {
    if (!appliedDate) {
      setError('Please choose a date.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ supplyId: supplyId || null, appliedDate, notes: notes.trim() })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this site change.')
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
        aria-labelledby="log-site-title"
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface border border-line rounded-3xl p-7 shadow-lg"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
              <Syringe className="w-5 h-5 text-teal" />
            </div>
            <div>
              <h2 id="log-site-title" className="text-xl font-bold text-ink leading-tight">Log a site change</h2>
              <p className="text-sm text-muted">{zoneLabel(zone)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="site-supply" className={labelClass}>Device / consumable</label>
            <select
              ref={firstFieldRef}
              id="site-supply"
              value={supplyId}
              onChange={(e) => setSupplyId(e.target.value)}
              className={fieldClass}
            >
              <option value="">Not specified</option>
              {inventory.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand ? `${p.name} (${p.brand})` : p.name}
                </option>
              ))}
            </select>
            {inventory.length === 0 && (
              <p className="mt-1.5 text-xs text-faint">
                No supplies tracked yet. You can still log the site and add the consumable later.
              </p>
            )}
            {(() => {
              const selected = inventory.find((p) => p.id === supplyId)
              if (!selected) return null
              return (
                <p className="mt-1.5 text-xs text-faint">
                  {selected.quantity > 0
                    ? `Saving also logs 1 used (${selected.quantity - 1} left after).`
                    : 'None on hand, so the count stays at 0.'}
                </p>
              )
            })()}
          </div>

          <div>
            <label htmlFor="site-date" className={labelClass}>Date</label>
            <input
              id="site-date"
              type="date"
              max={todayLocal()}
              value={appliedDate}
              onChange={(e) => setAppliedDate(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="site-notes" className={labelClass}>Note (optional)</label>
            <textarea
              id="site-notes"
              rows={2}
              placeholder="Anything worth remembering about this site…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${fieldClass} resize-none`}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-urgent-soft border border-urgent/20 rounded-xl text-urgent text-sm font-medium" role="status">
            {error}
          </div>
        )}

        <div className="mt-7 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-teal hover:opacity-90 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-opacity flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-3 rounded-xl font-semibold text-muted hover:bg-surface-2 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  )
}

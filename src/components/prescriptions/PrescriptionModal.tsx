'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import type { Prescription } from '@/lib/prescriptions'

interface PrescriptionModalProps {
  /** Existing prescription to edit, or null to create a new one. */
  prescription: Prescription | null
  onClose: () => void
  onSave: (values: Partial<Prescription>) => Promise<void>
}

/** Accessible add/edit dialog for a prescription (role="dialog", aria-modal,
 *  Escape to close, backdrop click to close). Mirrors EditProductModal. */
export function PrescriptionModal({ prescription, onClose, onSave }: PrescriptionModalProps) {
  const [medicationName, setMedicationName] = useState(prescription?.medicationName ?? '')
  const [dosage, setDosage] = useState(prescription?.dosage ?? '')
  const [prescriber, setPrescriber] = useState(prescription?.prescriber ?? '')
  const [pharmacy, setPharmacy] = useState(prescription?.pharmacy ?? '')
  const [rxNumber, setRxNumber] = useState(prescription?.rxNumber ?? '')
  const [writtenDate, setWrittenDate] = useState(prescription?.writtenDate?.slice(0, 10) ?? '')
  const [expirationDate, setExpirationDate] = useState(prescription?.expirationDate?.slice(0, 10) ?? '')
  const [refillsRemaining, setRefillsRemaining] = useState<string>(
    prescription?.refillsRemaining != null ? String(prescription.refillsRemaining) : ''
  )
  const [lastFilledDate, setLastFilledDate] = useState(prescription?.lastFilledDate?.slice(0, 10) ?? '')
  const [notes, setNotes] = useState(prescription?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSave = async () => {
    if (!medicationName.trim()) {
      setError('Please enter the medication name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        medicationName: medicationName.trim(),
        dosage,
        prescriber,
        pharmacy,
        rxNumber,
        writtenDate: writtenDate || null,
        expirationDate: expirationDate || null,
        refillsRemaining: refillsRemaining === '' ? null : Math.max(0, parseInt(refillsRemaining, 10) || 0),
        lastFilledDate: lastFilledDate || null,
        notes,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Could not save the prescription.')
    } finally {
      setSaving(false)
    }
  }

  const fieldClass =
    'w-full bg-surface border border-line rounded-xl p-3 font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary'
  const labelClass = 'block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rx-title"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface border border-line rounded-3xl p-7 shadow-lg"
      >
        <div className="flex items-start justify-between mb-6">
          <h2 id="rx-title" className="text-xl font-bold text-ink">
            {prescription ? 'Edit prescription' : 'Add prescription'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="rx-name" className={labelClass}>Medication</label>
            <input
              ref={firstFieldRef}
              id="rx-name"
              type="text"
              placeholder="e.g. Insulin aspart (Novolog)"
              value={medicationName}
              onChange={(e) => setMedicationName(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rx-dosage" className={labelClass}>Dosage</label>
              <input id="rx-dosage" type="text" placeholder="e.g. 100 U/mL" value={dosage} onChange={(e) => setDosage(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="rx-number" className={labelClass}>Rx number</label>
              <input id="rx-number" type="text" value={rxNumber} onChange={(e) => setRxNumber(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rx-prescriber" className={labelClass}>Prescriber</label>
              <input id="rx-prescriber" type="text" placeholder="e.g. Dr. Lee" value={prescriber} onChange={(e) => setPrescriber(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="rx-pharmacy" className={labelClass}>Pharmacy</label>
              <input id="rx-pharmacy" type="text" value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rx-refills" className={labelClass}>Refills left</label>
              <input id="rx-refills" type="number" min="0" placeholder="e.g. 3" value={refillsRemaining} onChange={(e) => setRefillsRemaining(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="rx-last-filled" className={labelClass}>Last filled</label>
              <input id="rx-last-filled" type="date" value={lastFilledDate} onChange={(e) => setLastFilledDate(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rx-written" className={labelClass}>Written date</label>
              <input id="rx-written" type="date" value={writtenDate} onChange={(e) => setWrittenDate(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="rx-expiration" className={labelClass}>Expires</label>
              <input id="rx-expiration" type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <div>
            <label htmlFor="rx-notes" className={labelClass}>Notes</label>
            <textarea id="rx-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fieldClass} resize-none`} />
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
            className="flex-1 bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {prescription ? 'Save changes' : 'Add prescription'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-3 rounded-xl font-semibold text-muted hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { type Appointment, APPOINTMENT_TYPES, APPOINTMENT_TYPE_KEY } from '@/lib/appointments'
import { useDialog } from '@/lib/useDialog'
import { useI18n } from '@/lib/i18n'

interface AppointmentModalProps {
  /** Existing appointment to edit, or null to create a new one. */
  appointment: Appointment | null
  onClose: () => void
  onSave: (values: Partial<Appointment>) => Promise<void>
}

/** <input type="datetime-local"> wants local 'YYYY-MM-DDTHH:mm'; convert an ISO
 *  timestamp to that (in the browser's timezone) and back without fabricating. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
}

/** Accessible add/edit dialog for an appointment. Mirrors PrescriptionModal. */
export function AppointmentModal({ appointment, onClose, onSave }: AppointmentModalProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState(appointment?.title ?? '')
  const [appointmentType, setAppointmentType] = useState(appointment?.appointmentType ?? 'endocrinology')
  const [when, setWhen] = useState(isoToLocalInput(appointment?.appointmentDate))
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  const handleSave = async () => {
    if (!title.trim()) {
      setError(t('apptModal.errTitle'))
      return
    }
    if (!when) {
      setError(t('apptModal.errWhen'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        title: title.trim(),
        appointmentType,
        // datetime-local is in local time; store a real ISO instant.
        appointmentDate: new Date(when).toISOString(),
        notes,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || t('apptModal.errGeneric'))
    } finally {
      setSaving(false)
    }
  }

  const fieldClass =
    'w-full bg-surface border border-line rounded-xl p-3 font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary'
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
        aria-labelledby="appt-title"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface border border-line rounded-3xl p-7 shadow-lg"
      >
        <div className="flex items-start justify-between mb-6">
          <h2 id="appt-title" className="text-xl font-bold text-ink">
            {appointment ? t('apptModal.editTitle') : t('apptModal.addTitle')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="appt-name" className={labelClass}>{t('apptModal.titleLabel')}</label>
            <input
              ref={firstFieldRef}
              id="appt-name"
              type="text"
              placeholder={t('apptModal.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="appt-type" className={labelClass}>{t('apptModal.type')}</label>
              <select
                id="appt-type"
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value)}
                className={fieldClass}
              >
                {APPOINTMENT_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(APPOINTMENT_TYPE_KEY[opt.value])}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="appt-when" className={labelClass}>{t('apptModal.dateTime')}</label>
              <input
                id="appt-when"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="appt-notes" className={labelClass}>{t('rxModal.notes')}</label>
            <textarea
              id="appt-notes"
              rows={2}
              placeholder={t('apptModal.notesPlaceholder')}
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
            className="flex-1 bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {appointment ? t('common.saveChanges') : t('apptModal.addTitle')}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-3 rounded-xl font-semibold text-muted hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

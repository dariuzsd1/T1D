'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { Product } from '@/lib/store'
import { useDialog } from '@/lib/useDialog'
import { createClient } from '@/lib/supabase/client'
import { rowToDevice, deviceLabel, type MedicalDevice, type MedicalDeviceRow } from '@/lib/devices'
import { rowToPrescription, type Prescription } from '@/lib/prescriptions'
import { rateFromDaysPerUnit, daysPerUnitFromRate } from '@/lib/depletion'

interface EditProductModalProps {
  product: Product
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Product>) => Promise<void>
  onSaved?: (name: string) => void
}

/** Accessible edit dialog (role="dialog", aria-modal, Escape to close, backdrop
 *  click to close). Edits the two fields the store can persist: quantity and
 *  expiration date — both feed the honest runway recompute. */
export function EditProductModal({ product, onClose, onUpdate, onSaved }: EditProductModalProps) {
  const [quantity, setQuantity] = useState(product.quantity)
  // <input type="date"> wants YYYY-MM-DD; trim any time component.
  const [expirationDate, setExpirationDate] = useState(
    product.expirationDate ? product.expirationDate.slice(0, 10) : ''
  )
  // Usage is captured two intuitive ways. "wear" = "each one lasts N days"
  // (sensors/pods/sets — the common case); "rate" = "I use N per day"
  // (consumption items like test strips). Both resolve to the single internal
  // usageRatePerDay. Infer the starting mode from the stored rate: a rate of
  // 1/day or less means a unit lasts at least a day → a wear item.
  const initialDaysPerUnit = daysPerUnitFromRate(product.usageRatePerDay)
  const [trackMode, setTrackMode] = useState<'wear' | 'rate'>(
    product.usageRatePerDay > 1 ? 'rate' : 'wear'
  )
  const [perUnitDays, setPerUnitDays] = useState<string>(
    initialDaysPerUnit != null ? String(initialDaysPerUnit) : ''
  )
  const [perDay, setPerDay] = useState<string>(
    product.usageRatePerDay > 1 ? String(product.usageRatePerDay) : ''
  )
  const [refillIntervalDays, setRefillIntervalDays] = useState<string>(
    product.refillIntervalDays != null ? String(product.refillIntervalDays) : ''
  )
  const [lastFilledDate, setLastFilledDate] = useState(
    product.lastFilledDate ? product.lastFilledDate.slice(0, 10) : ''
  )
  const [copay, setCopay] = useState<string>(
    product.copay != null ? String(product.copay) : ''
  )
  const [deviceId, setDeviceId] = useState<string>(product.deviceId ?? '')
  const [devices, setDevices] = useState<MedicalDevice[]>([])
  const [prescriptionId, setPrescriptionId] = useState<string>(product.prescriptionId ?? '')
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  // Load the user's devices + prescriptions so this supply can be linked to a
  // pump/CGM and to the prescription that covers it. Best-effort: if a table
  // doesn't exist yet, that picker simply stays hidden.
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('medical_devices')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setDevices((data as MedicalDeviceRow[]).map(rowToDevice))
      })
    supabase
      .from('prescriptions')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setPrescriptions(data.map(rowToPrescription))
      })
  }, [])

  // Resolve the active mode to the single internal rate. 0 = "not set" → estimate.
  const resolvedRate =
    trackMode === 'wear'
      ? rateFromDaysPerUnit(parseFloat(perUnitDays) || 0)
      : parseFloat(perDay) > 0
        ? parseFloat(perDay)
        : 0

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await onUpdate(product.id, {
        quantity,
        usageRatePerDay: resolvedRate,
        // Persist null when cleared so it actually removes the date.
        expirationDate: expirationDate || null,
        refillIntervalDays: refillIntervalDays ? parseInt(refillIntervalDays, 10) : null,
        lastFilledDate: lastFilledDate || null,
        copay: copay ? parseFloat(copay) : null,
        deviceId: deviceId || null,
        prescriptionId: prescriptionId || null,
      })
      onSaved?.(product.name)
      onClose()
    } catch (err) {
      // Keep the dialog open with the user's input intact — closing (or toasting
      // success) on a failed write would silently lose the change.
      console.error('Failed to save changes:', err)
      setSaveError("Couldn't save your changes. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/40" />

      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        className="relative w-full max-w-md bg-surface border border-line rounded-3xl p-7 shadow-lg"
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 id="edit-title" className="text-xl font-bold text-ink">{product.name}</h2>
            <p className="text-sm text-muted">{product.brand}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="edit-quantity" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Quantity on hand</label>
            <input
              ref={firstFieldRef}
              id="edit-quantity"
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Usage (optional)</label>
            {/* Two intuitive ways to express the same thing. "Each one lasts" suits
                worn items (sensors/pods/sets); "I use per day" suits consumables. */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-surface-2 border border-line rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setTrackMode('wear')}
                className={`text-xs font-semibold py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${trackMode === 'wear' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                Each one lasts
              </button>
              <button
                type="button"
                onClick={() => setTrackMode('rate')}
                className={`text-xs font-semibold py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${trackMode === 'rate' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                I use per day
              </button>
            </div>

            {trackMode === 'wear' ? (
              <div className="relative">
                <input
                  id="edit-usage-days"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  placeholder="e.g. 7 for a sensor, 3 for a pod"
                  value={perUnitDays}
                  onChange={(e) => setPerUnitDays(e.target.value)}
                  className="w-full bg-surface border border-line rounded-xl p-3.5 pr-14 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-faint pointer-events-none">days</span>
              </div>
            ) : (
              <div className="relative">
                <input
                  id="edit-usage-rate"
                  type="number"
                  min="0"
                  step="0.5"
                  inputMode="decimal"
                  placeholder="e.g. 5 test strips a day"
                  value={perDay}
                  onChange={(e) => setPerDay(e.target.value)}
                  className="w-full bg-surface border border-line rounded-xl p-3.5 pr-16 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-faint pointer-events-none">/ day</span>
              </div>
            )}
            <p className="text-xs text-faint mt-1.5">
              {resolvedRate > 0
                ? `Makes "days remaining" exact — about ${Math.floor(quantity / resolvedRate)} days at this rate.`
                : trackMode === 'wear'
                  ? 'Days you wear or use one before replacing it. Until set, days remaining is a rough estimate.'
                  : 'How many you go through per day. Until set, days remaining is a rough estimate.'}
            </p>
          </div>
          <div>
            <label htmlFor="edit-expiration" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Expiration date (optional)</label>
            <input
              id="edit-expiration"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
            />
          </div>

          {/* Link this supply to a device (pump/CGM) so it shows on the Devices
              page. Only shown once the user has added at least one device. */}
          {devices.length > 0 && (
            <div>
              <label htmlFor="edit-device" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Part of a device (optional)</label>
              <select
                id="edit-device"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
              >
                <option value="">Not linked to a device</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{deviceLabel(d)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Link this supply to the prescription that covers it, so runway and
              refills-left can be reconciled ("no refills left and it runs out
              in 9 days"). Only shown once at least one prescription exists. */}
          {prescriptions.length > 0 && (
            <div>
              <label htmlFor="edit-prescription" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Covered by a prescription (optional)</label>
              <select
                id="edit-prescription"
                value={prescriptionId}
                onChange={(e) => setPrescriptionId(e.target.value)}
                className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
              >
                <option value="">Not linked to a prescription</option>
                {prescriptions.map(rx => (
                  <option key={rx.id} value={rx.id}>
                    {rx.medicationName}{rx.dosage ? ` (${rx.dosage})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Refill cycle — powers the insurance refill-window engine. Saving
              requires the columns from docs/REFILL_RULES_MIGRATION.md. */}
          <div className="pt-5 border-t border-line">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-1">Refill cycle (optional)</p>
            <p className="text-xs text-faint mb-3">Lets the app tell you when insurance allows a refill.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-refill-interval" className="block text-[11px] font-medium text-muted mb-1.5">Days between refills</label>
                <input
                  id="edit-refill-interval"
                  type="number"
                  min="1"
                  placeholder="e.g. 90"
                  value={refillIntervalDays}
                  onChange={(e) => setRefillIntervalDays(e.target.value)}
                  className="w-full bg-surface border border-line rounded-xl p-3 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="edit-last-filled" className="block text-[11px] font-medium text-muted mb-1.5">Last filled</label>
                <input
                  id="edit-last-filled"
                  type="date"
                  value={lastFilledDate}
                  onChange={(e) => setLastFilledDate(e.target.value)}
                  className="w-full bg-surface border border-line rounded-xl p-3 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="edit-copay" className="block text-[11px] font-medium text-muted mb-1.5">Copay per refill ($)</label>
                <input
                  id="edit-copay"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 30"
                  value={copay}
                  onChange={(e) => setCopay(e.target.value)}
                  className="w-full bg-surface border border-line rounded-xl p-3 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <p className="text-xs text-faint mt-2">
              Copay + supply length power the Costs page&apos;s spending estimate.
            </p>
          </div>
        </div>

        {saveError && (
          <div role="status" className="mt-5 p-3 bg-urgent-soft border border-urgent/20 rounded-xl text-urgent text-sm font-medium">
            {saveError}
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save changes
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

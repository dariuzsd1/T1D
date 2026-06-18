'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { Product } from '@/lib/store'
import { useDialog } from '@/lib/useDialog'

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
  const [usageRate, setUsageRate] = useState<string>(
    product.usageRatePerDay > 0 ? String(product.usageRatePerDay) : ''
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
  const [saving, setSaving] = useState(false)
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const firstFieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(product.id, {
        quantity,
        // 0 = "not set" → the runway falls back to a labelled estimate.
        usageRatePerDay: usageRate ? parseFloat(usageRate) : 0,
        // Persist null when cleared so it actually removes the date.
        expirationDate: expirationDate || null,
        refillIntervalDays: refillIntervalDays ? parseInt(refillIntervalDays, 10) : null,
        lastFilledDate: lastFilledDate || null,
        copay: copay ? parseFloat(copay) : null,
      })
      onSaved?.(product.name)
      onClose()
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
            <label htmlFor="edit-usage" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Daily usage (optional)</label>
            <input
              id="edit-usage"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 0.33 for one pod every 3 days"
              value={usageRate}
              onChange={(e) => setUsageRate(e.target.value)}
              className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
            />
            <p className="text-xs text-faint mt-1.5">
              {usageRate && parseFloat(usageRate) > 0
                ? `Makes "days remaining" exact — about ${Math.floor(quantity / parseFloat(usageRate))} days at this rate.`
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

          {/* Refill cycle — powers the insurance refill-window engine. Saving
              requires the columns from docs/REFILL_RULES_MIGRATION.md. */}
          <div className="pt-5 border-t border-line">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-1">Refill cycle (optional)</p>
            <p className="text-xs text-faint mb-3">Lets the app tell you when insurance allows a refill.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-refill-interval" className="block text-[11px] font-medium text-muted mb-1.5">Supply length (days)</label>
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

'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { Product } from '@/lib/store'

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
    setSaving(true)
    try {
      await onUpdate(product.id, {
        quantity,
        // Persist null when cleared so it actually removes the date.
        expirationDate: expirationDate || null,
      })
      onSaved?.(product.name)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />

      <motion.div
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
            <label htmlFor="edit-expiration" className="block text-xs font-semibold uppercase tracking-widest text-muted mb-2">Expiration date (optional)</label>
            <input
              id="edit-expiration"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full bg-surface border border-line rounded-xl p-3.5 font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
            />
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

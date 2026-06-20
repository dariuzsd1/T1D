'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, X, ShoppingCart, Minus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { stockStatus, isRateEstimated } from '@/lib/depletion'
import { reorderTargetFor } from '@/lib/suppliers'
import { useDialog } from '@/lib/useDialog'
import { Badge } from '@/components/ui/badge'
import type { Product } from '@/lib/store'
import type { SharedWithMe } from '@/lib/caregivers'

/**
 * Modal that fetches and shows a patient's supplies to one of their caregivers.
 * Respects the share role: `manage` caregivers can log use ("Use one"); `view`
 * caregivers are read-only. Access is enforced server-side by RLS on the
 * /api/caregiver/[ownerId]/inventory route — this UI just reflects it.
 *
 * `onChanged` fires after a successful write so a parent screen (e.g. the
 * "People I care for" home) can refresh its at-a-glance status.
 */
export function ViewPatientModal({
  shared,
  onClose,
  onChanged,
}: {
  shared: SharedWithMe
  onClose: () => void
  onChanged?: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const [inventory, setInventory] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Optimistic quantities so "Use One" feels instant
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({})

  const displayName = shared.ownerEmail ?? `Patient (${shared.ownerId.slice(0, 8)}…)`

  useEffect(() => {
    fetch(`/api/caregiver/${shared.ownerId}/inventory`)
      .then(r => r.json())
      .then(res => {
        if (res.error) { setError(res.error); setLoading(false); return }
        setInventory(res.data ?? [])
        const initial: Record<string, number> = {}
        for (const p of (res.data ?? [])) initial[p.id] = p.quantity
        setQtyMap(initial)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load inventory.'); setLoading(false) })
  }, [shared.ownerId])

  const handleUseOne = async (product: Product) => {
    const current = qtyMap[product.id] ?? product.quantity
    if (current <= 0) return
    const next = current - 1
    // Optimistic update
    setQtyMap(prev => ({ ...prev, [product.id]: next }))
    const res = await fetch(`/api/caregiver/${shared.ownerId}/inventory`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplyId: product.id, quantity: next }),
    })
    if (!res.ok) {
      // Revert on failure
      setQtyMap(prev => ({ ...prev, [product.id]: current }))
      showToast('Could not update supply.', 'caution')
    } else {
      showToast(`Logged use of ${product.name}.`, 'success')
      onChanged?.()
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-patient-title"
        className="relative w-full sm:max-w-lg bg-surface border border-line rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[90dvh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-line shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal mb-1">
              {shared.role === 'manage' ? 'View & manage' : 'View only'}
            </p>
            <h2 id="view-patient-title" className="text-xl font-bold text-ink">
              {displayName}&apos;s supplies
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}
          {error && (
            <div className="bg-urgent-soft rounded-2xl p-4 text-urgent text-sm">{error}</div>
          )}
          {!loading && !error && inventory.length === 0 && (
            <p className="text-center text-muted py-12">No supplies recorded yet.</p>
          )}
          {!loading && !error && inventory.length > 0 && (
            <ul className="divide-y divide-line">
              {inventory.map(product => {
                const qty = qtyMap[product.id] ?? product.quantity
                const estimated = isRateEstimated(product.usageRatePerDay)
                const runway = estimated
                  ? (product.usageRatePerDay > 0 ? Math.round(qty / product.usageRatePerDay) : product.remainingDays)
                  : Math.round(qty / product.usageRatePerDay)
                const status = stockStatus(runway, 14)
                const tone = status === 'out' ? 'urgent' : status === 'low' ? 'caution' : 'success'
                const statusLabel = status === 'out' ? 'Out' : status === 'low' ? 'Reorder soon' : 'Well stocked'
                const reorder = reorderTargetFor(product)
                return (
                  <li key={product.id} className="py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {qty} on hand · {estimated ? '~' : ''}{runway} days
                        {product.brand ? ` · ${product.brand}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge tone={tone}>{statusLabel}</Badge>
                      {/* Use One — only for manage role */}
                      {shared.role === 'manage' && (
                        <button
                          onClick={() => handleUseOne(product)}
                          disabled={qty <= 0}
                          aria-label={`Use one ${product.name}`}
                          className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-faint hover:text-primary hover:bg-surface-2 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title="Use one"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                      {/* Reorder */}
                      <a
                        href={reorder.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Reorder ${product.name}`}
                        className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-faint hover:text-primary hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        title={reorder.isDirect ? `Reorder via ${reorder.label}` : 'Find a supplier'}
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </a>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer note for view-only */}
        {shared.role === 'view' && (
          <div className="px-6 py-3 border-t border-line shrink-0">
            <p className="text-xs text-faint text-center">
              You have view-only access. Ask {displayName} to upgrade you to &ldquo;manage&rdquo; to log use.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}

'use client'

import type { Product } from '@/lib/store'
import { stockStatus, isRateEstimated, DEFAULT_SAFETY_BUFFER_DAYS } from '@/lib/depletion'
import { reorderTargetFor } from '@/lib/suppliers'
import { ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A calm, single-line view of one supply — status dot, name, one plain-language
 * line, and the single most useful action (reorder). The detailed ProductCard
 * lives on the "All supplies" page; this is for the glanceable Home and Reorder
 * views, where the goal is one clear answer, not a data table.
 */
export function SupplyStatusRow({
  product,
  bufferDays = DEFAULT_SAFETY_BUFFER_DAYS,
  onReorder,
}: {
  product: Product
  bufferDays?: number
  onReorder?: (label: string) => void
}) {
  const status = stockStatus(product.remainingDays, bufferDays)
  const estimated = isRateEstimated(product.usageRatePerDay)
  const reorder = reorderTargetFor(product)

  const dot =
    status === 'out' ? 'bg-urgent' : status === 'low' ? 'bg-caution' : 'bg-success'
  const statusLabel =
    status === 'out' ? 'Out of stock' : status === 'low' ? 'Reorder soon' : 'Well stocked'

  // One honest line: how long it lasts (or "out now"), never a data dump.
  const daysLine =
    status === 'out'
      ? 'None on hand'
      : `${estimated ? '~' : ''}${product.remainingDays} days left`

  return (
    <div className="flex items-center gap-4 bg-surface border border-line rounded-2xl p-4">
      <span
        className={cn('w-2.5 h-2.5 rounded-full shrink-0', dot)}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink truncate">{product.name}</p>
        <p className="text-sm text-muted truncate">
          {statusLabel} · {daysLine}
        </p>
      </div>

      <a
        href={reorder.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onReorder?.(reorder.label)}
        className={cn(
          'shrink-0 inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
          status === 'out'
            ? 'bg-urgent text-white hover:bg-urgent/90'
            : status === 'low'
            ? 'bg-caution text-white hover:bg-caution/90'
            : 'bg-surface-2 text-ink hover:bg-line border border-line'
        )}
      >
        <ShoppingCart className="w-4 h-4" />
        <span className="hidden sm:inline">Reorder</span>
      </a>
    </div>
  )
}

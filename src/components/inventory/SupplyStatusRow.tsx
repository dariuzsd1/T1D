'use client'

import type { Product } from '@/lib/store'
import { displayStatus, isRateEstimated, DEFAULT_SAFETY_BUFFER_DAYS } from '@/lib/depletion'
import { reorderTargetFor } from '@/lib/suppliers'
import { ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

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
  const { t } = useI18n()
  // displayStatus: an unknown rate renders neutral 'unset', never an alarm.
  const status = displayStatus(product, bufferDays)
  const estimated = isRateEstimated(product.usageRatePerDay)
  const reorder = reorderTargetFor(product)

  const dot =
    status === 'out' ? 'bg-urgent'
    : status === 'low' ? 'bg-caution'
    : status === 'unset' ? 'bg-faint'
    : 'bg-success'
  const statusLabel =
    status === 'out' ? t('row.outOfStock')
    : status === 'low' ? t('row.reorderSoon')
    : status === 'unset' ? t('row.unsetLabel')
    : t('row.wellStocked')

  // One honest line: how long it lasts (or "out now"), never a data dump. An
  // unset item's day count would rest on the fallback guess, so say so instead.
  const daysLabel = t(
    product.remainingDays === 1 ? 'row.daysLeftOne' : 'row.daysLeftOther',
    { count: `${estimated ? '~' : ''}${product.remainingDays}` }
  )
  const daysLine =
    status === 'out' ? t('row.noneOnHand')
    : status === 'unset' ? t('row.unsetDays')
    : daysLabel

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
        <span className="hidden sm:inline">{t('row.reorder')}</span>
      </a>
    </div>
  )
}

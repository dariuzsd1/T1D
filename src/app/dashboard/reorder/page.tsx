'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useStore } from '@/lib/store'
import { useInventory } from '@/lib/useInventory'
import { displayStatus } from '@/lib/depletion'
import { DME_SUPPLIERS } from '@/lib/suppliers'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/lib/i18n'
import { useProfile } from '@/components/profile/ProfileProvider'
import { trackEvent } from '@/lib/analytics'
import { BackButton } from '@/components/ui/BackButton'
import { SupplyStatusRow } from '@/components/inventory/SupplyStatusRow'
import { CheckCircle2, ExternalLink, Truck } from 'lucide-react'

export default function ReorderPage() {
  const { inventory, safetyBufferDays, updateProduct } = useStore()
  const { showToast } = useToast()
  const { t } = useI18n()
  const { profile } = useProfile()
  // TanStack Query (shared with Home/Supplies): cached + deduplicated, so
  // arriving here from either of those pages reuses the already-fetched data.
  const { isLoading: loading } = useInventory()

  useEffect(() => {
    if (profile?.analyticsOptIn) void trackEvent('opened_reorder', true)
  }, [profile?.analyticsOptIn])

  // Out first, then low — most urgent at the top. "ok" items aren't shown here,
  // and neither are unknown-rate items: their runway is a guess, so they get the
  // quiet "not forecast yet" list below instead of an urgency ranking.
  const toReorder = [...inventory]
    .filter((p) => {
      const s = displayStatus(p, safetyBufferDays)
      return s === 'out' || s === 'low'
    })
    .sort((a, b) => a.remainingDays - b.remainingDays)
  const notForecast = inventory.filter(
    (p) => displayStatus(p, safetyBufferDays) === 'unset'
  )

  const handleReorder = (label: string) =>
    showToast(
      label === 'find a supplier'
        ? t('toast.openingSearch')
        : t('toast.openingSupplier', { label }),
      'info'
    )

  const handleMarkOrdered = async (id: string, ordered: boolean) => {
    try {
      await updateProduct(id, { lastOrderedDate: ordered ? new Date().toISOString() : null })
      if (ordered && profile?.analyticsOptIn) void trackEvent('marked_ordered', true)
    } catch (err) {
      console.error('Failed to update order status:', err)
      const name = inventory.find((p) => p.id === id)?.name ?? ''
      showToast(t('product.toastMarkOrderedFail', { name }), 'caution')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8" aria-busy={loading}>
      <BackButton />

      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('reorder.kicker')}</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t('reorder.title')}</h1>
        <p className="text-muted text-sm mt-2 max-w-prose">
          {t('reorder.intro', { buffer: safetyBufferDays })}
        </p>
      </header>

      {loading && (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-surface-2 rounded w-40 mx-auto" />
          </div>
        </div>
      )}

      {/* Nothing to reorder — calm reassurance */}
      {!loading && toReorder.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-success-soft border border-success/20 rounded-3xl p-10 text-center space-y-3"
        >
          <div className="w-14 h-14 rounded-2xl bg-success/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-success" />
          </div>
          <p className="text-lg font-bold text-success">{t('reorder.nothingTitle')}</p>
          <p className="text-muted text-sm max-w-xs mx-auto">{t('reorder.nothingBody')}</p>
          <Link
            href="/dashboard/supplies"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1"
          >
            {t('reorder.viewAll')}
          </Link>
        </motion.div>
      )}

      {/* Ranked list */}
      {!loading && toReorder.length > 0 && (
        <section className="space-y-3">
          {toReorder.map((item) => (
            <SupplyStatusRow
              key={item.id}
              product={item}
              bufferDays={safetyBufferDays}
              onReorder={handleReorder}
              onMarkOrdered={handleMarkOrdered}
            />
          ))}
        </section>
      )}

      {/* Unknown-rate items — quiet, never ranked as urgent (their runway is a
          guess until usage is set; a guess must not drive an alarm). */}
      {!loading && notForecast.length > 0 && (
        <section className="bg-surface border border-line rounded-3xl p-6">
          <h3 className="font-semibold text-ink">{t('reorder.unsetTitle')}</h3>
          <p className="text-sm text-muted mt-1 mb-4">{t('reorder.unsetBody')}</p>
          <ul className="divide-y divide-line">
            {notForecast.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-ink text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted">{p.quantity} · {t('row.unsetDays')}</p>
                </div>
                <Link
                  href="/dashboard/supplies"
                  className="shrink-0 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1"
                >
                  {t('reorder.setUsage')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Distributor shortcuts — useful no matter what */}
      <section className="bg-surface border border-line rounded-3xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-teal" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">{t('reorder.distributorsTitle')}</h3>
            <p className="text-sm text-muted">{t('reorder.distributorsBody')}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {DME_SUPPLIERS.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 border border-line px-4 py-3 text-sm font-semibold text-ink hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {s.label}
              <ExternalLink className="w-4 h-4 text-faint" />
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

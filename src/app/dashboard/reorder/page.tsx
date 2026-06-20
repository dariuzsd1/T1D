'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useStore } from '@/lib/store'
import { stockStatus } from '@/lib/depletion'
import { DME_SUPPLIERS } from '@/lib/suppliers'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/lib/i18n'
import { BackButton } from '@/components/ui/BackButton'
import { SupplyStatusRow } from '@/components/inventory/SupplyStatusRow'
import { CheckCircle2, ExternalLink, Truck } from 'lucide-react'

export default function ReorderPage() {
  const { inventory, setInventory, safetyBufferDays } = useStore()
  const { showToast } = useToast()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/inventory')
        if (response.ok) {
          const result = await response.json()
          setInventory(result.data || [])
        }
      } catch (err) {
        console.error('Failed to fetch inventory:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchInventory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Out first, then low — most urgent at the top. "ok" items aren't shown here.
  const toReorder = [...inventory]
    .filter((p) => stockStatus(p.remainingDays, safetyBufferDays) !== 'ok')
    .sort((a, b) => a.remainingDays - b.remainingDays)

  const handleReorder = (label: string) =>
    showToast(
      label === 'find a supplier'
        ? t('toast.openingSearch')
        : t('toast.openingSupplier', { label }),
      'info'
    )

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
            />
          ))}
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

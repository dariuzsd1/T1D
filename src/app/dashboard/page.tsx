'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useStore } from '@/lib/store'
import { stockStatus } from '@/lib/depletion'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/lib/i18n'
import { SupplyStatusRow } from '@/components/inventory/SupplyStatusRow'
import {
  Plus, CheckCircle2, AlertTriangle, ShoppingCart, Package, ChevronRight,
} from 'lucide-react'

export default function DashboardPage() {
  const { inventory, setInventory, safetyBufferDays } = useStore()
  const { showToast } = useToast()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/inventory')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const result = await response.json()
        setInventory(result.data || [])
        setError(null)
      } catch (err: any) {
        console.error('Failed to fetch inventory:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchInventory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sorted = [...inventory].sort((a, b) => a.remainingDays - b.remainingDays)
  const needsAttention = sorted.filter(
    (p) => stockStatus(p.remainingDays, safetyBufferDays) !== 'ok'
  )
  const hasOut = needsAttention.some(
    (p) => stockStatus(p.remainingDays, safetyBufferDays) === 'out'
  )
  const allGood = inventory.length > 0 && needsAttention.length === 0

  const handleReorder = (label: string) =>
    showToast(
      label === 'find a supplier'
        ? t('toast.openingSearch')
        : t('toast.openingSupplier', { label }),
      'info'
    )

  return (
    <div className="max-w-2xl mx-auto space-y-8" aria-busy={loading}>
      <p role="status" aria-live="polite" className="sr-only">
        {loading ? 'Loading supplies…' : ''}
      </p>

      {/* Loading */}
      {loading && (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-surface-2 rounded w-40 mx-auto" />
            <div className="h-10 bg-surface-2 rounded w-28 mx-auto" />
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-urgent-soft border border-urgent/30 rounded-3xl p-6">
          <p className="text-urgent font-semibold mb-1">{t('home.errTitle')}</p>
          <p className="text-urgent/80 text-sm">{error}</p>
        </div>
      )}

      {/* Empty — onboarding */}
      {!loading && !error && inventory.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface border border-line rounded-3xl p-10 text-center space-y-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{t('home.emptyTitle')}</h1>
            <p className="text-muted max-w-sm mx-auto leading-relaxed">{t('home.emptyBody')}</p>
          </div>
          <Link
            href="/scan"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-deep text-white px-6 py-3.5 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            <Plus className="w-5 h-5" />
            {t('home.addFirst')}
          </Link>
        </motion.div>
      )}

      {/* Status hero — the one answer */}
      {!loading && !error && inventory.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={
            allGood
              ? 'rounded-3xl p-8 bg-success-soft border border-success/20'
              : hasOut
              ? 'rounded-3xl p-8 bg-urgent-soft border border-urgent/20'
              : 'rounded-3xl p-8 bg-caution-soft border border-caution/20'
          }
        >
          <div className="flex items-start gap-4">
            <div
              className={
                'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ' +
                (allGood ? 'bg-success/15' : hasOut ? 'bg-urgent/15' : 'bg-caution/15')
              }
            >
              {allGood ? (
                <CheckCircle2 className="w-7 h-7 text-success" />
              ) : (
                <AlertTriangle className={hasOut ? 'w-7 h-7 text-urgent' : 'w-7 h-7 text-caution'} />
              )}
            </div>
            <div className="min-w-0">
              <h1
                className={
                  'text-2xl sm:text-3xl font-bold tracking-tight ' +
                  (allGood ? 'text-success' : hasOut ? 'text-urgent' : 'text-caution')
                }
              >
                {allGood
                  ? t('home.allSet')
                  : t(
                      needsAttention.length === 1 ? 'home.needAttentionOne' : 'home.needAttentionOther',
                      { count: needsAttention.length }
                    )}
              </h1>
              <p className="text-muted mt-1.5 leading-relaxed">
                {allGood
                  ? t(
                      inventory.length === 1 ? 'home.allSetSubOne' : 'home.allSetSubOther',
                      { count: inventory.length, buffer: safetyBufferDays }
                    )
                  : t('home.needSub', { buffer: safetyBufferDays })}
              </p>
            </div>
          </div>
        </motion.section>
      )}

      {/* Attention list — only what matters, with reorder right here */}
      {!loading && needsAttention.length > 0 && (
        <section className="space-y-3">
          {needsAttention.map((item) => (
            <SupplyStatusRow
              key={item.id}
              product={item}
              bufferDays={safetyBufferDays}
              onReorder={handleReorder}
            />
          ))}
        </section>
      )}

      {/* Navigation cards — calm entry points to detail */}
      {!loading && !error && inventory.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NavCard
            href="/dashboard/supplies"
            icon={<Package className="w-5 h-5 text-primary" />}
            title={t('home.cardAllSupplies')}
            sub={t(
              inventory.length === 1 ? 'home.cardTrackedOne' : 'home.cardTrackedOther',
              { count: inventory.length }
            )}
          />
          <NavCard
            href="/dashboard/reorder"
            icon={<ShoppingCart className="w-5 h-5 text-primary" />}
            title={t('home.cardReorder')}
            sub={
              needsAttention.length > 0
                ? t(
                    needsAttention.length === 1 ? 'home.cardToReorderOne' : 'home.cardToReorderOther',
                    { count: needsAttention.length }
                  )
                : t('home.nothingNeeded')
            }
          />
        </section>
      )}

      {/* Add supply — always available */}
      {!loading && !error && inventory.length > 0 && (
        <div className="flex justify-center pt-2">
          <Link
            href="/scan"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            {t('home.addSupply')}
          </Link>
        </div>
      )}
    </div>
  )
}

function NavCard({
  href,
  icon,
  title,
  sub,
}: {
  href: string
  icon: React.ReactNode
  title: string
  sub: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 bg-surface border border-line rounded-2xl p-5 hover:border-primary/40 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-muted">{sub}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-faint group-hover:text-primary transition-colors" />
    </Link>
  )
}

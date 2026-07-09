'use client'

import { useEffect, useState } from 'react'
import { DollarSign, TrendingDown, PiggyBank, Info, CalendarClock } from 'lucide-react'
import type { Product } from '@/lib/store'
import { annualCost, isYearEndStockUpWindow, formatUsd } from '@/lib/cost'
import { errorMessage } from '@/lib/utils'
import { BackButton } from '@/components/ui/BackButton'
import { useI18n } from '@/lib/i18n'

export default function CostsPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/inventory')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setItems(json.data || [])
        setError(null)
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  // Only items with BOTH a copay and a refill cadence have a real, computable
  // cost — everything else is left uncounted (we never guess a price).
  const priced = items
    .map((it) => ({ item: it, annual: annualCost(it.copay, it.refillIntervalDays) }))
    .filter((x): x is { item: Product; annual: number } => x.annual !== null)
    .sort((a, b) => b.annual - a.annual)

  const totalAnnual = priced.reduce((sum, x) => sum + x.annual, 0)
  const totalMonthly = totalAnnual / 12
  const uncounted = items.length - priced.length
  const showYearEnd = priced.length > 0 && isYearEndStockUpWindow()

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <BackButton />
      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('nav.costs')}</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t('costs.title')}</h1>
        <p className="text-muted text-sm mt-2 max-w-prose">
          {t('costs.intro')}
        </p>
      </header>

      {loading && (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center animate-pulse">
          <div className="h-4 bg-surface-2 rounded w-40 mx-auto" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-urgent-soft border border-urgent/30 rounded-2xl p-6">
          <p className="text-urgent font-semibold">{t('costs.errorTitle')}</p>
          <p className="text-urgent/80 text-sm mt-1">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-surface border border-line rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                <TrendingDown className="w-20 h-20 text-primary" />
              </div>
              <p className="text-muted text-[11px] font-semibold uppercase tracking-widest mb-3">{t('costs.perMonth')}</p>
              <h3 className="text-4xl font-black text-ink tabular-nums">{formatUsd(totalMonthly)}</h3>
            </div>
            <div className="bg-surface border border-line rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                <PiggyBank className="w-20 h-20 text-teal" />
              </div>
              <p className="text-muted text-[11px] font-semibold uppercase tracking-widest mb-3">{t('costs.perYear')}</p>
              <h3 className="text-4xl font-black text-ink tabular-nums">{formatUsd(totalAnnual)}</h3>
            </div>
          </section>

          {/* Year-end stock-up nudge (qualitative — no fabricated savings figure) */}
          {showYearEnd && (
            <div className="bg-teal/10 border border-teal/30 rounded-2xl p-5 flex gap-3">
              <CalendarClock className="w-5 h-5 text-teal shrink-0 mt-0.5" />
              <p className="text-sm text-ink leading-relaxed">
                <span className="font-semibold">{t('costs.yearEndTipLabel')}</span> {t('costs.yearEndTipBody')}
              </p>
            </div>
          )}

          {/* Breakdown */}
          {priced.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted px-1">{t('costs.perItemHeading')}</h3>
              {priced.map(({ item, annual }) => {
                const refillsPerYear = 365 / (item.refillIntervalDays as number)
                return (
                  <div key={item.id} className="bg-surface border border-line rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate">{item.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {t('costs.refillsPerYear', { copay: formatUsd(item.copay as number), count: refillsPerYear.toFixed(1) })}
                      </p>
                    </div>
                    <span className="font-black text-ink tabular-nums shrink-0">{formatUsd(annual)}<span className="text-xs font-medium text-faint">{t('costs.perYearSuffix')}</span></span>
                  </div>
                )
              })}
            </section>
          ) : (
            <div className="bg-surface border border-line rounded-3xl p-10 text-center space-y-3">
              <DollarSign className="w-8 h-8 text-faint mx-auto" />
              <p className="text-muted font-medium">{t('costs.emptyTitle')}</p>
              <p className="text-sm text-faint max-w-sm mx-auto">
                {t('costs.emptyBody')}
              </p>
            </div>
          )}

          {/* Honest footnote about what isn't counted */}
          {uncounted > 0 && (
            <p className="flex items-start gap-2 text-xs text-faint px-1">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {t(uncounted === 1 ? 'costs.uncountedOne' : 'costs.uncountedOther', { count: uncounted })}
            </p>
          )}
        </>
      )}
    </div>
  )
}

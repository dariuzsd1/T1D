'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  CheckCircle2, AlertTriangle, ShoppingCart, Minus, Loader2,
  Activity, ShieldCheck, Package,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/lib/i18n'
import { displayStatus, DEFAULT_SAFETY_BUFFER_DAYS, isRateEstimated } from '@/lib/depletion'
import { reorderTargetFor } from '@/lib/suppliers'
import { BackButton } from '@/components/ui/BackButton'
import { Badge } from '@/components/ui/badge'
import type { Product } from '@/lib/store'

type Safety = 'good' | 'watch' | 'act'

export default function SafetyViewPage() {
  const { ownerId } = useParams<{ ownerId: string }>()
  const { showToast } = useToast()
  const { t } = useI18n()

  const [inventory, setInventory] = useState<Product[]>([])
  const [role, setRole] = useState<'view' | 'manage'>('view')
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({})

  useEffect(() => {
    fetch(`/api/caregiver/${ownerId}/inventory`)
      .then(r => r.json())
      .then(res => {
        if (res.error) { setError(res.error); setLoading(false); return }
        const items: Product[] = res.data ?? []
        setInventory(items)
        setRole(res.role === 'manage' ? 'manage' : 'view')
        setOwnerEmail(res.ownerEmail ?? null)
        const initial: Record<string, number> = {}
        for (const p of items) initial[p.id] = p.quantity
        setQtyMap(initial)
        setLoading(false)
      })
      .catch(() => { setError(t('safetyview.loadErr')); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId])

  const name = ownerEmail ? ownerEmail.split('@')[0] : `#${String(ownerId).slice(0, 6)}`

  // Derive status from runway, recomputed against optimistic quantities.
  // displayStatus: unknown-rate items are neutral 'unset' here too — a caregiver
  // must not be alarmed (or reassured) by a number built on the fallback guess.
  const withStatus = inventory.map(p => {
    const qty = qtyMap[p.id] ?? p.quantity
    const estimated = isRateEstimated(p.usageRatePerDay)
    const runway = p.usageRatePerDay > 0 ? Math.round(qty / p.usageRatePerDay) : p.remainingDays
    const status = displayStatus(
      { quantity: qty, usageRatePerDay: p.usageRatePerDay, expirationDate: p.expirationDate },
      DEFAULT_SAFETY_BUFFER_DAYS
    )
    return { product: p, qty, estimated, runway, status }
  })
  const outCount = withStatus.filter(s => s.status === 'out').length
  const lowCount = withStatus.filter(s => s.status === 'low').length
  const safety: Safety = outCount > 0 ? 'act' : lowCount > 0 ? 'watch' : 'good'

  // Most urgent item name (fewest days left among real alarms), else None.
  const urgent = [...withStatus]
    .filter(s => s.status === 'out' || s.status === 'low')
    .sort((a, b) => a.runway - b.runway)[0]

  const handleUseOne = async (product: Product) => {
    const current = qtyMap[product.id] ?? product.quantity
    if (current <= 0) return
    const next = current - 1
    setQtyMap(prev => ({ ...prev, [product.id]: next }))
    const res = await fetch(`/api/caregiver/${ownerId}/inventory`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplyId: product.id, quantity: next }),
    })
    if (!res.ok) {
      setQtyMap(prev => ({ ...prev, [product.id]: current }))
      showToast(t('quickActions.couldntSave', { name: product.name }), 'caution')
    }
  }

  // Tone helpers for the safety state.
  const tone = {
    good: { bg: 'bg-success-soft border-success/20', text: 'text-success', chip: 'bg-success/15 text-success', icon: CheckCircle2 },
    watch: { bg: 'bg-caution-soft border-caution/20', text: 'text-caution', chip: 'bg-caution/15 text-caution', icon: AlertTriangle },
    act: { bg: 'bg-urgent-soft border-urgent/20', text: 'text-urgent', chip: 'bg-urgent/15 text-urgent', icon: AlertTriangle },
  }[safety]
  const StateIcon = tone.icon

  const headline =
    safety === 'good' ? t('safetyview.headlineGood')
    : safety === 'act'
      ? t(outCount === 1 ? 'safetyview.headlineActOne' : 'safetyview.headlineActOther', { name, count: outCount })
      : t(lowCount === 1 ? 'safetyview.headlineWatchOne' : 'safetyview.headlineWatchOther', { name, count: lowCount })
  const support = safety === 'good' ? t('safetyview.supportGood') : safety === 'act' ? t('safetyview.supportAct') : t('safetyview.supportWatch')
  const quickRead = safety === 'good' ? t('safetyview.quickReadGood') : safety === 'act' ? t('safetyview.quickReadAct') : t('safetyview.quickReadWatch')
  const badge = safety === 'good' ? t('safetyview.badgeGood') : safety === 'act' ? t('safetyview.badgeAct') : t('safetyview.badgeWatch')

  return (
    <div className="max-w-5xl mx-auto space-y-6" aria-busy={loading}>
      <BackButton fallbackHref="/dashboard/family" label={t('common.back')} />

      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('safetyview.kicker')}</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t('safetyview.caringFor', { name })}</h1>
        <p className="text-muted text-sm mt-2 max-w-prose">{t('safetyview.subtitle')}</p>
      </header>

      {loading && (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-urgent-soft border border-urgent/30 rounded-3xl p-6">
          <p className="text-urgent font-semibold">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── Current safety state ── */}
          <section className={`rounded-3xl border p-7 ${tone.bg}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{t('safetyview.currentState')}</h3>
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${tone.chip}`}>{badge}</span>
            </div>

            <div className="flex items-start gap-3">
              <StateIcon className={`w-7 h-7 shrink-0 ${tone.text}`} />
              <div>
                <h4 className={`text-xl font-bold tracking-tight ${tone.text}`}>{headline}</h4>
                <p className="text-muted text-sm mt-1.5 leading-relaxed">{support}</p>
              </div>
            </div>

            {/* Quick read */}
            <div className="mt-5 rounded-2xl bg-surface/70 border border-line p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1.5">{t('safetyview.quickRead')}</p>
              <p className="text-sm text-ink leading-relaxed">{quickRead}</p>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              <Stat label={t('safetyview.tracked')} value={String(inventory.length)} />
              <Stat label={t('safetyview.reorderSoon')} value={String(lowCount)} tone={lowCount > 0 ? 'caution' : undefined} />
              <Stat label={t('safetyview.out')} value={String(outCount)} tone={outCount > 0 ? 'urgent' : undefined} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Stat label={t('safetyview.mostUrgent')} value={urgent ? urgent.product.name : t('safetyview.none')} />
              <Stat label={t('safetyview.responder')} value={t('safetyview.you')} />
            </div>
          </section>

          {/* ── Right column ── */}
          <div className="space-y-6">
            {/* Honest live-monitoring panel */}
            <section className="bg-surface border border-line rounded-3xl p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-ink flex items-center gap-2">
                  <Activity className="w-5 h-5 text-muted" /> {t('safetyview.monitoringTitle')}
                </h3>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-faint border border-line">
                  {t('safetyview.monitoringNotConnected')}
                </span>
              </div>
              <p className="text-sm text-muted leading-relaxed">{t('safetyview.monitoringBody')}</p>
            </section>

            {/* Supplies */}
            <section className="bg-surface border border-line rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-ink flex items-center gap-2">
                  <Package className="w-5 h-5 text-muted" /> {t('safetyview.suppliesTitle')}
                </h3>
                <span className="text-xs font-semibold text-teal flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {role === 'manage' ? t('safetyview.manageRole') : t('safetyview.viewOnly')}
                </span>
              </div>

              {inventory.length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">{t('safetyview.empty')}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {withStatus
                    .sort((a, b) => a.runway - b.runway)
                    .map(({ product, qty, estimated, runway, status }) => {
                      const badgeTone =
                        status === 'out' ? 'urgent' : status === 'low' ? 'caution' : status === 'unset' ? 'neutral' : 'success'
                      const label =
                        status === 'out' ? t('row.outOfStock')
                        : status === 'low' ? t('row.reorderSoon')
                        : status === 'unset' ? t('row.unsetLabel')
                        : t('row.wellStocked')
                      const reorder = reorderTargetFor(product)
                      return (
                        <li key={product.id} className="py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-ink text-sm truncate">{product.name}</p>
                            <p className="text-xs text-muted mt-0.5">
                              {qty} · {status === 'out' ? t('row.noneOnHand') : status === 'unset' ? t('row.unsetDays') : t(runway === 1 ? 'row.daysLeftOne' : 'row.daysLeftOther', { count: `${estimated ? '~' : ''}${runway}` })}
                            </p>
                          </div>
                          <Badge tone={badgeTone}>{label}</Badge>
                          {role === 'manage' && (
                            <button
                              onClick={() => handleUseOne(product)}
                              disabled={qty <= 0}
                              aria-label={t('common.useOneAria', { name: product.name })}
                              className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-faint hover:text-primary hover:bg-surface-2 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              title={t('product.useOne')}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          )}
                          <a
                            href={reorder.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${t('row.reorder')} ${product.name}`}
                            className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-faint hover:text-primary hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title={reorder.isDirect ? `${t('row.reorder')} · ${reorder.label}` : t('row.reorder')}
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </a>
                        </li>
                      )
                    })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'caution' | 'urgent' }) {
  const valueCls = tone === 'urgent' ? 'text-urgent' : tone === 'caution' ? 'text-caution' : 'text-ink'
  return (
    <div className="rounded-2xl bg-surface/70 border border-line p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">{label}</p>
      <p className={`text-lg font-bold tabular-nums truncate ${valueCls}`}>{value}</p>
    </div>
  )
}

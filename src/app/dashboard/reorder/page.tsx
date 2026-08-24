'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { useStore, type Product } from '@/lib/store'
import { useInventory } from '@/lib/useInventory'
import { effectiveLeadTimeDays, type DisplayStatus } from '@/lib/depletion'
import { itemDisplayStatus } from '@/lib/rescueItems'
import { DME_SUPPLIERS } from '@/lib/suppliers'
import { createClient } from '@/lib/supabase/client'
import { rowToPrescription, type Prescription } from '@/lib/prescriptions'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/lib/i18n'
import type { TKey } from '@/lib/i18n/dictionaries'
import { useProfile } from '@/components/profile/ProfileProvider'
import { trackEvent } from '@/lib/analytics'
import { BackButton } from '@/components/ui/BackButton'
import {
  CheckCircle2, ExternalLink, Truck, Copy, Share2, Printer, Check, Pill,
} from 'lucide-react'

/** Which real-world path resupplies this item, inferred from its linked Rx. */
type RefillChannel = 'refill' | 'newRx' | 'noRx'

interface RefillPlan {
  product: Product
  status: DisplayStatus
  rx: Prescription | null
  channel: RefillChannel
}

/** Channel groups, in the order they appear on screen and in the exported text. */
const CHANNELS: { key: RefillChannel; head: TKey }[] = [
  { key: 'refill', head: 'reorder.groupRefill' },
  { key: 'newRx', head: 'reorder.groupNewRx' },
  { key: 'noRx', head: 'reorder.groupNoRx' },
]

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'))
}

export default function ReorderPage() {
  const { inventory, safetyBufferDays, shippingLeadTimeDays, updateProduct } = useStore()
  const { showToast } = useToast()
  const { t } = useI18n()
  const { profile } = useProfile()
  // TanStack Query (shared with Home/Supplies): cached + deduplicated.
  const { isLoading: loading } = useInventory()

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  // Items the user has UNchecked (everything actionable is included by default).
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    if (profile?.analyticsOptIn) void trackEvent('opened_reorder', true)
  }, [profile?.analyticsOptIn])

  // navigator.share is client-only + not on every browser; read it after mount so
  // server and first client render match (no hydration mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    // Prescriptions give each item its refill context (Rx #, pharmacy, refills
    // left). Best-effort: a missing table just means no Rx lines.
    createClient()
      .from('prescriptions')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data) setPrescriptions(data.map(rowToPrescription))
      })
  }, [])

  const rxById = useMemo(
    () => new Map(prescriptions.map((rx) => [rx.id, rx])),
    [prescriptions]
  )

  const leadFor = (p: Product) => effectiveLeadTimeDays(p, shippingLeadTimeDays)
  const statusOf = (p: Product) => itemDisplayStatus(p, safetyBufferDays, leadFor(p))

  // Actionable items (out/low/expiring), most urgent first, each tagged with the
  // refill path its linked prescription implies. Cheap map/filter over a small
  // list, so it just recomputes each render (no memo bookkeeping needed).
  const plans: RefillPlan[] = [...inventory]
    .map((p) => ({ product: p, status: statusOf(p) }))
    .filter(({ status }) => status === 'out' || status === 'low')
    .sort((a, b) => a.product.remainingDays - b.product.remainingDays)
    .map(({ product, status }) => {
      const rx = product.prescriptionId ? rxById.get(product.prescriptionId) ?? null : null
      const channel: RefillChannel = !rx
        ? 'noRx'
        : rx.refillsRemaining != null && rx.refillsRemaining <= 0
          ? 'newRx'
          : 'refill'
      return { product, status, rx, channel }
    })

  const notForecast = inventory.filter((p) => statusOf(p) === 'unset')

  const included = plans.filter((pl) => !excluded.has(pl.product.id))
  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // ---- Build the shareable / printable text (grouped by channel) ----
  const buildText = (): string => {
    const byChannel = (c: RefillChannel) => included.filter((pl) => pl.channel === c)
    const line = (pl: RefillPlan): string => {
      const name = pl.product.brand ? `${pl.product.name} (${pl.product.brand})` : pl.product.name
      // Lead with the stock word so a plain-text reader (or the pharmacy) still
      // learns which items are already out vs merely low — color can't carry it.
      const bits: string[] = [t(pl.status === 'out' ? 'reorder.stOut' : 'reorder.stLow')]
      if (pl.rx?.rxNumber) bits.push(t('reorder.rxNumber', { rx: pl.rx.rxNumber }))
      if (pl.rx?.pharmacy) bits.push(pl.rx.pharmacy)
      if (pl.channel === 'refill' && pl.rx?.refillsRemaining != null) {
        bits.push(t(pl.rx.refillsRemaining === 1 ? 'reorder.refillsLeftOne' : 'reorder.refillsLeftOther', { count: pl.rx.refillsRemaining }))
      }
      if (pl.channel === 'newRx' && pl.rx?.prescriber) bits.push(pl.rx.prescriber)
      return `- ${name}: ${bits.join(', ')}`
    }
    const section = (headingKey: TKey, c: RefillChannel): string[] => {
      const rows = byChannel(c)
      if (rows.length === 0) return []
      return [`${t(headingKey)}:`, ...rows.map(line), '']
    }
    return [
      t('reorder.textTitle'),
      format(new Date(), 'PP'),
      '',
      ...section('reorder.groupRefill', 'refill'),
      ...section('reorder.groupNewRx', 'newRx'),
      ...section('reorder.groupNoRx', 'noRx'),
    ].join('\n').trim()
  }

  const copyList = async () => {
    if (included.length === 0) { showToast(t('reorder.nothingToCopy'), 'info'); return }
    try {
      await navigator.clipboard.writeText(buildText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      showToast(t('reorder.copiedToast'), 'success')
    } catch {
      showToast(t('reorder.copyFail'), 'caution')
    }
  }

  const shareList = async () => {
    if (included.length === 0) { showToast(t('reorder.nothingToCopy'), 'info'); return }
    try {
      await navigator.share({ title: t('reorder.textTitle'), text: buildText() })
    } catch {
      // User cancel or unsupported → fall back to copy so the action isn't a dead end.
      void copyList()
    }
  }

  const printList = () => {
    if (included.length === 0) { showToast(t('reorder.nothingToCopy'), 'info'); return }
    const w = window.open('', '_blank', 'width=620,height=760')
    if (!w) { void copyList(); return }
    w.document.write(
      `<pre style="font:14px/1.5 system-ui,sans-serif;padding:28px;white-space:pre-wrap;color:#16202e">${escapeHtml(buildText())}</pre>`
    )
    w.document.close()
    w.focus()
    w.print()
  }

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

  const channelLabel = (pl: RefillPlan): string => {
    if (pl.channel === 'refill') {
      return pl.rx?.pharmacy ? t('reorder.actionRefillAt', { pharmacy: pl.rx.pharmacy }) : t('reorder.actionRefillGeneric')
    }
    if (pl.channel === 'newRx') {
      return pl.rx?.prescriber ? t('reorder.actionNewRxFrom', { prescriber: pl.rx.prescriber }) : t('reorder.actionNewRxGeneric')
    }
    return t('reorder.actionNoRx')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8" aria-busy={loading}>
      <BackButton />

      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('reorder.kicker')}</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t('reorder.refillTitle')}</h1>
        <p className="text-muted text-sm mt-2 max-w-prose">{t('reorder.refillBody')}</p>
      </header>

      {loading && (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-surface-2 rounded w-40 mx-auto" />
          </div>
        </div>
      )}

      {/* Nothing to reorder — calm reassurance */}
      {!loading && plans.length === 0 && (
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

      {/* The refill list — compile, then act (call pharmacy / ask provider / bring to visit) */}
      {!loading && plans.length > 0 && (
        <section className="bg-surface border border-line rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-line flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted">{t('reorder.selectHint')}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={copyList}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary-deep text-white px-3 min-h-[44px] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? t('reorder.copied') : t('reorder.copy')}
              </button>
              {canShare && (
                <button
                  onClick={shareList}
                  aria-label={t('reorder.share')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 hover:bg-line border border-line text-ink px-3 min-h-[44px] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Share2 className="w-4 h-4" /> {t('reorder.share')}
                </button>
              )}
              <button
                onClick={printList}
                aria-label={t('reorder.print')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 hover:bg-line border border-line text-ink px-3 min-h-[44px] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Printer className="w-4 h-4" /> {t('reorder.print')}
              </button>
            </div>
          </div>

          {/* Grouped by channel so the on-screen structure matches the copied /
              printed text: refill at pharmacy, then new-Rx, then link-an-Rx.
              Items keep their most-urgent-first order within each group. */}
          {CHANNELS.map(({ key, head }) => {
            const rows = plans.filter((pl) => pl.channel === key)
            if (rows.length === 0) return null
            return (
              <div key={key} className="border-b border-line last:border-b-0">
                <h3 className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest text-muted">
                  {t(head)}
                </h3>
                <ul className="divide-y divide-line">
                  {rows.map((pl) => {
                    const p = pl.product
                    const checked = !excluded.has(p.id)
                    const dot = pl.status === 'out' ? 'bg-urgent' : 'bg-caution'
                    const inputId = `refill-${p.id}`
                    return (
                      <li key={p.id} className="flex items-start gap-3 p-4">
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(p.id)}
                          className="mt-1 w-5 h-5 accent-primary shrink-0"
                        />
                        <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
                            <span className="font-semibold text-ink truncate">{p.name}</span>
                            {/* Stock word, not color alone (CLAUDE.md §5). */}
                            <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${pl.status === 'out' ? 'text-urgent' : 'text-caution'}`}>
                              {pl.status === 'out' ? t('reorder.stOut') : t('reorder.stLow')}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                            <Pill className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            {channelLabel(pl)}
                            {pl.channel === 'refill' && pl.rx?.refillsRemaining != null && (
                              <> · {t(pl.rx.refillsRemaining === 1 ? 'reorder.refillsLeftOne' : 'reorder.refillsLeftOther', { count: pl.rx.refillsRemaining })}</>
                            )}
                            {pl.channel === 'newRx' && <> · {t('reorder.noRefills')}</>}
                          </span>
                        </label>

                        <div className="shrink-0 flex items-center gap-1">
                          <button
                            onClick={() => handleMarkOrdered(p.id, true)}
                            aria-label={t('product.markOrderedAria', { name: p.name })}
                            title={t('product.markOrderedTitle')}
                            className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}

          {/* Cross-link to Visit prep rather than implying this action list is
              also the appointment handout — see design-refill-list note. */}
          <div className="p-4 border-t border-line">
            <Link
              href="/dashboard/visit-prep"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1 py-1"
            >
              {t('reorder.bringToVisit')}
            </Link>
          </div>
        </section>
      )}

      {/* Unknown-rate items — quiet, never ranked as urgent. */}
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

      {/* Where to buy — honest hand-off. The app does NOT place orders; these open
          the supplier's own site (most need a prescription on file + a login). */}
      <section className="bg-surface border border-line rounded-3xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-teal" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">{t('reorder.whereToBuyTitle')}</h3>
            <p className="text-sm text-muted">{t('reorder.handoffNote')}</p>
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

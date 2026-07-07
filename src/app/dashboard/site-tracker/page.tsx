'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Info, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/ui/BackButton'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/lib/i18n'
import { logActivity } from '@/lib/activity'
import type { Product } from '@/lib/store'
import {
  BODY_ZONES,
  RECENT_USE_DAYS,
  type BodyView,
  type BodyZone,
  type SiteChangeRow,
  type ZoneView,
  buildZoneViews,
  suggestedZoneId,
  hasZoneHistory,
  zoneLabelKey,
  zoneAriaKey,
  zoneCenter,
  elapsedTextKey,
} from '@/lib/siteRotation'
import { LogSiteChangeModal, type SiteChangeInput } from '@/components/site/LogSiteChangeModal'

export default function SiteTrackerPage() {
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()
  const { t } = useI18n()
  // Resolve a zone's elapsed text (never/unknown/N days) in the active language.
  const elapsedLabel = (elapsed: ZoneView['elapsed']) => {
    const { key, vars } = elapsedTextKey(elapsed)
    return t(key, vars)
  }

  const [view, setView] = useState<BodyView>('front')
  const [changes, setChanges] = useState<SiteChangeRow[]>([])
  const [inventory, setInventory] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  // Which zone's log dialog is open.
  const [logZone, setLogZone] = useState<BodyZone | null>(null)
  // Zone driving the tooltip (hovered / keyboard-focused).
  const [activeId, setActiveId] = useState<string | null>(null)
  // Nonce → the post-log checkmark flash.
  const [justLogged, setJustLogged] = useState<number | null>(null)

  const loadChanges = useCallback(async () => {
    // select('*') stays forward-compatible: `body_zone` surfaces automatically
    // once the migration is applied, and its absence never errors the read.
    const { data, error } = await supabase
      .from('site_changes')
      .select('*')
      .order('applied_date', { ascending: false })
    if (!error && data) {
      setChanges(
        data.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          body_zone: (r.body_zone as string | null) ?? null,
          applied_date: (r.applied_date as string | null) ?? null,
        }))
      )
    }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      await Promise.all([
        loadChanges(),
        fetch('/api/inventory')
          .then((r) => (r.ok ? r.json() : { data: [] }))
          .then((res) => { if (!cancelled) setInventory(Array.isArray(res.data) ? res.data : []) })
          .catch(() => {}),
      ])
      if (!cancelled) setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [loadChanges])

  // Auto-clear the checkmark flash.
  useEffect(() => {
    if (justLogged == null) return
    const t = setTimeout(() => setJustLogged(null), 1300)
    return () => clearTimeout(t)
  }, [justLogged])

  const views = useMemo(() => buildZoneViews(changes), [changes])
  const historyExists = useMemo(() => hasZoneHistory(changes), [changes])
  // Only surface a suggestion once there's real history (else it's meaningless).
  const suggestedId = historyExists ? suggestedZoneId(views) : null
  const suggestedZone = suggestedId ? BODY_ZONES.find((z) => z.id === suggestedId) ?? null : null

  const visibleZones = BODY_ZONES.filter((z) => z.view === view)
  const activeZone = visibleZones.find((z) => z.id === activeId) ?? null

  const switchView = (v: BodyView) => {
    setView(v)
    setActiveId(null)
  }

  const handleSave = async (zone: BodyZone, input: SiteChangeInput) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error(t('siteTracker.errSignedOut'))

    // Core insert first; the zone is a best-effort attach so a pre-migration DB
    // still records the change (just without a zone) instead of failing.
    const { data, error } = await supabase
      .from('site_changes')
      .insert({
        user_id: user.id,
        supply_id: input.supplyId,
        applied_date: input.appliedDate,
        notes: input.notes || null,
      })
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message || t('siteTracker.errSaveGeneric'))

    const { error: zoneErr } = await supabase
      .from('site_changes')
      .update({ body_zone: zone.id })
      .eq('id', data.id)
    if (zoneErr) {
      console.warn('body_zone not saved yet — run supabase/setup.sql:', zoneErr.message)
    }

    // 1-tap rotation: logging the site also uses up one of the linked supply, so
    // one interaction does both (V2 promise). Only real stock is decremented, and
    // the toast only claims what actually saved.
    let usedLine: string | null = null
    let usedFailed: string | null = null
    const linked = input.supplyId ? inventory.find((p) => p.id === input.supplyId) : null
    if (linked && linked.quantity > 0) {
      const nextQty = linked.quantity - 1
      const { error: useErr } = await supabase
        .from('supplies')
        .update({ quantity: nextQty, updated_at: new Date().toISOString() })
        .eq('id', linked.id)
      if (useErr) {
        console.error('Linked supply not decremented:', useErr.message)
        usedFailed = linked.name
      } else {
        setInventory((prev) =>
          prev.map((p) => (p.id === linked.id ? { ...p, quantity: nextQty } : p))
        )
        void logActivity('supply_used', linked.name)
        usedLine = t('siteTracker.toastLoggedUsed', { name: linked.name, count: nextQty })
      }
    }

    await loadChanges()
    setJustLogged(Date.now())
    if (usedFailed) {
      showToast(t('siteTracker.toastLoggedButFailed', { name: usedFailed }), 'caution')
    } else {
      showToast(usedLine ?? t('siteTracker.toastLoggedPlain'), 'success')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <BackButton />

      <header className="text-center space-y-3">
        <p className="text-muted text-xs font-semibold uppercase tracking-[0.2em]">{t('siteTracker.kicker')}</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t('siteTracker.title')}</h1>
        <p className="text-muted max-w-md mx-auto leading-relaxed">
          {t('siteTracker.intro')}
        </p>
      </header>

      {/* Front / Back segmented control */}
      <div className="flex justify-center">
        <div role="tablist" aria-label={t('siteTracker.bodyViewAria')} className="inline-flex rounded-xl bg-surface-2 p-1">
          {(['front', 'back'] as BodyView[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => switchView(v)}
              className={cn(
                'px-6 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal',
                view === v ? 'bg-surface text-teal shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              {v === 'front' ? t('siteTracker.front') : t('siteTracker.back')}
            </button>
          ))}
        </div>
      </div>

      {/* Suggested-next callout (real history) or first-time prompt */}
      {!loading && (
        <div className="flex justify-center -mt-2">
          {suggestedZone ? (
            <button
              onClick={() => switchView(suggestedZone.view)}
              className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success-soft px-4 py-1.5 text-sm font-medium text-success transition-colors hover:bg-success/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              {t('siteTracker.suggestedNext')} <span className="font-semibold">{t(zoneLabelKey(suggestedZone))}</span>
              {suggestedZone.view !== view && <span className="text-success/70">· {suggestedZone.view === 'front' ? t('siteTracker.onFrontView') : t('siteTracker.onBackView')}</span>}
            </button>
          ) : historyExists ? null : (
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-muted">
              <Info className="w-4 h-4 text-teal" aria-hidden="true" />
              {t('siteTracker.tapToLog')}
            </p>
          )}
        </div>
      )}

      {/* Figure */}
      <div className="relative bg-surface border border-line rounded-3xl p-6 sm:p-10 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-[440px]" aria-busy="true">
            <Loader2 className="w-6 h-6 text-teal animate-spin" />
          </div>
        ) : (
          <div className="relative mx-auto w-full max-w-[300px] aspect-[240/470]">
            <svg
              viewBox="0 0 240 470"
              className="absolute inset-0 h-full w-full"
              role="group"
              aria-label={view === 'front' ? t('siteTracker.bodyMapAriaFront') : t('siteTracker.bodyMapAriaBack')}
            >
              {/* Base figure — unchanged from Stage 1 (figure shapes not in scope). */}
              <g fill="var(--color-surface-2)" stroke="var(--color-line)" strokeWidth={2} strokeLinejoin="round">
                <circle cx="120" cy="52" r="30" />
                <rect x="108" y="76" width="24" height="24" rx="10" />
                <path d="M70 108 Q72 97 84 96 L156 96 Q168 97 170 108 Q176 146 154 185 Q150 220 166 250 Q168 261 158 262 L82 262 Q72 261 74 250 Q90 220 86 185 Q64 146 70 108 Z" />
                <rect x="48" y="112" width="24" height="140" rx="12" />
                <rect x="168" y="112" width="24" height="140" rx="12" />
                <rect x="78" y="248" width="38" height="204" rx="18" />
                <rect x="124" y="248" width="38" height="204" rx="18" />
              </g>

              {view === 'back' && (
                <line x1="120" y1="104" x2="120" y2="210" stroke="var(--color-line)" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
              )}

              {visibleZones.map((zone) => (
                <ZoneShape
                  key={zone.id}
                  zone={zone}
                  zoneView={views.get(zone.id)!}
                  isSuggested={zone.id === suggestedId}
                  open={logZone?.id === zone.id}
                  onOpen={() => setLogZone(zone)}
                  onActiveChange={(on) =>
                    setActiveId((cur) => (on ? zone.id : cur === zone.id ? null : cur))
                  }
                  labelForAria={t(zoneAriaKey(zone))}
                  elapsedLabel={elapsedLabel(views.get(zone.id)!.elapsed)}
                  suggestedText={t('siteTracker.ariaSuggestedNext')}
                  recentText={t('siteTracker.ariaRecentlyUsed')}
                />
              ))}
            </svg>

            {/* Tooltip — real name + last-used status for the active zone. */}
            {activeZone && (() => {
              const { cx, cy } = zoneCenter(activeZone)
              const zv = views.get(activeZone.id)!
              const suggested = activeZone.id === suggestedId
              return (
                <div
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
                  style={{ left: `${(cx / 240) * 100}%`, top: `${(cy / 470) * 100}%` }}
                >
                  <div className="mb-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-white shadow-md">
                    <span className="block text-xs font-semibold">{t(zoneLabelKey(activeZone))}</span>
                    <span className="block text-[11px] text-white/80">
                      {suggested ? t('siteTracker.suggestedNextPrefix') : ''}{elapsedLabel(zv.elapsed)}
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* Post-log checkmark flash (respects reduced motion). */}
            <CheckmarkFlash show={justLogged != null} />
          </div>
        )}
      </div>

      {/* Color key */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <LegendItem label={t('siteTracker.legendAvailable')} fill="var(--color-surface-2)" opacity={1} stroke="var(--color-faint)" />
        <LegendItem label={t('siteTracker.legendFocused')} fill="var(--color-teal)" opacity={0.24} stroke="var(--color-teal)" />
        <LegendItem label={t('siteTracker.legendRecentOther', { days: RECENT_USE_DAYS })} fill="var(--color-caution)" opacity={0.2} stroke="var(--color-caution)" />
        <LegendItem label={t('siteTracker.legendSuggested')} fill="var(--color-success)" opacity={0.2} stroke="var(--color-success)" />
      </div>

      <p className="flex items-start justify-center gap-2 text-center text-xs text-faint max-w-md mx-auto">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{t('siteTracker.footNote')}</span>
      </p>

      {logZone && (
        <LogSiteChangeModal
          zone={logZone}
          inventory={inventory}
          onClose={() => setLogZone(null)}
          onSave={(input) => handleSave(logZone, input)}
        />
      )}
    </div>
  )
}

/**
 * A single zone: a focusable rounded rect with resting-marker (suggested/recent/
 * default) and interactive (hover/focus/open) paint, plus a small corner dot for
 * marked zones. Tokens are applied via CSS vars so paint transitions together.
 */
function ZoneShape({
  zone,
  zoneView,
  isSuggested,
  open,
  onOpen,
  onActiveChange,
  labelForAria,
  elapsedLabel,
  suggestedText,
  recentText,
}: {
  zone: BodyZone
  zoneView: ZoneView
  isSuggested: boolean
  open: boolean
  onOpen: () => void
  onActiveChange: (active: boolean) => void
  /** Pre-translated aria fragment for the zone (e.g. "Abdomen, left side"). */
  labelForAria: string
  /** Pre-translated elapsed text (e.g. "Last used 3 days ago"). */
  elapsedLabel: string
  suggestedText: string
  recentText: string
}) {
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const active = hover || focus || open

  let fill = 'var(--color-surface-2)'
  let fillOpacity = 1
  let stroke = 'var(--color-faint)' // strengthened resting outline (reads as tappable)
  let strokeWidth = 1.75
  if (active) {
    fill = 'var(--color-teal)'
    fillOpacity = open ? 0.24 : 0.14
    stroke = 'var(--color-teal)'
    strokeWidth = open ? 3 : 2.25
  } else if (isSuggested) {
    fill = 'var(--color-success)'
    fillOpacity = 0.12
    stroke = 'var(--color-success)'
    strokeWidth = 2.25
  } else if (zoneView.isRecent) {
    fill = 'var(--color-caution)'
    fillOpacity = 0.12
    stroke = 'var(--color-caution)'
    strokeWidth = 2.25
  }

  const dotColor = isSuggested
    ? 'var(--color-success)'
    : zoneView.isRecent
      ? 'var(--color-caution)'
      : null

  const ariaParts = [labelForAria]
  if (isSuggested) ariaParts.push(suggestedText)
  else if (zoneView.isRecent) ariaParts.push(recentText)
  ariaParts.push(elapsedLabel.toLowerCase())
  const ariaLabel = ariaParts.join(', ')

  return (
    <g>
      <rect
        x={zone.x}
        y={zone.y}
        width={zone.w}
        height={zone.h}
        rx={zone.rx}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        className="cursor-pointer outline-none"
        style={{
          fill,
          fillOpacity,
          stroke,
          strokeWidth,
          transition: 'fill .15s ease, fill-opacity .15s ease, stroke .15s ease, stroke-width .15s ease',
        }}
        onMouseEnter={() => { setHover(true); onActiveChange(true) }}
        onMouseLeave={() => { setHover(false); onActiveChange(false) }}
        onFocus={() => { setFocus(true); onActiveChange(true) }}
        onBlur={() => { setFocus(false); onActiveChange(false) }}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
      />
      {dotColor && (
        <circle
          cx={zone.x + zone.w - 7}
          cy={zone.y + 7}
          r={4}
          fill={dotColor}
          stroke="var(--color-surface)"
          strokeWidth={1.5}
          aria-hidden="true"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </g>
  )
}

function CheckmarkFlash({ show }: { show: boolean }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden="true"
        >
          <motion.div
            className="flex items-center justify-center w-20 h-20 rounded-full bg-success text-white shadow-lg"
            initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          >
            <Check className="w-10 h-10" strokeWidth={3} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function LegendItem({
  label,
  fill,
  opacity,
  stroke,
}: {
  label: string
  fill: string
  opacity: number
  stroke: string
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" aria-hidden="true">
        <rect x="1" y="1" width="14" height="14" rx="4" style={{ fill, fillOpacity: opacity, stroke, strokeWidth: 1.5 }} />
      </svg>
      {label}
    </span>
  )
}

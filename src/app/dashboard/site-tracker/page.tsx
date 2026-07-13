'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Info, Loader2, Sparkles, RotateCcw } from 'lucide-react'
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
import { RotationGuideModal } from '@/components/site/RotationGuideModal'
import { ReuseWarningModal } from '@/components/site/ReuseWarningModal'

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
  // Whether the "How to rotate" education dialog is open.
  const [guideOpen, setGuideOpen] = useState(false)
  // A recently-used zone the user tapped, held pending an "are you sure?" check.
  const [pendingZone, setPendingZone] = useState<BodyZone | null>(null)
  // Zone driving the tooltip (hovered / keyboard-focused).
  const [activeId, setActiveId] = useState<string | null>(null)
  // Nonce → the post-log checkmark flash.
  const [justLogged, setJustLogged] = useState<number | null>(null)

  const loadChanges = useCallback(async (): Promise<SiteChangeRow[]> => {
    // select('*') stays forward-compatible: `body_zone` surfaces automatically
    // once the migration is applied, and its absence never errors the read.
    const { data, error } = await supabase
      .from('site_changes')
      .select('*')
      .order('applied_date', { ascending: false })
    if (error || !data) return []
    const mapped: SiteChangeRow[] = data.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      body_zone: (r.body_zone as string | null) ?? null,
      applied_date: (r.applied_date as string | null) ?? null,
    }))
    setChanges(mapped)
    return mapped
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

  // Glanceable status across ALL zones (both views), for the summary line — so a
  // touch user sees the picture without hovering or opening anything.
  const recentCount = BODY_ZONES.filter((z) => views.get(z.id)?.isRecent).length
  const availableCount = BODY_ZONES.length - recentCount

  // Tapping a zone opens the log dialog, except a recently-used spot first gets an
  // "are you sure?" nudge toward rotating (reuse is allowed, just not silent).
  const handleZoneOpen = (zone: BodyZone) => {
    if (views.get(zone.id)?.isRecent) setPendingZone(zone)
    else setLogZone(zone)
  }
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

    const fresh = await loadChanges()
    setJustLogged(Date.now())
    if (usedFailed) {
      showToast(t('siteTracker.toastLoggedButFailed', { name: usedFailed }), 'caution')
    } else {
      // Close the loop: name the best next spot to rotate to (from the freshly
      // reloaded history, so it already reflects the change we just logged).
      const nextId = hasZoneHistory(fresh) ? suggestedZoneId(buildZoneViews(fresh)) : null
      const nextZone = nextId ? BODY_ZONES.find((z) => z.id === nextId) ?? null : null
      if (nextZone) {
        const base = usedLine ?? t('siteTracker.toastLogged')
        showToast(`${base} ${t('siteTracker.nextBestSpot', { zone: t(zoneLabelKey(nextZone)) })}`, 'success')
      } else {
        showToast(usedLine ?? t('siteTracker.toastLoggedPlain'), 'success')
      }
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
          <div className="relative mx-auto w-full max-w-[300px] aspect-[260/520]">
            <svg
              viewBox="0 0 260 520"
              className="absolute inset-0 h-full w-full"
              role="group"
              aria-label={view === 'front' ? t('siteTracker.bodyMapAriaFront') : t('siteTracker.bodyMapAriaBack')}
            >
              <defs>
                {/* Soft grid that fills a resting (available) zone. Solid status
                    color takes over when a zone is suggested/recent/active. */}
                <pattern id="zone-mesh" width="7" height="7" patternUnits="userSpaceOnUse">
                  <path d="M0 0 H7 M0 0 V7" stroke="var(--color-faint)" strokeWidth={0.6} fill="none" opacity={0.55} />
                </pattern>
              </defs>

              {/* Naturalistic neutral silhouette (head, neck, torso, arms, legs).
                  Shared by both views; interior contour lines differ per view. */}
              <g fill="var(--color-surface-2)" stroke="var(--color-line)" strokeWidth={2} strokeLinejoin="round">
                <ellipse cx="130" cy="54" rx="22" ry="28" />
                <path d="M118 78 C117 90 116 96 113 105 L147 105 C144 96 143 90 142 78 Z" />
                <path d="M78 118 C92 106 106 104 116 105 C121 98 139 98 144 105 C154 104 168 106 182 118 C177 148 171 170 166 196 C164 207 164 214 168 227 C172 245 176 251 177 259 L83 259 C84 251 88 245 92 227 C96 214 96 207 94 196 C89 170 83 148 78 118 Z" />
                <path d="M79 116 C66 120 59 132 56 152 C53 178 54 206 58 232 C60 244 61 252 64 257 C68 260 74 259 76 253 C79 244 79 232 80 214 C82 184 83 150 84 126 C83 120 82 116 79 116 Z" />
                <path d="M181 116 C194 120 201 132 204 152 C207 178 206 206 202 232 C200 244 199 252 196 257 C192 260 186 259 184 253 C181 244 181 232 180 214 C178 184 177 150 176 126 C177 120 178 116 181 116 Z" />
                <path d="M84 259 L126 259 C127 276 126 300 123 330 C121 356 119 388 117 420 C116 446 115 462 113 470 C111 476 106 477 101 476 C95 476 90 474 89 468 C88 452 89 420 90 388 C91 356 90 320 89 300 C88 284 86 270 84 259 Z" />
                <path d="M176 259 L134 259 C133 276 134 300 137 330 C139 356 141 388 143 420 C144 446 145 462 147 470 C149 476 154 477 159 476 C165 476 170 474 171 468 C172 452 171 420 170 388 C169 356 170 320 171 300 C172 284 174 270 176 259 Z" />
              </g>

              {/* Interior contour detail — reads as a real body without becoming an
                  anatomy chart. Front: clavicle, sternum midline, pecs, deltoids. */}
              <g fill="none" stroke="var(--color-line)" strokeWidth={1.4} strokeLinecap="round" opacity={0.9}>
                {view === 'front' ? (
                  <>
                    <path d="M104 120 C116 127 144 127 156 120" />
                    <path d="M130 130 L130 166" />
                    <path d="M101 138 C110 150 122 150 128 143" />
                    <path d="M159 138 C150 150 138 150 132 143" />
                    <path d="M80 122 C74 132 72 143 75 153" />
                    <path d="M180 122 C186 132 188 143 185 153" />
                  </>
                ) : (
                  <>
                    <path d="M130 110 L130 214" />
                    <path d="M108 128 C112 140 118 146 124 146" />
                    <path d="M152 128 C148 140 142 146 136 146" />
                    <path d="M84 150 C80 168 82 188 91 200" />
                    <path d="M176 150 C180 168 178 188 169 200" />
                    <path d="M130 240 L130 264" />
                  </>
                )}
                {/* Knees — present on both views. Sit below the thigh zones. */}
                <path d="M95 362 C103 369 115 369 121 362" />
                <path d="M139 362 C145 369 157 369 165 362" />
              </g>

              {visibleZones.map((zone) => (
                <ZoneShape
                  key={zone.id}
                  zone={zone}
                  zoneView={views.get(zone.id)!}
                  isSuggested={zone.id === suggestedId}
                  open={logZone?.id === zone.id}
                  onOpen={() => handleZoneOpen(zone)}
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
                  style={{ left: `${(cx / 260) * 100}%`, top: `${(cy / 520) * 100}%` }}
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

      {/* Compact status summary — glanceable, works without hover (mobile). */}
      {!loading && (
        <p className="text-center text-sm text-muted">
          {recentCount === 0
            ? t('siteTracker.summaryAllReady', { count: BODY_ZONES.length })
            : t('siteTracker.summaryStatus', { recent: recentCount, days: RECENT_USE_DAYS, available: availableCount })}
        </p>
      )}

      {/* Color key */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <LegendItem label={t('siteTracker.legendAvailable')} mesh />
        <LegendItem label={t('siteTracker.legendFocused')} fill="var(--color-teal)" opacity={0.24} stroke="var(--color-teal)" />
        <LegendItem label={t('siteTracker.legendRecentOther', { days: RECENT_USE_DAYS })} fill="var(--color-caution)" opacity={0.2} stroke="var(--color-caution)" />
        <LegendItem label={t('siteTracker.legendSuggested')} fill="var(--color-success)" opacity={0.2} stroke="var(--color-success)" />
      </div>

      {/* How to rotate — expert-based education, one tap away */}
      <div className="flex justify-center">
        <button
          onClick={() => setGuideOpen(true)}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-teal transition-colors hover:border-teal/40 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          {t('siteTracker.howToRotate')}
        </button>
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

      {pendingZone && (
        <ReuseWarningModal
          zone={pendingZone}
          elapsedLabel={elapsedLabel(views.get(pendingZone.id)!.elapsed)}
          onCancel={() => setPendingZone(null)}
          onLogAnyway={() => {
            const z = pendingZone
            setPendingZone(null)
            setLogZone(z)
          }}
          onViewGuide={() => {
            setPendingZone(null)
            setGuideOpen(true)
          }}
        />
      )}

      {guideOpen && <RotationGuideModal onClose={() => setGuideOpen(false)} />}
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

  // Hybrid: a resting (available) zone shows the soft mesh grid; the moment it
  // is active, suggested, or recently used it fills with a solid status color.
  const isSolid = active || isSuggested || zoneView.isRecent

  let fill = 'var(--color-teal)'
  let fillOpacity = 0.14
  let stroke = 'var(--color-teal)'
  let strokeWidth = 2.25
  if (active) {
    fill = 'var(--color-teal)'
    fillOpacity = open ? 0.24 : 0.14
    stroke = 'var(--color-teal)'
    strokeWidth = open ? 3 : 2.25
  } else if (isSuggested) {
    fill = 'var(--color-success)'
    fillOpacity = 0.16
    stroke = 'var(--color-success)'
    strokeWidth = 2.25
  } else if (zoneView.isRecent) {
    fill = 'var(--color-caution)'
    fillOpacity = 0.16
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

  const rectDims = { x: zone.x, y: zone.y, width: zone.w, height: zone.h, rx: zone.rx }

  return (
    <g>
      {/* Visual layer (non-interactive). Solid color when active/flagged, else the
          mesh grid over a clean base so any contour line under it stays tidy. */}
      {isSolid ? (
        <rect
          {...rectDims}
          style={{
            fill,
            fillOpacity,
            stroke,
            strokeWidth,
            pointerEvents: 'none',
            transition: 'fill .15s ease, fill-opacity .15s ease, stroke .15s ease, stroke-width .15s ease',
          }}
        />
      ) : (
        <>
          <rect {...rectDims} style={{ fill: 'var(--color-surface-2)', pointerEvents: 'none' }} />
          <rect {...rectDims} fill="url(#zone-mesh)" style={{ pointerEvents: 'none' }} />
          <rect {...rectDims} style={{ fill: 'none', stroke: 'var(--color-faint)', strokeWidth: 1.75, pointerEvents: 'none' }} />
        </>
      )}

      {/* Interactive hit target on top (transparent so the visual shows through). */}
      <rect
        {...rectDims}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        className="cursor-pointer outline-none"
        style={{ fill: 'transparent' }}
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
  mesh = false,
}: {
  label: string
  /** Solid-swatch props (omit when `mesh`, which draws the available-zone grid). */
  fill?: string
  opacity?: number
  stroke?: string
  mesh?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0" aria-hidden="true">
        {mesh ? (
          <>
            <rect x="1" y="1" width="14" height="14" rx="4" style={{ fill: 'var(--color-surface-2)', stroke: 'var(--color-faint)', strokeWidth: 1.5 }} />
            <path d="M1 6 H15 M1 11 H15 M6 1 V15 M11 1 V15" style={{ stroke: 'var(--color-faint)', strokeWidth: 0.6, opacity: 0.55 }} fill="none" />
          </>
        ) : (
          <rect x="1" y="1" width="14" height="14" rx="4" style={{ fill, fillOpacity: opacity, stroke, strokeWidth: 1.5 }} />
        )}
      </svg>
      {label}
    </span>
  )
}

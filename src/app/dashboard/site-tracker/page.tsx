'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, RefreshCcw, Info, ChevronRight, Check, Package } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/ui/Toast'
import { BackButton } from '@/components/ui/BackButton'

// Static body-map positions only. We never hardcode "lastUsed" or a health
// verdict here — those are derived from real site logs below (CLAUDE.md §9:
// show real elapsed time, say "unknown" when unknown, never fake "Optimal").
const SITES = [
  { id: 'abdomen-tl', label: 'Top Left Abdomen', pos: { x: '35%', y: '45%' } },
  { id: 'abdomen-tr', label: 'Top Right Abdomen', pos: { x: '65%', y: '45%' } },
  { id: 'thigh-l', label: 'Left Thigh', pos: { x: '30%', y: '75%' } },
  { id: 'thigh-r', label: 'Right Thigh', pos: { x: '70%', y: '75%' } },
  { id: 'arm-l', label: 'Left Arm', pos: { x: '15%', y: '35%' } },
  { id: 'arm-r', label: 'Right Arm', pos: { x: '85%', y: '35%' } },
]

// Rest a site for at least this long before reusing it (lipohypertrophy guard).
const REST_DAYS = 7
const MS_PER_DAY = 1000 * 60 * 60 * 24

type SiteStatus = 'never' | 'resting' | 'ready'

interface SiteView {
  id: string
  label: string
  pos: { x: string; y: string }
  lastUsedAt: string | null
  lastUsedLabel: string
  daysSince: number | null
  status: SiteStatus
}

export default function SiteTrackerPage() {
  const { siteLogs, addSiteLog, inventory, setInventory, updateProduct } = useStore()
  const { showToast } = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Which supply a site change consumes (e.g. the pod/infusion set). '' = none.
  const [linkedSupplyId, setLinkedSupplyId] = useState<string>('')

  // Load inventory so the "also use one" supply picker works even when the user
  // lands here directly (the store no longer persists across reloads).
  useEffect(() => {
    if (inventory.length > 0) return
    fetch('/api/inventory')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => res?.data && setInventory(res.data))
      .catch(() => {})
  }, [inventory.length, setInventory])

  const linkedSupply = inventory.find((p) => p.id === linkedSupplyId) ?? null

  // Build an honest view of each site from the real logs.
  const sites: SiteView[] = SITES.map((site) => {
    const lastLog = siteLogs
      .filter((l) => l.siteId === site.id)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0]

    if (!lastLog) {
      return {
        ...site,
        lastUsedAt: null,
        lastUsedLabel: 'Never used',
        daysSince: null,
        status: 'never',
      }
    }

    const daysSince = Math.floor(
      (Date.now() - new Date(lastLog.timestamp).getTime()) / MS_PER_DAY
    )
    return {
      ...site,
      lastUsedAt: lastLog.timestamp,
      lastUsedLabel: `${formatDistanceToNow(new Date(lastLog.timestamp))} ago`,
      daysSince,
      status: daysSince < REST_DAYS ? 'resting' : 'ready',
    }
  })

  const selectedSite = sites.find((s) => s.id === selectedId) ?? null

  // Suggest the site rested longest (never-used first, then most days since use).
  const suggestedSite = [...sites].sort((a, b) => {
    if (a.status === 'never' && b.status !== 'never') return -1
    if (b.status === 'never' && a.status !== 'never') return 1
    return (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity)
  })[0]

  const handleMarkUsed = (site: SiteView) => {
    // One interaction: log the site, advance the rotation, and (if a supply is
    // linked) decrement that pod/set so inventory stays honest (CLAUDE.md §7-V2).
    addSiteLog({
      id: crypto.randomUUID(),
      siteId: site.id,
      timestamp: new Date().toISOString(),
    })

    if (linkedSupply && linkedSupply.quantity > 0) {
      updateProduct(linkedSupply.id, { quantity: linkedSupply.quantity - 1 })
      showToast(
        `${site.label} logged and one ${linkedSupply.name} used. Rest the site ${REST_DAYS} days.`,
        'success'
      )
    } else {
      showToast(
        `${site.label} logged. Rest it ${REST_DAYS} days before reusing.`,
        'success'
      )
    }
  }

  const statusLabel = (s: SiteStatus) =>
    s === 'never' ? 'Fresh site' : s === 'resting' ? 'Resting' : 'Ready'

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <BackButton />
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Keep sites healthy</h2>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Injection sites</h1>
        </div>
        <button className="bg-surface border border-line px-5 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-surface-2 text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <RefreshCcw className="w-5 h-5" />
          Update history
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        {/* Human Body Map */}
        <div className="lg:col-span-2 relative flex justify-center bg-surface border border-line rounded-3xl p-10 overflow-hidden min-h-[520px] shadow-sm">
          <div className="relative w-full max-w-sm">
            <svg viewBox="0 0 100 120" className="w-full h-full fill-surface-2 stroke-line stroke-[0.3]">
              <path d="M50 5 C55 5, 60 10, 60 15 C60 20, 55 25, 50 25 C45 25, 40 20, 40 15 C40 10, 45 5, 50 5
                M40 25 L35 30 C30 35, 25 45, 25 55 L22 80 L28 80 L30 55 C32 50, 40 45, 50 45 C60 45, 68 50, 70 55 L72 80 L78 80 L75 55 C75 45, 70 35, 65 30 L60 25 Z
                M40 80 L35 115 L45 115 L48 85 C49 83, 51 83, 52 85 L55 115 L65 115 L60 80 Z"
              />
            </svg>

            {sites.map((site) => (
              <motion.button
                key={site.id}
                whileHover={{ scale: 1.2 }}
                onClick={() => setSelectedId(site.id)}
                aria-label={`${site.label} — ${statusLabel(site.status)}, ${site.lastUsedLabel}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: site.pos.x, top: site.pos.y }}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 transition-all",
                  site.id === suggestedSite.id
                    ? "bg-primary border-surface shadow-md ring-2 ring-primary/30"
                    : site.status === 'resting'
                      ? "bg-caution border-surface"
                      : site.status === 'ready'
                        ? "bg-success border-surface"
                        : "bg-surface-2 border-line group-hover:border-primary group-hover:bg-primary/40"
                )} />
              </motion.button>
            ))}
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-primary text-white rounded-3xl p-7 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] mb-3 opacity-80">Next suggested</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xl font-bold">{suggestedSite.label}</h4>
                <p className="text-xs font-medium opacity-80">
                  {suggestedSite.status === 'never' ? 'Fresh site' : `Rested ${suggestedSite.lastUsedLabel}`}
                </p>
              </div>
            </div>
            {inventory.length > 0 && (
              <div className="mb-4">
                <label htmlFor="linked-supply" className="flex items-center gap-1.5 text-xs font-medium opacity-80 mb-2">
                  <Package className="w-3.5 h-3.5" />
                  Also use one of
                </label>
                <select
                  id="linked-supply"
                  value={linkedSupplyId}
                  onChange={(e) => setLinkedSupplyId(e.target.value)}
                  className="w-full bg-white text-ink rounded-xl px-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
                >
                  <option value="">Don&apos;t track a supply</option>
                  {inventory.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
                      {p.name}{p.quantity <= 0 ? ' (none left)' : ` (${p.quantity} left)`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => { setSelectedId(suggestedSite.id); handleMarkUsed(suggestedSite); }}
              className="w-full bg-white text-primary py-3.5 rounded-xl font-semibold text-sm hover:bg-surface-2 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
            >
              {linkedSupply ? 'Log site & use one' : 'Mark as used'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {selectedSite ? (
              <motion.div
                key={selectedSite.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface border border-line rounded-3xl p-7 shadow-sm"
              >
                <h3 className="text-muted text-xs font-semibold uppercase tracking-widest mb-6">{selectedSite.label}</h3>

                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-muted font-medium">Status</span>
                    <span className={cn(
                      "font-semibold flex items-center gap-2",
                      selectedSite.status === 'resting' ? "text-caution" : "text-success"
                    )}>
                      {selectedSite.status === 'ready' && <Check className="w-4 h-4" />}
                      {statusLabel(selectedSite.status)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted font-medium">Last used</span>
                    <span className="text-ink font-semibold">{selectedSite.lastUsedLabel}</span>
                  </div>
                  <div className="pt-4 border-t border-line flex gap-3">
                    <Info className="w-4 h-4 text-faint mt-0.5 shrink-0" />
                    <p className="text-xs text-muted leading-relaxed">
                      {selectedSite.status === 'resting'
                        ? `Used recently — let it rest ${Math.max(0, REST_DAYS - (selectedSite.daysSince ?? 0))} more day(s) before reusing.`
                        : 'Rotate at least 1 inch from the previous injection.'}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-48 border border-line rounded-3xl flex items-center justify-center text-center p-8 text-sm text-faint">
                Select a site on the map to view its history.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

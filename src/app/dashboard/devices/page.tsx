'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Cpu, Plus, Activity, Zap, Pen, TestTube2, ShoppingCart,
  Loader2, X, Trash2, Database, Package, Upload, Info,
  CheckCircle, AlertTriangle, Link2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useStore, type Product } from '@/lib/store'
import {
  type MedicalDevice, type MedicalDeviceRow, type DeviceKind,
  rowToDevice, deviceToRow, deviceLabel, DEVICE_PRESETS, DEVICE_KIND_KEY,
} from '@/lib/devices'
import { isMissingTableError } from '@/lib/prescriptions'
import { displayStatus, isRateEstimated } from '@/lib/depletion'
import { reorderTargetFor } from '@/lib/suppliers'
import { useDialog } from '@/lib/useDialog'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BackButton } from '@/components/ui/BackButton'
import {
  parseCareLink, EVENT_KIND_KEY, KIND_SUPPLY_KEYWORDS,
  formatShortDate,
  type CareLinkSummary, type CareLinkEventKind,
} from '@/lib/carelink'

const KIND_ICON: Record<DeviceKind, LucideIcon> = {
  pump: Zap,
  cgm: Activity,
  pen: Pen,
  meter: TestTube2,
}

export default function DevicesPage() {
  const { safetyBufferDays } = useStore()
  const { showToast } = useToast()
  const confirm = useConfirm()
  const { t } = useI18n()
  const supabase = createClient()

  const [devices, setDevices] = useState<MedicalDevice[]>([])
  const [inventory, setInventory] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    setLoading(true)
    const [{ data: { user } }, devRes, invRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('medical_devices').select('*').order('created_at', { ascending: true }),
      fetch('/api/inventory').then(r => r.json()).catch(() => ({ data: [] })),
    ])
    setUserId(user?.id ?? null)

    if (devRes.error) {
      if (isMissingTableError(devRes.error)) setNeedsSetup(true)
      else console.error('Failed to load devices:', devRes.error.message)
    } else {
      setDevices((devRes.data as MedicalDeviceRow[]).map(rowToDevice))
    }
    setInventory(Array.isArray(invRes?.data) ? invRes.data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = async (id: string) => {
    const device = devices.find((d) => d.id === id)
    const name = device ? deviceLabel(device) : ''
    const ok = await confirm({
      title: t('confirm.removeTitle', { name }),
      body: t('confirm.removeDeviceBody', { name }),
      confirmLabel: t('confirm.removeBtn'),
      tone: 'danger',
    })
    if (!ok) return
    const { error } = await supabase.from('medical_devices').delete().eq('id', id)
    if (error) { showToast(t('devices.deviceRemoveFail'), 'caution'); return }
    setDevices(prev => prev.filter(d => d.id !== id))
    showToast(t('devices.deviceRemoved'), 'success')
  }

  const linkedTo = (deviceId: string) => inventory.filter(p => p.deviceId === deviceId)
  const unlinkedCount = inventory.filter(p => !p.deviceId).length

  // Visually pair a pump with a CGM as one "system". This is UI grouping only —
  // it does NOT integrate the devices or claim vendor compatibility; it simply
  // reflects that a user's pump and CGM are used together. Common case: one pump
  // + one CGM = one system; any extras fall back to standalone cards.
  const pumps = devices.filter(d => d.kind === 'pump')
  const cgms = devices.filter(d => d.kind === 'cgm')
  const otherDevices = devices.filter(d => d.kind !== 'pump' && d.kind !== 'cgm')
  const pairCount = Math.min(pumps.length, cgms.length)
  const systems = Array.from({ length: pairCount }, (_, i) => ({ pump: pumps[i], cgm: cgms[i] }))
  const soloDevices = [...pumps.slice(pairCount), ...cgms.slice(pairCount), ...otherDevices]

  return (
    <div className="space-y-10" aria-busy={loading}>
      <BackButton />
      <section className="flex justify-between items-end gap-4">
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('devices.kicker')}</h2>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{t('devices.title')}</h1>
          <p className="text-muted mt-2 max-w-xl">
            {t('devices.intro')}
          </p>
        </div>
        {!needsSetup && (
          <Button onClick={() => setShowAdd(true)} className="shrink-0">
            <Plus className="w-5 h-5" />
            {t('devices.addDevice')}
          </Button>
        )}
      </section>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}

      {/* DB not set up yet → honest prompt, no crash */}
      {!loading && needsSetup && (
        <div className="bg-surface border border-line rounded-2xl p-8 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center mx-auto mb-4">
            <Database className="w-6 h-6 text-muted" />
          </div>
          <h3 className="font-semibold text-ink mb-2">{t('common.setupStepTitle')}</h3>
          <p className="text-muted text-sm leading-relaxed">
            {t('devices.migrationBody')}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !needsSetup && devices.length === 0 && (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Cpu className="w-7 h-7 text-primary" />
          </div>
          <p className="text-muted font-medium">{t('devices.emptyTitle')}</p>
          <Button onClick={() => setShowAdd(true)} className="mx-auto">
            <Plus className="w-4 h-4" />
            {t('devices.addFirst')}
          </Button>
        </div>
      )}

      {/* Device list — paired pump + CGM shown together as a "system" */}
      {!loading && !needsSetup && devices.length > 0 && (
        <div className="space-y-6">
          {systems.map(({ pump, cgm }) => (
            <div
              key={`system-${pump.id}-${cgm.id}`}
              className="rounded-[28px] border border-primary/20 bg-primary/[0.04] p-3 sm:p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
                <Link2 className="w-4 h-4" />
                {t('devices.yourSystem')}
              </div>
              <div className="space-y-2">
                <DeviceCard
                  device={pump}
                  supplies={linkedTo(pump.id)}
                  bufferDays={safetyBufferDays}
                  onDelete={handleDelete}
                />
                {/* Connector — visual "these are used together", not a data claim */}
                <div className="flex items-center gap-2 px-4" aria-hidden="true">
                  <span className="h-px flex-1 bg-primary/15" />
                  <Link2 className="w-3.5 h-3.5 text-primary/50" />
                  <span className="h-px flex-1 bg-primary/15" />
                </div>
                <DeviceCard
                  device={cgm}
                  supplies={linkedTo(cgm.id)}
                  bufferDays={safetyBufferDays}
                  onDelete={handleDelete}
                />
              </div>
            </div>
          ))}

          {soloDevices.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              supplies={linkedTo(device.id)}
              bufferDays={safetyBufferDays}
              onDelete={handleDelete}
            />
          ))}

          {unlinkedCount > 0 && (
            <p className="text-sm text-faint text-center">
              {t(unlinkedCount === 1 ? 'devices.unlinkedOne' : 'devices.unlinkedOther', { count: unlinkedCount })}
            </p>
          )}
        </div>
      )}

      {/* CareLink import — always visible once devices are set up */}
      {!needsSetup && (
        <CareLinkImportSection inventory={inventory} onApplied={load} />
      )}

      {showAdd && userId && (
        <AddDeviceModal
          userId={userId}
          onClose={() => setShowAdd(false)}
          onAdded={(d) => { setDevices(prev => [...prev, d]); setShowAdd(false); showToast(t('common.toastAdded', { name: deviceLabel(d) }), 'success') }}
        />
      )}
    </div>
  )
}

/** One device card: identity header, delete, and its linked consumables. Used
 *  standalone and inside a "system" grouping (paired pump + CGM). */
function DeviceCard({
  device,
  supplies,
  bufferDays,
  onDelete,
}: {
  device: MedicalDevice
  supplies: Product[]
  bufferDays: number
  onDelete: (id: string) => void
}) {
  const { t } = useI18n()
  const Icon = KIND_ICON[device.kind]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface border border-line rounded-3xl p-6 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-ink leading-tight">{deviceLabel(device)}</h3>
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mt-1">
              {t(DEVICE_KIND_KEY[device.kind])}
              {device.brand ? ` · ${device.brand}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => onDelete(device.id)}
          aria-label={t('common.removeAria', { name: deviceLabel(device) })}
          className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-faint hover:text-urgent hover:bg-urgent-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Linked consumables */}
      <div className="mt-5 border-t border-line pt-4">
        {supplies.length === 0 ? (
          <p className="text-sm text-faint">
            {t('devices.noSuppliesLinked')}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {supplies.map(s => (
              <ConsumableRow key={s.id} product={s} bufferDays={bufferDays} />
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  )
}

/** One linked consumable: name, runway (honest), status, reorder hand-off. */
function ConsumableRow({ product, bufferDays }: { product: Product; bufferDays: number }) {
  const { t } = useI18n()
  // displayStatus: an unknown rate renders neutral, never an alarm on a guess.
  const status = displayStatus(product, bufferDays)
  const estimated = isRateEstimated(product.usageRatePerDay)
  const reorder = reorderTargetFor(product)
  const tone =
    status === 'out' ? 'urgent' : status === 'low' ? 'caution' : status === 'unset' ? 'neutral' : 'success'
  const label =
    status === 'out' ? t('devices.statusOutShort') : status === 'low' ? t('row.reorderSoon') : status === 'unset' ? t('row.unsetLabel') : t('row.wellStocked')

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink text-sm truncate">{product.name}</p>
        <p className="text-xs text-muted">
          {status === 'unset'
            ? t('product.summaryUnset', { quantity: product.quantity })
            : t('devices.onHandDays', { quantity: product.quantity, days: `${estimated ? '~' : ''}${product.remainingDays}` })}
        </p>
      </div>
      <Badge tone={tone}>{label}</Badge>
      <a
        href={reorder.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('common.reorderAria', { name: product.name })}
        className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-faint hover:text-primary hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        title={reorder.isDirect ? t('common.reorderVia', { label: reorder.label }) : t('common.findSupplier')}
      >
        <ShoppingCart className="w-4 h-4" />
      </a>
    </li>
  )
}

// ── CareLink Import ───────────────────────────────────────────────────────────

/**
 * "Connect Medtronic" card — honest about the lack of a live sync API, offers
 * CSV import instead. Parsed client-side; user reviews before anything is saved.
 */
function CareLinkImportSection({
  inventory,
  onApplied,
}: {
  inventory: Product[]
  onApplied: () => void
}) {
  const { updateProduct } = useStore()
  const { showToast } = useToast()
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)

  const [summary, setSummary] = useState<CareLinkSummary | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  // Per-kind: which supply ID the user has mapped this event kind to ('' = skip)
  const [mappings, setMappings] = useState<Partial<Record<CareLinkEventKind, string>>>({})

  const autoMatch = (kind: CareLinkEventKind): string => {
    const kw = KIND_SUPPLY_KEYWORDS[kind]
    const match = inventory.find(p =>
      kw.some(k =>
        p.name.toLowerCase().includes(k) || (p.brand ?? '').toLowerCase().includes(k)
      )
    )
    return match?.id ?? ''
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSummary(null)
    setParseError(null)
    setApplied(false)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = parseCareLink(text)
      if (result.format === 'unknown') {
        setParseError(t('carelink.notCsv'))
        return
      }
      if (result.recognized.length === 0) {
        setParseError(t('carelink.noEvents', { rows: result.dataRows }))
        return
      }
      // Auto-match supply picker defaults
      const initial: Partial<Record<CareLinkEventKind, string>> = {}
      for (const k of result.recognized) {
        initial[k.kind] = autoMatch(k.kind)
      }
      setMappings(initial)
      setSummary(result)
    }
    reader.onerror = () => setParseError(t('carelink.readError'))
    reader.readAsText(file)

    // Reset the input so the same file can be re-selected after a discard
    e.target.value = ''
  }

  const handleApply = async () => {
    if (!summary) return
    setApplying(true)
    let applied = 0
    let failed = 0

    for (const kindSummary of summary.recognized) {
      const supplyId = mappings[kindSummary.kind]
      if (!supplyId) continue // user chose "Skip"

      const product = inventory.find(p => p.id === supplyId)
      if (!product) continue

      const next = Math.max(0, product.quantity - kindSummary.count)
      try {
        await updateProduct(supplyId, { quantity: next })
        applied++
      } catch (err) {
        // Keep going: one failed write shouldn't abandon the rest of the import,
        // but it must be counted and reported, never claimed as applied.
        console.error(`CareLink apply failed for ${product.name}:`, err)
        failed++
      }
    }

    setApplying(false)
    setSummary(null)
    setApplied(applied > 0)
    onApplied()

    if (failed > 0) {
      showToast(t('carelink.appliedPartial', { applied, total: applied + failed, failed }), 'caution')
    } else if (applied > 0) {
      showToast(t(applied === 1 ? 'carelink.appliedSuccessOne' : 'carelink.appliedSuccessOther', { count: applied }), 'success')
    } else {
      showToast(t('carelink.appliedNone'), 'info')
    }
  }

  const handleDiscard = () => {
    setSummary(null)
    setParseError(null)
    setApplied(false)
  }

  return (
    <section className="bg-surface border border-line rounded-3xl p-6 shadow-sm space-y-5">
      {/* Card header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Cpu className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-ink">{t('carelink.title')}</h3>
          <p className="text-sm text-muted mt-0.5 leading-relaxed">
            {t('carelink.intro')}
          </p>
        </div>
      </div>

      {/* Honest note */}
      <div className="flex gap-2.5 rounded-2xl bg-surface-2 border border-line p-3.5 text-xs text-muted leading-relaxed">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-faint" />
        <p>
          {t('carelink.howToExport')}
        </p>
      </div>

      {/* Success state */}
      {applied && !summary && (
        <div className="flex items-center gap-3 rounded-2xl bg-success-soft border border-success/20 p-4 text-sm text-success font-semibold">
          <CheckCircle className="w-5 h-5 shrink-0" />
          {t('carelink.appliedSuccess')}
          <button
            onClick={() => setApplied(false)}
            className="ml-auto text-xs underline text-success/70 hover:text-success"
          >
            {t('carelink.importAnother')}
          </button>
        </div>
      )}

      {/* File picker (hidden when a summary is showing) */}
      {!summary && !applied && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="sr-only"
            aria-label={t('carelink.chooseFile')}
            id="carelink-file-input"
          />
          <label
            htmlFor="carelink-file-input"
            className="inline-flex items-center gap-2 cursor-pointer bg-surface border border-line hover:border-primary/40 hover:bg-primary/5 text-ink font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors focus-within:ring-2 focus-within:ring-primary"
          >
            <Upload className="w-4 h-4" />
            {t('carelink.chooseFile')}
          </label>
          {parseError && (
            <div className="mt-3 flex gap-2.5 rounded-2xl bg-caution-soft border border-caution/20 p-3.5 text-xs text-caution leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{parseError}</p>
            </div>
          )}
        </div>
      )}

      {/* Review table */}
      {summary && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink">
            {t('carelink.reviewNotice')}
          </p>

          <div className="rounded-2xl border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 border-b border-line">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider">{t('carelink.colEvent')}</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider">{t('carelink.colCount')}</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider">{t('carelink.colDateRange')}</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted text-xs uppercase tracking-wider">{t('carelink.colApplyTo')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summary.recognized.map(k => {
                  const selectedId = mappings[k.kind] ?? ''
                  const selectedProduct = inventory.find(p => p.id === selectedId)
                  const nextQty = selectedProduct
                    ? Math.max(0, selectedProduct.quantity - k.count)
                    : null

                  return (
                    <tr key={k.kind}>
                      <td className="px-4 py-3 font-semibold text-ink">
                        {t(EVENT_KIND_KEY[k.kind])}
                      </td>
                      <td className="px-4 py-3 text-muted tabular-nums">
                        {k.count}
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {k.firstDate === k.lastDate
                          ? formatShortDate(k.firstDate)
                          : `${formatShortDate(k.firstDate)} – ${formatShortDate(k.lastDate)}`}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={selectedId}
                          onChange={e => setMappings(prev => ({ ...prev, [k.kind]: e.target.value }))}
                          className="w-full max-w-[200px] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-ink text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`${t('carelink.colApplyTo')}: ${t(EVENT_KIND_KEY[k.kind])}`}
                        >
                          <option value="">— {t('carelink.skip')} —</option>
                          {inventory.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({t('common.onHand', { quantity: p.quantity })})
                            </option>
                          ))}
                        </select>
                        {nextQty !== null && (
                          <p className="text-xs text-muted mt-1">
                            {selectedProduct!.quantity} → <strong className="text-ink">{nextQty}</strong>
                          </p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-faint">
            {t(summary.skippedRows === 1 ? 'carelink.rowsSkippedOne' : 'carelink.rowsSkippedOther', { count: summary.skippedRows })}
          </p>

          <div className="flex gap-3">
            <Button onClick={handleApply} disabled={applying}>
              {applying && <Loader2 className="w-4 h-4 animate-spin" />}
              {applying ? t('carelink.applying') : t('carelink.applyChanges')}
            </Button>
            <Button variant="ghost" onClick={handleDiscard} disabled={applying}>
              {t('carelink.discard')}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

/** Add-device dialog: tap a preset or enter a custom brand/model. */
function AddDeviceModal({
  userId, onClose, onAdded,
}: {
  userId: string
  onClose: () => void
  onAdded: (d: MedicalDevice) => void
}) {
  const { t } = useI18n()
  const supabase = createClient()
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [kind, setKind] = useState<DeviceKind>('pump')
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyPreset = (p: typeof DEVICE_PRESETS[number]) => {
    setBrand(p.brand); setModel(p.model); setKind(p.kind)
  }

  const handleSave = async () => {
    if (!brand.trim()) { setError(t('deviceModal.errBrand')); return }
    setSaving(true); setError(null)
    const { data, error } = await supabase
      .from('medical_devices')
      .insert({ user_id: userId, ...deviceToRow({ brand, model, kind, nickname }) })
      .select()
      .single()
    setSaving(false)
    if (error || !data) { setError(error?.message || t('deviceModal.errGeneric')); return }
    onAdded(rowToDevice(data as MedicalDeviceRow))
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-device-title"
        className="relative w-full max-w-md bg-surface border border-line rounded-3xl p-7 shadow-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between mb-5">
          <h2 id="add-device-title" className="text-xl font-bold text-ink">{t('deviceModal.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">{t('deviceModal.quickAdd')}</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {DEVICE_PRESETS.map(p => (
            <button
              key={`${p.brand}-${p.model}`}
              onClick={() => applyPreset(p)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                brand === p.brand && model === p.model
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface-2 text-ink border-line hover:border-primary/40'
              }`}
            >
              {p.brand} {p.model}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="dev-brand" className="block text-[11px] font-medium text-muted mb-1.5">{t('deviceModal.brand')}</label>
              <input
                id="dev-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={t('deviceModal.brandPlaceholder')}
                className="w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
            <div>
              <label htmlFor="dev-model" className="block text-[11px] font-medium text-muted mb-1.5">{t('deviceModal.model')}</label>
              <input
                id="dev-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t('deviceModal.modelPlaceholder')}
                className="w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
          </div>
          <div>
            <label htmlFor="dev-kind" className="block text-[11px] font-medium text-muted mb-1.5">{t('apptModal.type')}</label>
            <select
              id="dev-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as DeviceKind)}
              className="w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
            >
              {(Object.keys(DEVICE_KIND_KEY) as DeviceKind[]).map(k => (
                <option key={k} value={k}>{t(DEVICE_KIND_KEY[k])}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dev-nickname" className="block text-[11px] font-medium text-muted mb-1.5">{t('deviceModal.nickname')}</label>
            <input
              id="dev-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('deviceModal.nicknamePlaceholder')}
              className="w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-urgent flex items-center gap-2">
            <Package className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}

        <div className="mt-7 flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('devices.addDevice')}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        </div>
      </motion.div>
    </div>
  )
}

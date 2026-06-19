'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Cpu, Plus, Activity, Zap, Pen, TestTube2, ShoppingCart,
  Loader2, X, Trash2, Database, Package,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useStore, type Product } from '@/lib/store'
import {
  type MedicalDevice, type MedicalDeviceRow, type DeviceKind,
  rowToDevice, deviceToRow, deviceLabel, DEVICE_PRESETS, DEVICE_KIND_LABEL,
} from '@/lib/devices'
import { isMissingTableError } from '@/lib/prescriptions'
import { stockStatus, isRateEstimated, DEFAULT_SAFETY_BUFFER_DAYS } from '@/lib/depletion'
import { reorderTargetFor } from '@/lib/suppliers'
import { useDialog } from '@/lib/useDialog'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const KIND_ICON: Record<DeviceKind, LucideIcon> = {
  pump: Zap,
  cgm: Activity,
  pen: Pen,
  meter: TestTube2,
}

export default function DevicesPage() {
  const { safetyBufferDays } = useStore()
  const { showToast } = useToast()
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

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('medical_devices').delete().eq('id', id)
    if (error) { showToast('Could not remove device.', 'caution'); return }
    setDevices(prev => prev.filter(d => d.id !== id))
    showToast('Device removed. Its supplies were kept.', 'success')
  }

  const linkedTo = (deviceId: string) => inventory.filter(p => p.deviceId === deviceId)
  const unlinkedCount = inventory.filter(p => !p.deviceId).length

  return (
    <div className="space-y-10" aria-busy={loading}>
      <section className="flex justify-between items-end gap-4">
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Your devices</h2>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Pumps &amp; CGMs</h1>
          <p className="text-muted mt-2 max-w-xl">
            Group a device with the supplies it uses — reservoirs, sensors, infusion sets — to see
            them, and their runway, in one place.
          </p>
        </div>
        {!needsSetup && (
          <Button onClick={() => setShowAdd(true)} className="shrink-0">
            <Plus className="w-5 h-5" />
            Add device
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
          <h3 className="font-semibold text-ink mb-2">One quick database step</h3>
          <p className="text-muted text-sm leading-relaxed">
            Devices need a small table that isn&apos;t in your database yet. Open Supabase → SQL
            Editor, run <span className="font-mono text-xs bg-surface-2 px-1.5 py-0.5 rounded">supabase/setup.sql</span> once
            (it&apos;s safe to re-run), then refresh this page.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !needsSetup && devices.length === 0 && (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Cpu className="w-7 h-7 text-primary" />
          </div>
          <p className="text-muted font-medium">No devices added yet</p>
          <Button onClick={() => setShowAdd(true)} className="mx-auto">
            <Plus className="w-4 h-4" />
            Add your first device
          </Button>
        </div>
      )}

      {/* Device list */}
      {!loading && !needsSetup && devices.length > 0 && (
        <div className="space-y-6">
          {devices.map(device => {
            const Icon = KIND_ICON[device.kind]
            const supplies = linkedTo(device.id)
            return (
              <motion.div
                key={device.id}
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
                        {DEVICE_KIND_LABEL[device.kind]}
                        {device.brand ? ` · ${device.brand}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(device.id)}
                    aria-label={`Remove ${deviceLabel(device)}`}
                    className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-faint hover:text-urgent hover:bg-urgent-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Linked consumables */}
                <div className="mt-5 border-t border-line pt-4">
                  {supplies.length === 0 ? (
                    <p className="text-sm text-faint">
                      No supplies linked yet. Open a supply on the dashboard, tap Edit, and choose
                      this device.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {supplies.map(s => (
                        <ConsumableRow key={s.id} product={s} bufferDays={safetyBufferDays} />
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            )
          })}

          {unlinkedCount > 0 && (
            <p className="text-sm text-faint text-center">
              {unlinkedCount} supply{unlinkedCount === 1 ? '' : ' items'} not linked to a device.
              Link them from each supply&apos;s Edit screen on the{' '}
              <Link href="/dashboard" className="text-primary hover:underline">dashboard</Link>.
            </p>
          )}
        </div>
      )}

      {showAdd && userId && (
        <AddDeviceModal
          userId={userId}
          onClose={() => setShowAdd(false)}
          onAdded={(d) => { setDevices(prev => [...prev, d]); setShowAdd(false); showToast(`Added ${deviceLabel(d)}.`, 'success') }}
        />
      )}
    </div>
  )
}

/** One linked consumable: name, runway (honest), status, reorder hand-off. */
function ConsumableRow({ product, bufferDays }: { product: Product; bufferDays: number }) {
  const status = stockStatus(product.remainingDays, bufferDays)
  const estimated = isRateEstimated(product.usageRatePerDay)
  const reorder = reorderTargetFor(product)
  const tone = status === 'out' ? 'urgent' : status === 'low' ? 'caution' : 'success'
  const label = status === 'out' ? 'Out' : status === 'low' ? 'Reorder soon' : 'Well stocked'

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink text-sm truncate">{product.name}</p>
        <p className="text-xs text-muted">
          {product.quantity} on hand · {estimated ? '~' : ''}{product.remainingDays} days left
        </p>
      </div>
      <Badge tone={tone}>{label}</Badge>
      <a
        href={reorder.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Reorder ${product.name}`}
        className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-faint hover:text-primary hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        title={reorder.isDirect ? `Reorder via ${reorder.label}` : 'Find a supplier'}
      >
        <ShoppingCart className="w-4 h-4" />
      </a>
    </li>
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
    if (!brand.trim()) { setError('Please choose a preset or enter a brand.'); return }
    setSaving(true); setError(null)
    const { data, error } = await supabase
      .from('medical_devices')
      .insert({ user_id: userId, ...deviceToRow({ brand, model, kind, nickname }) })
      .select()
      .single()
    setSaving(false)
    if (error || !data) { setError(error?.message || 'Could not save device.'); return }
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
          <h2 id="add-device-title" className="text-xl font-bold text-ink">Add a device</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">Quick add</p>
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
              <label htmlFor="dev-brand" className="block text-[11px] font-medium text-muted mb-1.5">Brand</label>
              <input
                id="dev-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Medtronic"
                className="w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
            <div>
              <label htmlFor="dev-model" className="block text-[11px] font-medium text-muted mb-1.5">Model</label>
              <input
                id="dev-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="MiniMed 780G"
                className="w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
              />
            </div>
          </div>
          <div>
            <label htmlFor="dev-kind" className="block text-[11px] font-medium text-muted mb-1.5">Type</label>
            <select
              id="dev-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as DeviceKind)}
              className="w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
            >
              {(Object.keys(DEVICE_KIND_LABEL) as DeviceKind[]).map(k => (
                <option key={k} value={k}>{DEVICE_KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dev-nickname" className="block text-[11px] font-medium text-muted mb-1.5">Nickname (optional)</label>
            <input
              id="dev-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Emma's pump"
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
            Add device
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </motion.div>
    </div>
  )
}

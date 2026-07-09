'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Pill, Plus, Pencil, Trash2, Database, CalendarClock, RefreshCw, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { BackButton } from '@/components/ui/BackButton'
import { PrescriptionModal } from '@/components/prescriptions/PrescriptionModal'
import { isRateEstimated } from '@/lib/depletion'
import { useI18n } from '@/lib/i18n'
import type { TKey } from '@/lib/i18n/dictionaries'
import type { Product } from '@/lib/store'
import {
  type Prescription,
  rowToPrescription,
  prescriptionToRow,
  isMissingTableError,
  renewalStatus,
  type RenewalStatus,
} from '@/lib/prescriptions'

const STATUS_STYLE: Record<RenewalStatus, { labelKey: TKey; cls: string }> = {
  ok: { labelKey: 'prescriptions.statusActive', cls: 'bg-success-soft text-success border-success/20' },
  'due-soon': { labelKey: 'prescriptions.statusRenewSoon', cls: 'bg-caution-soft text-caution border-caution/20' },
  'needs-renewal': { labelKey: 'prescriptions.statusNeedsRenewal', cls: 'bg-urgent-soft text-urgent border-urgent/20' },
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PrescriptionsPage() {
  // Memoize: createBrowserClient returns a fresh client each call, and `supabase`
  // is a dependency of the load callback — a new client every render would loop.
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()
  const confirm = useConfirm()
  const { t } = useI18n()

  const [items, setItems] = useState<Prescription[]>([])
  const [supplies, setSupplies] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Prescription | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('prescriptions')
      .select('*')
      .order('created_at', { ascending: false })

    if (qErr) {
      if (isMissingTableError(qErr)) {
        setNeedsMigration(true)
      } else {
        setError(qErr.message)
      }
      setLoading(false)
      return
    }
    setNeedsMigration(false)
    setItems((data ?? []).map(rowToPrescription))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // Standard fetch-on-mount; goes away once this page migrates to TanStack
    // Query (already done for Home/Supplies/Reorder/Calendar).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    // Linked supplies (best-effort): lets each prescription show what it covers
    // and how long that stock lasts. A failure just hides the section.
    fetch('/api/inventory')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => setSupplies(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
  }, [load])

  const handleSave = async (values: Partial<Prescription>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) throw new Error(t('common.signedOutError'))

    if (editing) {
      const { error: uErr } = await supabase
        .from('prescriptions')
        .update(prescriptionToRow(values))
        .eq('id', editing.id)
      if (uErr) throw new Error(uErr.message)
      showToast(t('common.toastUpdated', { name: values.medicationName ?? '' }), 'success')
    } else {
      const { error: iErr } = await supabase
        .from('prescriptions')
        .insert({ ...prescriptionToRow(values), user_id: user.id })
      if (iErr) throw new Error(iErr.message)
      showToast(t('common.toastAdded', { name: values.medicationName ?? '' }), 'success')
    }
    await load()
  }

  const handleDelete = async (rx: Prescription) => {
    const ok = await confirm({
      title: t('confirm.deleteTitle', { name: rx.medicationName }),
      body: t('confirm.deleteRxBody', { name: rx.medicationName }),
      confirmLabel: t('confirm.deleteBtn'),
      tone: 'danger',
    })
    if (!ok) return
    const { error: dErr } = await supabase.from('prescriptions').delete().eq('id', rx.id)
    if (dErr) {
      showToast(t('common.toastDeleteFail', { error: dErr.message }), 'caution')
      return
    }
    setItems((prev) => prev.filter((p) => p.id !== rx.id))
    showToast(t('common.toastRemoved', { name: rx.medicationName }), 'info')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <BackButton />
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('nav.prescriptions')}</h2>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{t('prescriptions.title')}</h1>
        </div>
        {!needsMigration && (
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="bg-primary hover:bg-primary-deep text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            <Plus className="w-5 h-5" />
            {t('nav.add')}
          </button>
        )}
      </header>

      {/* Migration needed */}
      {needsMigration && (
        <div className="bg-surface border border-line rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Database className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-ink">{t('common.setupStepTitle')}</h3>
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            {t('prescriptions.migrationBody')}
          </p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 bg-surface-2 hover:bg-line text-ink px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> {t('common.reload')}
          </button>
        </div>
      )}

      {loading && !needsMigration && (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center animate-pulse">
          <div className="h-4 bg-surface-2 rounded w-40 mx-auto" />
        </div>
      )}

      {error && !needsMigration && (
        <div className="bg-urgent-soft border border-urgent/30 rounded-2xl p-6">
          <p className="text-urgent font-semibold">{t('prescriptions.errorTitle')}</p>
          <p className="text-urgent/80 text-sm mt-1">{error}</p>
        </div>
      )}

      {!loading && !needsMigration && !error && items.length === 0 && (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center space-y-4">
          <Pill className="w-8 h-8 text-faint mx-auto" />
          <p className="text-muted font-medium">{t('prescriptions.emptyTitle')}</p>
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-deep text-white px-5 py-3 rounded-xl font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> {t('prescriptions.emptyAdd')}
          </button>
        </div>
      )}

      {/* List */}
      {!needsMigration && items.length > 0 && (
        <div className="space-y-4">
          {items.map((rx) => {
            const status = renewalStatus(rx)
            const style = STATUS_STYLE[status]
            return (
              <div key={rx.id} className="bg-surface border border-line rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-ink truncate">{rx.medicationName}</h3>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${style.cls}`}>
                        {t(style.labelKey)}
                      </span>
                    </div>
                    {rx.dosage && <p className="text-sm text-muted mt-0.5">{rx.dosage}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditing(rx); setModalOpen(true) }}
                      aria-label={t('common.editAria', { name: rx.medicationName })}
                      className="rounded-lg p-2 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rx)}
                      aria-label={t('common.deleteAria', { name: rx.medicationName })}
                      className="rounded-lg p-2 text-faint hover:bg-urgent-soft hover:text-urgent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">{t('prescriptions.refillsLeft')}</dt>
                    <dd className="font-semibold text-ink tabular-nums">{rx.refillsRemaining ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">{t('prescriptions.expires')}</dt>
                    <dd className="font-semibold text-ink">{formatDate(rx.expirationDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">{t('prescriptions.prescriber')}</dt>
                    <dd className="font-semibold text-ink truncate">{rx.prescriber || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">{t('prescriptions.pharmacy')}</dt>
                    <dd className="font-semibold text-ink truncate">{rx.pharmacy || '—'}</dd>
                  </div>
                </dl>

                {/* What this prescription covers, with honest runway per supply.
                    Linked from each supply's Edit dialog on the Supplies page. */}
                {(() => {
                  const covered = supplies.filter((s) => s.prescriptionId === rx.id)
                  if (covered.length === 0) return null
                  return (
                    <div className="mt-3 rounded-xl bg-surface-2 border border-line p-3">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint mb-1.5">
                        <Package className="w-3.5 h-3.5" /> {t('prescriptions.covers')}
                      </p>
                      <ul className="space-y-1">
                        {covered.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium text-ink truncate">{s.name}</span>
                            <span className="text-muted text-xs shrink-0">
                              {isRateEstimated(s.usageRatePerDay)
                                ? t('common.onHand', { quantity: s.quantity })
                                : t(s.remainingDays === 1 ? 'prescriptions.aboutDaysLeftOne' : 'prescriptions.aboutDaysLeftOther', { count: s.remainingDays })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })()}

                {status !== 'ok' && (
                  <p className="mt-3 flex items-center gap-2 text-xs font-medium text-caution">
                    <CalendarClock className="w-3.5 h-3.5" />
                    {status === 'needs-renewal'
                      ? t('prescriptions.needsRenewalBody')
                      : t('prescriptions.dueSoonBody')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <PrescriptionModal
            prescription={editing}
            onClose={() => setModalOpen(false)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

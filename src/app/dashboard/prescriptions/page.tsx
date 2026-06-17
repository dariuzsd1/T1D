'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Pill, Plus, Pencil, Trash2, Database, CalendarClock, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { PrescriptionModal } from '@/components/prescriptions/PrescriptionModal'
import {
  type Prescription,
  rowToPrescription,
  prescriptionToRow,
  isMissingTableError,
  renewalStatus,
  type RenewalStatus,
} from '@/lib/prescriptions'

const STATUS_STYLE: Record<RenewalStatus, { label: string; cls: string }> = {
  ok: { label: 'Active', cls: 'bg-success-soft text-success border-success/20' },
  'due-soon': { label: 'Renew soon', cls: 'bg-caution-soft text-caution border-caution/20' },
  'needs-renewal': { label: 'Needs renewal', cls: 'bg-urgent-soft text-urgent border-urgent/20' },
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

  const [items, setItems] = useState<Prescription[]>([])
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
    load()
  }, [load])

  const handleSave = async (values: Partial<Prescription>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) throw new Error('You are signed out. Please sign in again.')

    if (editing) {
      const { error: uErr } = await supabase
        .from('prescriptions')
        .update(prescriptionToRow(values))
        .eq('id', editing.id)
      if (uErr) throw new Error(uErr.message)
      showToast(`Updated ${values.medicationName}.`, 'success')
    } else {
      const { error: iErr } = await supabase
        .from('prescriptions')
        .insert({ ...prescriptionToRow(values), user_id: user.id })
      if (iErr) throw new Error(iErr.message)
      showToast(`Added ${values.medicationName}.`, 'success')
    }
    await load()
  }

  const handleDelete = async (rx: Prescription) => {
    const { error: dErr } = await supabase.from('prescriptions').delete().eq('id', rx.id)
    if (dErr) {
      showToast(`Could not delete: ${dErr.message}`, 'caution')
      return
    }
    setItems((prev) => prev.filter((p) => p.id !== rx.id))
    showToast(`Removed ${rx.medicationName}.`, 'info')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Prescriptions</h2>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Your prescriptions</h1>
        </div>
        {!needsMigration && (
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="bg-primary hover:bg-primary-deep text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        )}
      </header>

      {/* Migration needed */}
      {needsMigration && (
        <div className="bg-surface border border-line rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Database className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-ink">One quick setup step</h3>
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            Prescriptions are stored in their own secure table. It hasn&apos;t been
            created in your database yet. Run the short SQL in{' '}
            <span className="font-semibold text-ink">docs/PRESCRIPTIONS_CAREGIVERS_MIGRATION.md</span>{' '}
            (a 2-minute copy-paste in your Supabase dashboard), then reload this page.
          </p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 bg-surface-2 hover:bg-line text-ink px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> I&apos;ve run it — reload
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
          <p className="text-urgent font-semibold">Couldn&apos;t load prescriptions</p>
          <p className="text-urgent/80 text-sm mt-1">{error}</p>
        </div>
      )}

      {!loading && !needsMigration && !error && items.length === 0 && (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center space-y-4">
          <Pill className="w-8 h-8 text-faint mx-auto" />
          <p className="text-muted font-medium">No prescriptions yet</p>
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-deep text-white px-5 py-3 rounded-xl font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Add your first prescription
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
                        {style.label}
                      </span>
                    </div>
                    {rx.dosage && <p className="text-sm text-muted mt-0.5">{rx.dosage}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditing(rx); setModalOpen(true) }}
                      aria-label={`Edit ${rx.medicationName}`}
                      className="rounded-lg p-2 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rx)}
                      aria-label={`Delete ${rx.medicationName}`}
                      className="rounded-lg p-2 text-faint hover:bg-urgent-soft hover:text-urgent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">Refills left</dt>
                    <dd className="font-semibold text-ink tabular-nums">{rx.refillsRemaining ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">Expires</dt>
                    <dd className="font-semibold text-ink">{formatDate(rx.expirationDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">Prescriber</dt>
                    <dd className="font-semibold text-ink truncate">{rx.prescriber || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">Pharmacy</dt>
                    <dd className="font-semibold text-ink truncate">{rx.pharmacy || '—'}</dd>
                  </div>
                </dl>

                {status !== 'ok' && (
                  <p className="mt-3 flex items-center gap-2 text-xs font-medium text-caution">
                    <CalendarClock className="w-3.5 h-3.5" />
                    {status === 'needs-renewal'
                      ? 'No refills left or past its expiration — ask your prescriber for a renewal.'
                      : 'Coming up for renewal soon — plan ahead so you don’t run short.'}
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

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Stethoscope, Plus, Pencil, Trash2, Database, RefreshCw, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { BackButton } from '@/components/ui/BackButton'
import { AppointmentModal } from '@/components/appointments/AppointmentModal'
import {
  type Appointment,
  type AppointmentTiming,
  rowToAppointment,
  appointmentToRow,
  appointmentTypeLabel,
  appointmentTiming,
  isMissingTableError,
} from '@/lib/appointments'

const TIMING_STYLE: Record<AppointmentTiming, { label: string; cls: string }> = {
  upcoming: { label: 'Upcoming', cls: 'bg-success-soft text-success border-success/20' },
  soon: { label: 'Soon', cls: 'bg-caution-soft text-caution border-caution/20' },
  past: { label: 'Past', cls: 'bg-surface-2 text-faint border-line' },
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AppointmentsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()

  const [items, setItems] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: true })

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
    setItems((data ?? []).map(rowToAppointment))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (values: Partial<Appointment>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) throw new Error('You are signed out. Please sign in again.')

    if (editing) {
      const { error: uErr } = await supabase
        .from('appointments')
        .update(appointmentToRow(values))
        .eq('id', editing.id)
      if (uErr) throw new Error(uErr.message)
      showToast(`Updated ${values.title}.`, 'success')
    } else {
      const { error: iErr } = await supabase
        .from('appointments')
        .insert({ ...appointmentToRow(values), user_id: user.id })
      if (iErr) throw new Error(iErr.message)
      showToast(`Added ${values.title}.`, 'success')
    }
    await load()
  }

  const handleDelete = async (appt: Appointment) => {
    const { error: dErr } = await supabase.from('appointments').delete().eq('id', appt.id)
    if (dErr) {
      showToast(`Could not delete: ${dErr.message}`, 'caution')
      return
    }
    setItems((prev) => prev.filter((a) => a.id !== appt.id))
    showToast(`Removed ${appt.title}.`, 'info')
  }

  // Upcoming (incl. soon) first, ascending; then past, most-recent first.
  const now = new Date()
  const upcoming = items
    .filter((a) => appointmentTiming(a.appointmentDate, 7, now) !== 'past')
  const past = items
    .filter((a) => appointmentTiming(a.appointmentDate, 7, now) === 'past')
    .reverse()
  const ordered = [...upcoming, ...past]

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <BackButton />
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Appointments</h2>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Your visits</h1>
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
            Appointments are stored in their own secure table. It hasn&apos;t been
            created in your database yet. Run{' '}
            <span className="font-semibold text-ink">supabase/setup.sql</span>{' '}
            in your Supabase SQL editor (see{' '}
            <span className="font-semibold text-ink">docs/DATABASE_SETUP.md</span>), then reload.
          </p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 bg-surface-2 hover:bg-line text-ink px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> I&apos;ve run it, reload
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
          <p className="text-urgent font-semibold">Couldn&apos;t load appointments</p>
          <p className="text-urgent/80 text-sm mt-1">{error}</p>
        </div>
      )}

      {!loading && !needsMigration && !error && items.length === 0 && (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center space-y-4">
          <Stethoscope className="w-8 h-8 text-faint mx-auto" />
          <p className="text-muted font-medium">No appointments yet</p>
          <button
            onClick={() => { setEditing(null); setModalOpen(true) }}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-deep text-white px-5 py-3 rounded-xl font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Add your first appointment
          </button>
        </div>
      )}

      {/* List */}
      {!needsMigration && ordered.length > 0 && (
        <div className="space-y-4">
          {ordered.map((appt) => {
            const timing = appointmentTiming(appt.appointmentDate, 7, now)
            const style = TIMING_STYLE[timing]
            return (
              <div
                key={appt.id}
                className={`bg-surface border border-line rounded-2xl p-5 shadow-sm ${timing === 'past' ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-ink truncate">{appt.title}</h3>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${style.cls}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted mt-0.5">{appointmentTypeLabel(appt.appointmentType)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditing(appt); setModalOpen(true) }}
                      aria-label={`Edit ${appt.title}`}
                      className="rounded-lg p-2 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(appt)}
                      aria-label={`Delete ${appt.title}`}
                      className="rounded-lg p-2 text-faint hover:bg-urgent-soft hover:text-urgent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 flex items-center gap-2 text-sm font-medium text-ink">
                  <Clock className="w-4 h-4 text-faint shrink-0" />
                  {formatWhen(appt.appointmentDate)}
                  <span className="text-faint font-normal">
                    · {formatDistanceToNow(new Date(appt.appointmentDate), { addSuffix: true })}
                  </span>
                </p>

                {appt.notes && (
                  <p className="mt-2 text-sm text-muted whitespace-pre-line">{appt.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <AppointmentModal
            appointment={editing}
            onClose={() => setModalOpen(false)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

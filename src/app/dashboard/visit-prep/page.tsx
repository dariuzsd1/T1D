'use client'

import { useEffect, useMemo, useState } from 'react'
import { Printer, Stethoscope, Package, Pill, Cpu, CalendarClock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useStore, type Product } from '@/lib/store'
import { useProfile } from '@/components/profile/ProfileProvider'
import { displayStatus, DEFAULT_SAFETY_BUFFER_DAYS, isRateEstimated } from '@/lib/depletion'
import { rowToPrescription, renewalStatus, type Prescription, type RenewalStatus } from '@/lib/prescriptions'
import { rowToDevice, deviceLabel, DEVICE_KIND_LABEL, type MedicalDevice, type MedicalDeviceRow } from '@/lib/devices'
import { rowToAppointment, appointmentTiming, type Appointment } from '@/lib/appointments'
import { userLabel } from '@/lib/profile'
import { BackButton } from '@/components/ui/BackButton'

/**
 * Visit prep — a printable one-page summary a patient brings to their endo:
 * current supplies (with honest runway), prescriptions (with renewal status),
 * and devices. Everything is real stored data; nothing is fabricated. The page
 * chrome (nav, FAB, buttons) is hidden on print via `print:hidden`, so
 * "Print / Save as PDF" produces a clean handout.
 */
export default function VisitPrepPage() {
  const supabase = useMemo(() => createClient(), [])
  const { profile, email } = useProfile()
  const { safetyBufferDays } = useStore()

  const [supplies, setSupplies] = useState<Product[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [devices, setDevices] = useState<MedicalDevice[]>([])
  const [nextAppt, setNextAppt] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // Each source is best-effort and table-missing-safe: a section simply
      // stays empty (and hides) if its data can't be read.
      const [invRes, rxRes, devRes, apptRes] = await Promise.all([
        fetch('/api/inventory').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
        supabase.from('prescriptions').select('*').order('created_at', { ascending: false }),
        supabase.from('medical_devices').select('*').order('created_at', { ascending: true }),
        supabase.from('appointments').select('*').order('appointment_date', { ascending: true }),
      ])
      if (cancelled) return
      setSupplies(Array.isArray(invRes.data) ? invRes.data : [])
      if (!rxRes.error && rxRes.data) setPrescriptions(rxRes.data.map(rowToPrescription))
      if (!devRes.error && devRes.data) setDevices((devRes.data as MedicalDeviceRow[]).map(rowToDevice))
      if (!apptRes.error && apptRes.data) {
        const upcoming = apptRes.data
          .map(rowToAppointment)
          .find((a) => appointmentTiming(a.appointmentDate) !== 'past')
        setNextAppt(upcoming ?? null)
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [supabase])

  const today = new Date()
  const patient = userLabel(profile, email)

  // Supplies ordered most-urgent first, using the same honest status the app
  // shows everywhere (an unknown usage rate reads "usage not set", never alarm).
  const rankedSupplies = useMemo(() => {
    const rank: Record<string, number> = { out: 0, low: 1, unset: 2, ok: 3 }
    return [...supplies].sort(
      (a, b) => rank[displayStatus(a, safetyBufferDays)] - rank[displayStatus(b, safetyBufferDays)]
    )
  }, [supplies, safetyBufferDays])

  const attention = rankedSupplies.filter((p) => {
    const s = displayStatus(p, safetyBufferDays)
    return s === 'out' || s === 'low'
  }).length
  const rxNeedingRenewal = prescriptions.filter((rx) => renewalStatus(rx) !== 'ok').length

  const fmt = (v: string | null) =>
    v ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="print:hidden">
        <BackButton />
      </div>

      {/* Header + actions (actions hidden on print) */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Visit prep</h2>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Summary for your appointment</h1>
          <p className="text-muted text-sm mt-2 max-w-prose">
            A one-page snapshot of your supplies, prescriptions, and devices to bring to your endocrinologist.
            Everything here is your own entered data.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden shrink-0 inline-flex items-center gap-2 bg-primary hover:bg-primary-deep text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF
        </button>
      </header>

      {loading ? (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center animate-pulse">
          <div className="h-4 bg-surface-2 rounded w-40 mx-auto" />
        </div>
      ) : (
        <article className="bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-8 print:border-0 print:p-0 print:shadow-none">
          {/* Document header — patient + date (shows on the printout) */}
          <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-xl font-bold text-ink">{patient}</p>
              <p className="text-sm text-muted">Diabetes supply summary</p>
            </div>
            <p className="text-sm text-muted text-right">
              {today.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          {/* At-a-glance line */}
          <p className="text-sm text-muted leading-relaxed">
            {supplies.length === 0
              ? 'No supplies tracked yet.'
              : `${supplies.length} suppl${supplies.length === 1 ? 'y' : 'ies'} tracked, ${attention} needing attention. `}
            {prescriptions.length > 0 &&
              `${prescriptions.length} prescription${prescriptions.length === 1 ? '' : 's'}, ${rxNeedingRenewal} needing renewal. `}
            {nextAppt && `Next appointment ${fmt(nextAppt.appointmentDate)}.`}
          </p>

          {/* Devices */}
          {devices.length > 0 && (
            <Section icon={Cpu} title="Devices">
              <ul className="space-y-1.5">
                {devices.map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="font-semibold text-ink">{deviceLabel(d)}</span>
                    <span className="text-muted text-xs shrink-0">
                      {DEVICE_KIND_LABEL[d.kind]}{d.startedOn ? ` · since ${fmt(d.startedOn)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Supplies table */}
          <Section icon={Package} title="Supplies">
            {rankedSupplies.length === 0 ? (
              <p className="text-sm text-muted">No supplies tracked.</p>
            ) : (
              <SummaryTable head={['Supply', 'On hand', 'Days left', 'Status']}>
                {rankedSupplies.map((p) => {
                  const s = displayStatus(p, safetyBufferDays)
                  const estimated = isRateEstimated(p.usageRatePerDay)
                  return (
                    <tr key={p.id} className="border-t border-line">
                      <td className="py-2 pr-3 font-medium text-ink">{p.name}</td>
                      <td className="py-2 pr-3 tabular-nums text-muted">{p.quantity}</td>
                      <td className="py-2 pr-3 tabular-nums text-muted">
                        {s === 'unset' ? 'not set' : `${estimated ? '~' : ''}${p.remainingDays}`}
                      </td>
                      <td className="py-2 text-muted">{STATUS_WORD[s]}</td>
                    </tr>
                  )
                })}
              </SummaryTable>
            )}
          </Section>

          {/* Prescriptions table */}
          {prescriptions.length > 0 && (
            <Section icon={Pill} title="Prescriptions">
              <SummaryTable head={['Medication', 'Refills left', 'Expires', 'Renewal', 'Prescriber']}>
                {prescriptions.map((rx) => {
                  const st = renewalStatus(rx)
                  return (
                    <tr key={rx.id} className="border-t border-line">
                      <td className="py-2 pr-3 font-medium text-ink">
                        {rx.medicationName}{rx.dosage ? <span className="text-muted font-normal"> · {rx.dosage}</span> : null}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-muted">{rx.refillsRemaining ?? '—'}</td>
                      <td className="py-2 pr-3 text-muted">{fmt(rx.expirationDate)}</td>
                      <td className="py-2 pr-3 text-muted">{RENEWAL_WORD[st]}</td>
                      <td className="py-2 text-muted">{rx.prescriber || '—'}</td>
                    </tr>
                  )
                })}
              </SummaryTable>
            </Section>
          )}

          {/* Next appointment */}
          {nextAppt && (
            <Section icon={CalendarClock} title="Next appointment">
              <p className="text-sm text-ink font-medium">
                {nextAppt.title || 'Appointment'} · <span className="text-muted font-normal">{fmt(nextAppt.appointmentDate)}</span>
              </p>
            </Section>
          )}

          {/* Empty state */}
          {supplies.length === 0 && prescriptions.length === 0 && devices.length === 0 && (
            <div className="text-center py-8">
              <Stethoscope className="w-8 h-8 text-faint mx-auto mb-3" />
              <p className="text-muted">Add supplies, prescriptions, or devices to build your summary.</p>
            </div>
          )}

          <p className="text-xs text-faint leading-relaxed border-t border-line pt-4">
            Generated by T1D Supply Hub on {fmt(today.toISOString())}. Days left reflect your self-reported
            usage and stock, not a clinical measurement. This summary supports your visit; it does not replace
            medical advice.
          </p>
        </article>
      )}
    </div>
  )
}

const STATUS_WORD: Record<string, string> = {
  out: 'Out of stock',
  low: 'Reorder soon',
  unset: 'Usage not set',
  ok: 'Well stocked',
}

const RENEWAL_WORD: Record<RenewalStatus, string> = {
  ok: 'Active',
  'due-soon': 'Renew soon',
  'needs-renewal': 'Needs renewal',
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Package
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted mb-3">
        <Icon className="w-4 h-4" /> {title}
      </h3>
      {children}
    </section>
  )
}

function SummaryTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left">
            {head.map((h) => (
              <th key={h} className="pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

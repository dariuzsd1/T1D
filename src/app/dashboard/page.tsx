'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useStore } from '@/lib/store'
import { stockStatus } from '@/lib/depletion'
import { nextEligibleRefillDate } from '@/lib/refill'
import { reorderTargetFor } from '@/lib/suppliers'
import { logActivity } from '@/lib/activity'
import { createClient } from '@/lib/supabase/client'
import { buildAgenda, formatAgendaDate } from '@/lib/homeAgenda'
import { setupSteps, setupComplete } from '@/lib/setupProgress'
import { rowToAppointment, type Appointment } from '@/lib/appointments'
import { rowToPrescription, type Prescription } from '@/lib/prescriptions'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/lib/i18n'
import { useProfile } from '@/components/profile/ProfileProvider'
import { trackEvent } from '@/lib/analytics'
import { SupplyStatusRow } from '@/components/inventory/SupplyStatusRow'
import { WhatsNext } from '@/components/dashboard/WhatsNext'
import { FinishSetup } from '@/components/dashboard/FinishSetup'
import {
  Plus, CheckCircle2, AlertTriangle, ShoppingCart, Package, ChevronRight, Sparkles, RefreshCcw,
} from 'lucide-react'

export default function DashboardPage() {
  const { inventory, setInventory, safetyBufferDays, updateProduct } = useStore()
  const { showToast } = useToast()
  const { t } = useI18n()
  const { profile, loading: profileLoading } = useProfile()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [deviceCount, setDeviceCount] = useState(0)
  // Gates the setup nudge so it only appears once its data (devices) has loaded,
  // avoiding a flicker of a wrong "X of 4" count on first paint.
  const [extrasLoaded, setExtrasLoaded] = useState(false)

  // Privacy-first analytics: only fires once the profile confirms opt-in.
  useEffect(() => {
    if (profile?.analyticsOptIn) void trackEvent('opened_dashboard', true)
  }, [profile?.analyticsOptIn])

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/inventory')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const result = await response.json()
        setInventory(result.data || [])
        setError(null)
      } catch (err) {
        console.error('Failed to fetch inventory:', err)
        setError(err instanceof Error ? err.message : 'Failed to load supplies')
      } finally {
        setLoading(false)
      }
    }
    fetchInventory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load the extra dated sources for "What's Next". Both are table-missing-safe:
  // if the table doesn't exist yet (un-migrated DB) or the query errors, we simply
  // leave the list empty — the section then hides. Never fabricates a row.
  useEffect(() => {
    let cancelled = false
    const loadAgendaSources = async () => {
      const [apptRes, rxRes, devRes] = await Promise.all([
        supabase.from('appointments').select('*').order('appointment_date', { ascending: true }),
        supabase.from('prescriptions').select('*'),
        // Only the count is needed (does a pump/CGM exist?), so ask for a HEAD count.
        supabase.from('medical_devices').select('id', { count: 'exact', head: true }),
      ])
      if (cancelled) return
      if (!apptRes.error && apptRes.data) setAppointments(apptRes.data.map(rowToAppointment))
      if (!rxRes.error && rxRes.data) setPrescriptions(rxRes.data.map(rowToPrescription))
      if (!devRes.error) setDeviceCount(devRes.count ?? 0)
      setExtrasLoaded(true)
    }
    void loadAgendaSources()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // First-run onboarding gate: send a brand-new, genuinely empty account (no
  // completed onboarding, no supplies, no devices) into the flow, exactly once.
  // Guarding on real emptiness means existing users — and pre-migration accounts
  // that already have data — are never redirected; completion/skip sets the flag.
  const onboardingRedirected = useRef(false)
  useEffect(() => {
    if (onboardingRedirected.current) return
    if (loading || !extrasLoaded || profileLoading || !profile) return
    // Session fallback set by the onboarding page: covers a finish/skip made
    // before the onboarding_completed_at column exists (pre-migration), where
    // the durable flag couldn't be written. The DB flag remains the real gate.
    let doneThisSession = false
    try { doneThisSession = sessionStorage.getItem('t1d-onboarding-done') === '1' } catch { /* private mode */ }
    if (doneThisSession) return
    if (profile.onboardingCompletedAt == null && inventory.length === 0 && deviceCount === 0) {
      onboardingRedirected.current = true
      router.replace('/dashboard/onboarding')
    }
  }, [loading, extrasLoaded, profileLoading, profile, inventory.length, deviceCount, router])

  const now = useMemo(() => new Date(), [])
  const sorted = [...inventory].sort((a, b) => a.remainingDays - b.remainingDays)
  const needsAttention = sorted.filter(
    (p) => stockStatus(p.remainingDays, safetyBufferDays) !== 'ok'
  )
  const hasOut = needsAttention.some(
    (p) => stockStatus(p.remainingDays, safetyBufferDays) === 'out'
  )
  const allGood = inventory.length > 0 && needsAttention.length === 0

  // Forward-looking agenda, built from real dated data only (refill-eligible,
  // appointments, prescription renewals). Empty when nothing is dated.
  const agenda = useMemo(
    () => buildAgenda({ inventory, appointments, prescriptions, now }),
    [inventory, appointments, prescriptions, now]
  )

  // Onboarding progress, from real stored data only. The nudge shows until every
  // real step is satisfied, then disappears for good (completion is the dismissal).
  const steps = useMemo(
    () => setupSteps({ inventory, deviceCount }),
    [inventory, deviceCount]
  )
  const setupIsComplete = setupComplete(steps)

  // The single most urgent item (lowest runway) drives the actionable messaging.
  const mostUrgent = needsAttention[0] ?? null

  // The one forward-looking line under the status headline. Never invents a date:
  // it either pairs a real refill-eligible date, points at the soonest real agenda
  // item, or is null (then the hero keeps its neutral reserve message). Uses "·"
  // as the separator — no em-dashes anywhere on the page.
  const nextClause: string | null = (() => {
    if (mostUrgent) {
      const refillDate =
        mostUrgent.refillIntervalDays && mostUrgent.lastFilledDate
          ? nextEligibleRefillDate(mostUrgent.lastFilledDate, { supplyDays: mostUrgent.refillIntervalDays })
          : null
      return refillDate
        ? `Reorder ${mostUrgent.name} · refill-eligible ${formatAgendaDate(refillDate, now)}`
        : `Reorder ${mostUrgent.name} soon`
    }
    if (agenda.length > 0) {
      return `Next: ${agenda[0].label} · ${formatAgendaDate(agenda[0].date, now)}`
    }
    return null
  })()

  // Context-aware primary action. A pod is any Insulet/Omnipod consumable.
  const pod = inventory.find((p) => /insulet|omnipod|pod\b/i.test(`${p.brand} ${p.name}`)) ?? null

  const handleReorder = (label: string) =>
    showToast(
      label === 'find a supplier'
        ? t('toast.openingSearch')
        : t('toast.openingSupplier', { label }),
      'info'
    )

  const handlePodChange = async () => {
    if (!pod) return
    if (pod.quantity > 0) {
      await updateProduct(pod.id, { quantity: pod.quantity - 1 })
      void logActivity('supply_used', pod.name)
      showToast(`Logged one ${pod.name}. ${pod.quantity - 1} left.`, 'success')
    } else {
      showToast(`You're out of ${pod.name}.`, 'caution')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" aria-busy={loading}>
      <p role="status" aria-live="polite" className="sr-only">
        {loading ? 'Loading supplies…' : ''}
      </p>

      {/* Loading */}
      {loading && (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-surface-2 rounded w-40 mx-auto" />
            <div className="h-10 bg-surface-2 rounded w-28 mx-auto" />
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-urgent-soft border border-urgent/30 rounded-3xl p-6">
          <p className="text-urgent font-semibold mb-1">{t('home.errTitle')}</p>
          <p className="text-urgent/80 text-sm">{error}</p>
        </div>
      )}

      {/* Empty — onboarding */}
      {!loading && !error && inventory.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface border border-line rounded-3xl p-10 text-center space-y-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink">{t('home.emptyTitle')}</h1>
            <p className="text-muted max-w-sm mx-auto leading-relaxed">{t('home.emptyBody')}</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/dashboard/onboarding"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-deep text-white px-6 py-3.5 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              <Sparkles className="w-5 h-5" />
              {t('home.quickStart')}
            </Link>
            <p className="text-sm text-muted max-w-xs mx-auto">{t('home.quickStartBody')}</p>
            <Link
              href="/scan"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              <Plus className="w-4 h-4" />
              {t('home.addManually')}
            </Link>
          </div>
        </motion.div>
      )}

      {/* Status hero — one glanceable answer + the single next thing to do */}
      {!loading && !error && inventory.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={
            allGood
              ? 'rounded-3xl p-8 bg-success-soft border border-success/20'
              : hasOut
              ? 'rounded-3xl p-8 bg-urgent-soft border border-urgent/20'
              : 'rounded-3xl p-8 bg-caution-soft border border-caution/20'
          }
        >
          <div className="flex items-start gap-4">
            <div
              className={
                'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ' +
                (allGood ? 'bg-success/15' : hasOut ? 'bg-urgent/15' : 'bg-caution/15')
              }
            >
              {allGood ? (
                <CheckCircle2 className="w-7 h-7 text-success" />
              ) : (
                <AlertTriangle className={hasOut ? 'w-7 h-7 text-urgent' : 'w-7 h-7 text-caution'} />
              )}
            </div>
            <div className="min-w-0">
              <h1
                className={
                  'text-2xl sm:text-3xl font-bold tracking-tight ' +
                  (allGood ? 'text-success' : hasOut ? 'text-urgent' : 'text-caution')
                }
              >
                {allGood
                  ? t('home.allSet')
                  : t(
                      needsAttention.length === 1 ? 'home.needAttentionOne' : 'home.needAttentionOther',
                      { count: needsAttention.length }
                    )}
              </h1>
              {/* Forward-looking line: the next real thing to do. Falls back to the
                  neutral reserve message when there is no real dated event. */}
              <p className="text-muted mt-1.5 leading-relaxed">
                {nextClause
                  ? nextClause
                  : allGood
                  ? t(
                      inventory.length === 1 ? 'home.allSetSubOne' : 'home.allSetSubOther',
                      { count: inventory.length, buffer: safetyBufferDays }
                    )
                  : t('home.needSub', { buffer: safetyBufferDays })}
              </p>
            </div>
          </div>
        </motion.section>
      )}

      {/* Primary action — one context-aware next step (floating "+" stays too) */}
      {!loading && !error && inventory.length > 0 && (
        <div>
          {mostUrgent ? (
            <a
              href={reorderTargetFor(mostUrgent).url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleReorder(reorderTargetFor(mostUrgent).label)}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-deep text-white py-3.5 rounded-2xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              <ShoppingCart className="w-5 h-5" />
              Reorder {mostUrgent.name}
            </a>
          ) : pod ? (
            <button
              onClick={handlePodChange}
              className="w-full inline-flex items-center justify-center gap-2 bg-surface border border-line hover:border-primary/40 text-ink py-3.5 rounded-2xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              <RefreshCcw className="w-5 h-5 text-teal" />
              Log a pod change
            </button>
          ) : (
            <Link
              href="/scan"
              className="w-full inline-flex items-center justify-center gap-2 bg-surface border border-line hover:border-primary/40 text-ink py-3.5 rounded-2xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              <Plus className="w-5 h-5 text-primary" />
              Add a supply
            </Link>
          )}
        </div>
      )}

      {/* What's next — real dated items only; hides itself when empty */}
      {!loading && !error && <WhatsNext items={agenda} now={now} />}

      {/* Finish setup — only while onboarding is incomplete; disappears for good
          once every real step is satisfied. Gated on extrasLoaded so the count is
          never wrong on first paint. */}
      {!loading && !error && extrasLoaded && !setupIsComplete && (
        <FinishSetup steps={steps} />
      )}

      {/* Attention list — only what matters, with reorder right here */}
      {!loading && needsAttention.length > 0 && (
        <section className="space-y-3">
          {needsAttention.map((item) => (
            <SupplyStatusRow
              key={item.id}
              product={item}
              bufferDays={safetyBufferDays}
              onReorder={handleReorder}
            />
          ))}
        </section>
      )}

      {/* Navigation cards — calm entry points to detail */}
      {!loading && !error && inventory.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NavCard
            href="/dashboard/supplies"
            icon={<Package className="w-5 h-5 text-primary" />}
            title={t('home.cardAllSupplies')}
            sub={t(
              inventory.length === 1 ? 'home.cardTrackedOne' : 'home.cardTrackedOther',
              { count: inventory.length }
            )}
          />
          <NavCard
            href="/dashboard/reorder"
            icon={<ShoppingCart className="w-5 h-5 text-primary" />}
            title={t('home.cardReorder')}
            sub={
              needsAttention.length > 0
                ? t(
                    needsAttention.length === 1 ? 'home.cardToReorderOne' : 'home.cardToReorderOther',
                    { count: needsAttention.length }
                  )
                : t('home.nothingNeeded')
            }
          />
        </section>
      )}

      {/* Add supply — always available */}
      {!loading && !error && inventory.length > 0 && (
        <div className="flex justify-center pt-2">
          <Link
            href="/scan"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            {t('home.addSupply')}
          </Link>
        </div>
      )}
    </div>
  )
}

function NavCard({
  href,
  icon,
  title,
  sub,
}: {
  href: string
  icon: React.ReactNode
  title: string
  sub: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 bg-surface border border-line rounded-2xl p-5 hover:border-primary/40 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-muted">{sub}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-faint group-hover:text-primary transition-colors" />
    </Link>
  )
}

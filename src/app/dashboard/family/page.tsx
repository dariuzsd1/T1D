'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  HeartHandshake, ShieldCheck, ChevronRight, Loader2, CheckCircle2,
  AlertTriangle, Database, RefreshCw, MailQuestion,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isMissingTableError } from '@/lib/prescriptions'
import { displayStatus, DEFAULT_SAFETY_BUFFER_DAYS } from '@/lib/depletion'
import { useToast } from '@/components/ui/Toast'
import { BackButton } from '@/components/ui/BackButton'
import {
  type SharedWithMe, type CaregiverShareRow,
  rowToSharedWithMe, ROLE_LABEL,
} from '@/lib/caregivers'

/** At-a-glance status of one patient's supplies, for the caregiver's calm view. */
interface PatientStatus {
  loading: boolean
  error?: boolean
  total: number
  attention: number
}

export default function FamilyPage() {
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()

  const [shares, setShares] = useState<SharedWithMe[]>([])
  const [pending, setPending] = useState<SharedWithMe[]>([])
  const [statuses, setStatuses] = useState<Record<string, PatientStatus>>({})
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Share id currently being accepted/declined (disables that card's buttons).
  const [responding, setResponding] = useState<string | null>(null)

  // Fetch one patient's inventory and reduce it to a calm "N need attention" count.
  const loadStatus = useCallback(async (ownerId: string) => {
    setStatuses(prev => ({ ...prev, [ownerId]: { loading: true, total: 0, attention: 0 } }))
    try {
      const res = await fetch(`/api/caregiver/${ownerId}/inventory`)
      const json = await res.json()
      if (!res.ok || json.error) {
        setStatuses(prev => ({ ...prev, [ownerId]: { loading: false, error: true, total: 0, attention: 0 } }))
        return
      }
      // displayStatus: unknown-rate items don't count as "needs attention" — the
      // caregiver count must not alarm on the fallback estimate.
      const items: { remainingDays: number; quantity: number; usageRatePerDay: number; expirationDate?: string | null }[] =
        json.data ?? []
      const attention = items.filter((p) => {
        const s = displayStatus(p, DEFAULT_SAFETY_BUFFER_DAYS)
        return s === 'out' || s === 'low'
      }).length
      setStatuses(prev => ({
        ...prev,
        [ownerId]: { loading: false, total: items.length, attention },
      }))
    } catch {
      setStatuses(prev => ({ ...prev, [ownerId]: { loading: false, error: true, total: 0, attention: 0 } }))
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    const { data, error: qErr } = await supabase
      .from('caregiver_shares')
      .select('*')
      .order('created_at', { ascending: false })

    if (qErr) {
      if (isMissingTableError(qErr)) setNeedsMigration(true)
      else setError(qErr.message)
      setLoading(false)
      return
    }

    setNeedsMigration(false)
    const rows = (data ?? []) as CaregiverShareRow[]
    // Only the shares where I'm the caregiver (someone else owns the data),
    // split by consent: pending invites need an accept/decline first — they
    // grant no access until accepted (RLS requires 'accepted').
    const mine = rows.filter(r => r.owner_id !== user?.id).map(rowToSharedWithMe)
    const active = mine.filter(s => s.status === 'accepted')
    setShares(active)
    setPending(mine.filter(s => s.status === 'invited'))
    setLoading(false)

    // Kick off per-person status loads in parallel (accepted shares only —
    // a pending share can't read anything yet).
    active.forEach(s => loadStatus(s.ownerId))
  }, [supabase, loadStatus])

  useEffect(() => { load() }, [load])

  // Accept/decline goes through a security-definer function that can only flip
  // the status of an invite addressed to my email (see supabase/setup.sql).
  const respond = async (share: SharedWithMe, accept: boolean) => {
    setResponding(share.shareId)
    const { data, error: rErr } = await supabase.rpc('respond_to_caregiver_share', {
      share_id: share.shareId,
      accept,
    })
    setResponding(null)
    if (rErr || !data) {
      showToast(
        rErr?.message?.includes('function')
          ? 'This needs the latest supabase/setup.sql. Run it, then try again.'
          : "Couldn't save your response. Please try again.",
        'caution'
      )
      return
    }
    showToast(
      accept
        ? `You now see ${share.ownerEmail ?? 'their'} supplies.`
        : 'Invite declined.',
      accept ? 'success' : 'info'
    )
    await load()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <BackButton />

      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Care circle</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">People I care for</h1>
        <p className="text-muted text-sm mt-2 max-w-prose">
          A calm view of the supplies people have shared with you. Open anyone to see details — and,
          if they gave you permission, help them reorder or log use.
        </p>
      </header>

      {/* DB not set up */}
      {needsMigration && (
        <div className="bg-surface border border-line rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Database className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-ink">One quick setup step</h3>
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            Caregiver sharing needs its table created first. Run{' '}
            <span className="font-semibold text-ink">supabase/setup.sql</span>{' '}
            in your Supabase SQL editor, then reload.
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
        <div className="bg-surface border border-line rounded-2xl p-10 text-center">
          <Loader2 className="w-5 h-5 text-muted animate-spin mx-auto" />
        </div>
      )}

      {error && (
        <div className="bg-urgent-soft border border-urgent/30 rounded-2xl p-6">
          <p className="text-urgent font-semibold">Couldn&apos;t load</p>
          <p className="text-urgent/80 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Pending invites — consent first: nothing is visible until accepted */}
      {!loading && !error && pending.length > 0 && (
        <section className="space-y-3">
          {pending.map((s) => (
            <motion.div
              key={s.shareId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-primary/30 bg-primary/5 p-5"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MailQuestion className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {s.ownerEmail ?? 'Someone'} invited you to view their supplies
                  </p>
                  <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {ROLE_LABEL[s.role]} · you see nothing until you accept
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => respond(s, true)}
                  disabled={responding === s.shareId}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                >
                  {responding === s.shareId && <Loader2 className="w-4 h-4 animate-spin" />}
                  Accept
                </button>
                <button
                  onClick={() => respond(s, false)}
                  disabled={responding === s.shareId}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-muted hover:bg-surface-2 border border-line transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Decline
                </button>
              </div>
            </motion.div>
          ))}
        </section>
      )}

      {/* Empty — not caring for anyone yet */}
      {!loading && !error && !needsMigration && shares.length === 0 && pending.length === 0 && (
        <div className="bg-surface border border-line rounded-3xl p-10 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto">
            <HeartHandshake className="w-7 h-7 text-muted" />
          </div>
          <p className="text-ink font-semibold">No one has shared with you yet</p>
          <p className="text-muted text-sm max-w-sm mx-auto leading-relaxed">
            When someone with diabetes adds you as a caregiver — using the email you signed in with —
            they&apos;ll appear here. Ask them to add you from their <span className="font-semibold text-ink">Sharing</span> page.
          </p>
        </div>
      )}

      {/* Per-person reassurance cards */}
      {!loading && shares.length > 0 && (
        <section className="space-y-3">
          {shares.map((s) => {
            const st = statuses[s.ownerId]
            const displayName = s.ownerEmail ?? `Patient (${s.ownerId.slice(0, 8)}…)`
            const allGood = st && !st.loading && !st.error && st.attention === 0
            const needs = st && !st.loading && !st.error && st.attention > 0

            return (
              <motion.div
                key={s.shareId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={
                  'rounded-2xl border p-5 ' +
                  (allGood
                    ? 'bg-success-soft border-success/20'
                    : needs
                    ? 'bg-caution-soft border-caution/20'
                    : 'bg-surface border-line')
                }
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{displayName}</p>
                    <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {ROLE_LABEL[s.role]}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/family/${s.ownerId}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold text-sm min-h-[36px] px-3 py-1.5 bg-surface-2 text-ink border border-line hover:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary shrink-0"
                  >
                    View supplies
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Calm status line */}
                <div className="mt-4 flex items-center gap-2.5">
                  {(!st || st.loading) && (
                    <span className="flex items-center gap-2 text-sm text-muted">
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking supplies…
                    </span>
                  )}
                  {st && st.error && (
                    <span className="text-sm text-muted">Couldn&apos;t load their supplies.</span>
                  )}
                  {allGood && (
                    <span className="flex items-center gap-2 text-success font-semibold">
                      <CheckCircle2 className="w-5 h-5" />
                      All good
                      <span className="text-success/70 font-normal text-sm">
                        · {st!.total} {st!.total === 1 ? 'supply' : 'supplies'} stocked
                      </span>
                    </span>
                  )}
                  {needs && (
                    <span className="flex items-center gap-2 text-caution font-semibold">
                      <AlertTriangle className="w-5 h-5" />
                      {st!.attention} {st!.attention === 1 ? 'supply needs' : 'supplies need'} attention
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </section>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users, UserPlus, Trash2, Database, RefreshCw, Mail, Info, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { isMissingTableError } from '@/lib/prescriptions'
import {
  type CaregiverShare,
  type CaregiverRole,
  type ShareStatus,
  rowToShare,
  isValidEmail,
  ROLE_LABEL,
} from '@/lib/caregivers'

const STATUS_STYLE: Record<ShareStatus, { label: string; cls: string }> = {
  invited: { label: 'Invited', cls: 'bg-caution-soft text-caution border-caution/20' },
  accepted: { label: 'Active', cls: 'bg-success-soft text-success border-success/20' },
  revoked: { label: 'Revoked', cls: 'bg-surface-2 text-faint border-line' },
}

export default function CaregiversPage() {
  // Memoize: createBrowserClient returns a fresh client each call, and `supabase`
  // is a dependency of the load callback — a new client every render would loop.
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()

  const [shares, setShares] = useState<CaregiverShare[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<CaregiverRole>('view')
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
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
    setShares((data ?? []).map(rowToShare))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!isValidEmail(trimmed)) {
      showToast('Please enter a valid email address.', 'caution')
      return
    }
    if (shares.some((s) => s.caregiverEmail.toLowerCase() === trimmed && s.status !== 'revoked')) {
      showToast('That person already has access.', 'info')
      return
    }
    setInviting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      showToast('You are signed out. Please sign in again.', 'caution')
      setInviting(false)
      return
    }
    // 'accepted' = the owner has granted access now, so it's live (the RLS
    // caregiver-read policy keys on this). 'invited'/'revoked' stay in the model
    // for a future self-serve email-invite flow.
    const { error: iErr } = await supabase.from('caregiver_shares').insert({
      owner_id: user.id,
      caregiver_email: trimmed,
      role,
      status: 'accepted',
    })
    setInviting(false)
    if (iErr) {
      showToast(`Couldn’t add caregiver: ${iErr.message}`, 'caution')
      return
    }
    setEmail('')
    setRole('view')
    showToast(`Invited ${trimmed}.`, 'success')
    await load()
  }

  const handleRevoke = async (share: CaregiverShare) => {
    const { error: dErr } = await supabase.from('caregiver_shares').delete().eq('id', share.id)
    if (dErr) {
      showToast(`Couldn’t revoke: ${dErr.message}`, 'caution')
      return
    }
    setShares((prev) => prev.filter((s) => s.id !== share.id))
    showToast(`Removed ${share.caregiverEmail}.`, 'info')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Caregivers</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Share with a caregiver</h1>
        <p className="text-muted text-sm mt-2 max-w-prose">
          Let a parent, partner, or care team member help keep your supplies on track.
          You decide who, and you can remove access any time.
        </p>
      </header>

      {needsMigration && (
        <div className="bg-surface border border-line rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Database className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-ink">One quick setup step</h3>
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            Caregiver sharing needs its table and access rules created first. Run the SQL in{' '}
            <span className="font-semibold text-ink">docs/PRESCRIPTIONS_CAREGIVERS_MIGRATION.md</span>{' '}
            in your Supabase dashboard, then reload.
          </p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 bg-surface-2 hover:bg-line text-ink px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> I&apos;ve run it — reload
          </button>
        </div>
      )}

      {!needsMigration && (
        <>
          {/* Invite form */}
          <section className="bg-surface border border-line rounded-3xl p-6 shadow-sm">
            <h3 className="font-semibold text-ink mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Add a caregiver
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="cg-email" className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1.5">Their email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="cg-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl p-3 pl-9 font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cg-role" className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1.5">Access level</label>
                <select
                  id="cg-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as CaregiverRole)}
                  className="w-full bg-surface border border-line rounded-xl p-3 font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                >
                  <option value="view">Can view — see supplies & refill timing</option>
                  <option value="manage">Can view &amp; manage — also log use and edit</option>
                </select>
              </div>
              <button
                onClick={handleInvite}
                disabled={inviting}
                className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                {inviting ? 'Adding…' : 'Add caregiver'}
              </button>
            </div>

            {/* Honest note on what happens next */}
            <div className="mt-4 flex gap-2.5 rounded-2xl bg-surface-2 border border-line p-3.5 text-xs text-muted leading-relaxed">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-faint" />
              <p>
                We record who you&apos;ve granted access to. Your caregiver gains access once
                they sign in with this exact email. We don&apos;t send the invite email
                automatically yet — share the app link with them directly for now.
              </p>
            </div>
          </section>

          {/* List */}
          <section className="space-y-3">
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <Users className="w-5 h-5 text-muted" /> People with access
            </h3>

            {loading && (
              <div className="bg-surface border border-line rounded-2xl p-10 text-center animate-pulse">
                <div className="h-4 bg-surface-2 rounded w-40 mx-auto" />
              </div>
            )}

            {error && (
              <div className="bg-urgent-soft border border-urgent/30 rounded-2xl p-6">
                <p className="text-urgent font-semibold">Couldn&apos;t load caregivers</p>
                <p className="text-urgent/80 text-sm mt-1">{error}</p>
              </div>
            )}

            {!loading && !error && shares.length === 0 && (
              <div className="bg-surface border border-line rounded-2xl p-10 text-center">
                <Users className="w-7 h-7 text-faint mx-auto mb-3" />
                <p className="text-muted font-medium">No one has access yet</p>
              </div>
            )}

            {shares.map((s) => {
              const style = STATUS_STYLE[s.status]
              return (
                <div key={s.id} className="bg-surface border border-line rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{s.caregiverEmail}</p>
                    <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> {ROLE_LABEL[s.role]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${style.cls}`}>
                      {style.label}
                    </span>
                    <button
                      onClick={() => handleRevoke(s)}
                      aria-label={`Remove ${s.caregiverEmail}`}
                      className="rounded-lg p-2 text-faint hover:bg-urgent-soft hover:text-urgent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        </>
      )}
    </div>
  )
}

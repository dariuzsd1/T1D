'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Users, UserPlus, Trash2, Database, RefreshCw, Mail, Info,
  ShieldCheck, Loader2, HeartHandshake, ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { isMissingTableError } from '@/lib/prescriptions'
import { BackButton } from '@/components/ui/BackButton'
import { Button } from '@/components/ui/button'
import {
  type CaregiverShare, type CaregiverRole, type ShareStatus,
  type CaregiverShareRow,
  rowToShare, isValidEmail, ROLE_LABEL,
} from '@/lib/caregivers'

const STATUS_STYLE: Record<ShareStatus, { label: string; cls: string }> = {
  invited: { label: 'Invited', cls: 'bg-caution-soft text-caution border-caution/20' },
  accepted: { label: 'Active', cls: 'bg-success-soft text-success border-success/20' },
  revoked: { label: 'Revoked', cls: 'bg-surface-2 text-faint border-line' },
}

export default function SharingPage() {
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()

  const [myShares, setMyShares] = useState<CaregiverShare[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<CaregiverRole>('view')
  const [inviting, setInviting] = useState(false)

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
    // Only the shares I own (people I granted access to my supplies).
    setMyShares(rows.filter(r => r.owner_id === user?.id).map(rowToShare))
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!isValidEmail(trimmed)) {
      showToast('Please enter a valid email address.', 'caution')
      return
    }
    if (myShares.some(s => s.caregiverEmail.toLowerCase() === trimmed && s.status !== 'revoked')) {
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
    const { error: iErr } = await supabase.from('caregiver_shares').insert({
      owner_id: user.id,
      owner_email: user.email,   // stored so caregivers can see whose data it is
      caregiver_email: trimmed,
      role,
      status: 'accepted',
    })
    setInviting(false)
    if (iErr) {
      showToast(`Couldn't add caregiver: ${iErr.message}`, 'caution')
      return
    }
    setEmail('')
    setRole('view')
    showToast(`Added ${trimmed}.`, 'success')
    await load()
  }

  const handleRevoke = async (share: CaregiverShare) => {
    const { error: dErr } = await supabase.from('caregiver_shares').delete().eq('id', share.id)
    if (dErr) {
      showToast(`Couldn't revoke: ${dErr.message}`, 'caution')
      return
    }
    setMyShares(prev => prev.filter(s => s.id !== share.id))
    showToast(`Removed ${share.caregiverEmail}.`, 'info')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <BackButton />
      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Sharing</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Who can see my supplies</h1>
        <p className="text-muted text-sm mt-2 max-w-prose">
          Invite a parent, partner, or care team member to see your supplies — and remove their
          access anytime.
        </p>
      </header>

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

      {!needsMigration && (
        <>
          {/* Add a caregiver */}
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
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-surface border border-line rounded-xl p-3 pl-9 font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cg-role" className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1.5">Access level</label>
                <select
                  id="cg-role"
                  value={role}
                  onChange={e => setRole(e.target.value as CaregiverRole)}
                  className="w-full bg-surface border border-line rounded-xl p-3 font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                >
                  <option value="view">Can view — see supplies &amp; refill timing</option>
                  <option value="manage">Can view &amp; manage — also log use and edit</option>
                </select>
              </div>
              <Button onClick={handleInvite} disabled={inviting} className="w-full">
                {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                {inviting ? 'Adding…' : 'Add caregiver'}
              </Button>
            </div>

            <div className="mt-4 flex gap-2.5 rounded-2xl bg-surface-2 border border-line p-3.5 text-xs text-muted leading-relaxed">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-faint" />
              <p>
                Access is live as soon as they sign in with this exact email. We don&apos;t send
                the invite automatically yet — share the app link with them directly.
              </p>
            </div>
          </section>

          {/* People with access to MY supplies */}
          <section className="space-y-3">
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <Users className="w-5 h-5 text-muted" /> People with access to my supplies
            </h3>

            {loading && (
              <div className="bg-surface border border-line rounded-2xl p-10 text-center">
                <Loader2 className="w-5 h-5 text-muted animate-spin mx-auto" />
              </div>
            )}
            {error && (
              <div className="bg-urgent-soft border border-urgent/30 rounded-2xl p-6">
                <p className="text-urgent font-semibold">Couldn&apos;t load sharing</p>
                <p className="text-urgent/80 text-sm mt-1">{error}</p>
              </div>
            )}
            {!loading && !error && myShares.length === 0 && (
              <div className="bg-surface border border-line rounded-2xl p-10 text-center">
                <Users className="w-7 h-7 text-faint mx-auto mb-3" />
                <p className="text-muted font-medium">No one has access yet</p>
              </div>
            )}
            {myShares.map(s => {
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

          {/* Cross-link: the other side of sharing */}
          <Link
            href="/dashboard/family"
            className="flex items-center gap-3 bg-surface border border-line rounded-2xl p-4 hover:border-primary/40 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5 text-teal" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink text-sm">Caring for someone else?</p>
              <p className="text-xs text-muted">See supplies people have shared with you.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-faint group-hover:text-primary transition-colors" />
          </Link>
        </>
      )}
    </div>
  )
}

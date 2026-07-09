'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Users, UserPlus, Trash2, Database, RefreshCw, Mail, Info,
  ShieldCheck, Loader2, HeartHandshake, ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useI18n } from '@/lib/i18n'
import type { TKey } from '@/lib/i18n/dictionaries'
import { isMissingTableError } from '@/lib/prescriptions'
import { BackButton } from '@/components/ui/BackButton'
import { Button } from '@/components/ui/button'
import {
  type CaregiverShare, type CaregiverRole, type ShareStatus,
  type CaregiverShareRow,
  rowToShare, isValidEmail,
} from '@/lib/caregivers'

const STATUS_STYLE: Record<ShareStatus, { labelKey: TKey; cls: string }> = {
  invited: { labelKey: 'caregivers.statusInvited', cls: 'bg-caution-soft text-caution border-caution/20' },
  accepted: { labelKey: 'caregivers.statusActive', cls: 'bg-success-soft text-success border-success/20' },
  revoked: { labelKey: 'caregivers.statusRevoked', cls: 'bg-surface-2 text-faint border-line' },
}

const ROLE_LABEL_KEY: Record<CaregiverRole, TKey> = {
  view: 'caregivers.roleLabelView',
  manage: 'caregivers.roleLabelManage',
}

export default function SharingPage() {
  const supabase = useMemo(() => createClient(), [])
  const { showToast } = useToast()
  const { t } = useI18n()

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

  // Standard fetch-on-mount; goes away once this page migrates to TanStack
  // Query (already done for Home/Supplies/Reorder/Calendar).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!isValidEmail(trimmed)) {
      showToast(t('caregivers.errInvalidEmail'), 'caution')
      return
    }
    if (myShares.some(s => s.caregiverEmail.toLowerCase() === trimmed && s.status !== 'revoked')) {
      showToast(t('caregivers.errAlreadyInvited'), 'info')
      return
    }
    setInviting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      showToast(t('common.signedOutError'), 'caution')
      setInviting(false)
      return
    }
    // Consent step: the share starts as 'invited' and grants no access until the
    // caregiver accepts it from their Care circle page (RLS requires 'accepted').
    // A declined (revoked) share for the same email is revived rather than
    // inserted — the unique (owner_id, caregiver_email) constraint forbids two rows.
    const revoked = myShares.find(
      s => s.caregiverEmail.toLowerCase() === trimmed && s.status === 'revoked'
    )
    const { error: iErr } = revoked
      ? await supabase.from('caregiver_shares')
          .update({ status: 'invited', role, accepted_at: null })
          .eq('id', revoked.id)
      : await supabase.from('caregiver_shares').insert({
          owner_id: user.id,
          owner_email: user.email,   // stored so caregivers can see whose data it is
          caregiver_email: trimmed,
          role,
          status: 'invited',
        })
    setInviting(false)
    if (iErr) {
      showToast(t('caregivers.errInviteFail', { error: iErr.message }), 'caution')
      return
    }
    setEmail('')
    setRole('view')
    showToast(t('caregivers.toastInvited', { email: trimmed }), 'success')
    await load()
  }

  const handleRevoke = async (share: CaregiverShare) => {
    const { error: dErr } = await supabase.from('caregiver_shares').delete().eq('id', share.id)
    if (dErr) {
      showToast(t('caregivers.errRevokeFail', { error: dErr.message }), 'caution')
      return
    }
    setMyShares(prev => prev.filter(s => s.id !== share.id))
    showToast(t('common.toastRemoved', { name: share.caregiverEmail }), 'info')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <BackButton />
      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('nav.sharing')}</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t('caregivers.title')}</h1>
        <p className="text-muted text-sm mt-2 max-w-prose">
          {t('caregivers.intro')}
        </p>
      </header>

      {needsMigration && (
        <div className="bg-surface border border-line rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Database className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-ink">{t('common.setupStepTitle')}</h3>
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            {t('caregivers.migrationBody')}
          </p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 bg-surface-2 hover:bg-line text-ink px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> {t('common.reload')}
          </button>
        </div>
      )}

      {!needsMigration && (
        <>
          {/* Add a caregiver */}
          <section className="bg-surface border border-line rounded-3xl p-6 shadow-sm">
            <h3 className="font-semibold text-ink mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> {t('caregivers.addTitle')}
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="cg-email" className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1.5">{t('caregivers.theirEmail')}</label>
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
                <label htmlFor="cg-role" className="block text-[11px] font-semibold uppercase tracking-widest text-muted mb-1.5">{t('caregivers.accessLevel')}</label>
                <select
                  id="cg-role"
                  value={role}
                  onChange={e => setRole(e.target.value as CaregiverRole)}
                  className="w-full bg-surface border border-line rounded-xl p-3 font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary"
                >
                  <option value="view">{t('caregivers.roleView')}</option>
                  <option value="manage">{t('caregivers.roleManage')}</option>
                </select>
              </div>
              <Button onClick={handleInvite} disabled={inviting} className="w-full">
                {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                {inviting ? t('caregivers.inviting') : t('caregivers.inviteBtn')}
              </Button>
            </div>

            <div className="mt-4 flex gap-2.5 rounded-2xl bg-surface-2 border border-line p-3.5 text-xs text-muted leading-relaxed">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-faint" />
              <p>
                {t('caregivers.inviteHint')}
              </p>
            </div>
          </section>

          {/* People with access to MY supplies */}
          <section className="space-y-3">
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <Users className="w-5 h-5 text-muted" /> {t('caregivers.peopleWithAccess')}
            </h3>

            {loading && (
              <div className="bg-surface border border-line rounded-2xl p-10 text-center">
                <Loader2 className="w-5 h-5 text-muted animate-spin mx-auto" />
              </div>
            )}
            {error && (
              <div className="bg-urgent-soft border border-urgent/30 rounded-2xl p-6">
                <p className="text-urgent font-semibold">{t('caregivers.errorTitle')}</p>
                <p className="text-urgent/80 text-sm mt-1">{error}</p>
              </div>
            )}
            {!loading && !error && myShares.length === 0 && (
              <div className="bg-surface border border-line rounded-2xl p-10 text-center">
                <Users className="w-7 h-7 text-faint mx-auto mb-3" />
                <p className="text-muted font-medium">{t('caregivers.noAccessYet')}</p>
              </div>
            )}
            {myShares.map(s => {
              const style = STATUS_STYLE[s.status]
              return (
                <div key={s.id} className="bg-surface border border-line rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{s.caregiverEmail}</p>
                    <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> {t(ROLE_LABEL_KEY[s.role])}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${style.cls}`}>
                      {t(style.labelKey)}
                    </span>
                    <button
                      onClick={() => handleRevoke(s)}
                      aria-label={t('common.removeAria', { name: s.caregiverEmail })}
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
              <p className="font-semibold text-ink text-sm">{t('caregivers.caringForOther')}</p>
              <p className="text-xs text-muted">{t('caregivers.seeShared')}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-faint group-hover:text-primary transition-colors" />
          </Link>
        </>
      )}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { DME_SUPPLIERS } from '@/lib/suppliers'
import Link from 'next/link'
import { PushToggle } from '@/components/PushToggle'
import { BackButton } from '@/components/ui/BackButton'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { createClient } from '@/lib/supabase/client'
import { rowToProfile, userLabel, type Profile, type ProfileRow } from '@/lib/profile'
import { useI18n } from '@/lib/i18n'
import { useDialog } from '@/lib/useDialog'
import { useProfile } from '@/components/profile/ProfileProvider'
import { Avatar } from '@/components/profile/Avatar'
import {
  buildExportDocument, exportFilename, gatherUserData, downloadJson,
} from '@/lib/dataExport'
import {
  Bell, ShieldCheck, ExternalLink, Truck, User, Loader2,
  Lock, Eye, EyeOff, CheckCircle, AlertCircle, LogOut, Languages, SunMoon,
  Mail, Download, Trash2, AlertTriangle, X, BarChart3,
} from 'lucide-react'

const BUFFER_PRESETS = [7, 14, 21, 30]

export default function SettingsPage() {
  const { safetyBufferDays, setSafetyBufferDays } = useStore()
  const { t } = useI18n()
  const { profile, email } = useProfile()

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <BackButton />
      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('settings.kicker')}</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t('settings.title')}</h1>
      </header>

      {/* Profile shortcut */}
      <Link
        href="/dashboard/profile"
        className="flex items-center gap-4 bg-surface border border-line rounded-3xl p-5 shadow-sm hover:border-primary/40 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Avatar profile={profile} email={email} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink truncate">{userLabel(profile, email)}</p>
          <p className="text-sm text-muted truncate">{email ?? ''}</p>
        </div>
        <span className="text-sm font-semibold text-primary">{t('nav.profile')}</span>
      </Link>

      {/* Account — always first */}
      <AccountSection />

      {/* Language */}
      <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Languages className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-ink">{t('settings.language')}</h3>
              <p className="text-sm text-muted">{t('settings.languageBody')}</p>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </section>

      {/* Appearance (light/dark/system) */}
      <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <SunMoon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-ink">{t('settings.theme')}</h3>
              <p className="text-sm text-muted">{t('settings.themeBody')}</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </section>

      {/* Safety buffer — real, works now, persists locally */}
      <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">{t('settings.bufferTitle')}</h3>
            <p className="text-sm text-muted">{t('settings.bufferBody')}</p>
          </div>
        </div>

        <div className="flex items-end gap-4 mb-5">
          <div className="text-5xl font-black tabular-nums text-ink">{safetyBufferDays}</div>
          <div className="text-sm font-medium text-muted pb-2">{t('settings.daysReserve')}</div>
        </div>

        <label htmlFor="buffer-range" className="sr-only">{t('settings.bufferTitle')}</label>
        <input
          id="buffer-range"
          type="range"
          min={1}
          max={45}
          value={safetyBufferDays}
          onChange={(e) => setSafetyBufferDays(parseInt(e.target.value, 10))}
          className="w-full accent-primary"
        />

        <div className="flex flex-wrap gap-2 mt-4">
          {BUFFER_PRESETS.map((d) => (
            <button
              key={d}
              onClick={() => setSafetyBufferDays(d)}
              aria-pressed={safetyBufferDays === d}
              className={
                safetyBufferDays === d
                  ? 'px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white'
                  : 'px-4 py-2 rounded-xl text-sm font-semibold bg-surface-2 text-muted hover:text-ink transition-colors'
              }
            >
              {d} {t('settings.daysUnit')}
            </button>
          ))}
        </div>
      </section>

      {/* Notifications — honest: needs one-time setup, not yet live */}
      <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-caution-soft border border-caution/20 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-caution" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">{t('settings.pushTitle')}</h3>
            <p className="text-sm text-muted">{t('settings.pushBody')}</p>
          </div>
        </div>
        <PushToggle />
      </section>

      {/* Privacy-first usage analytics — opt-in */}
      <AnalyticsConsent />

      {/* Quick supplier links — real, useful now */}
      <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-teal" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">{t('settings.suppliersTitle')}</h3>
            <p className="text-sm text-muted">{t('settings.suppliersBody')}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {DME_SUPPLIERS.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 border border-line px-4 py-3 text-sm font-semibold text-ink hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {s.label}
              <ExternalLink className="w-4 h-4 text-faint" />
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Analytics consent (opt-in, default off) ────────────────────────────────────

function AnalyticsConsent() {
  const { t } = useI18n()
  const { profile, refresh } = useProfile()
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)
  const optedIn = !!profile?.analyticsOptIn

  const toggle = async () => {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({ analytics_opt_in: !optedIn }).eq('id', profile.id)
    await refresh()
    setSaving(false)
  }

  return (
    <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">{t('analytics.title')}</h3>
            <p className="text-sm text-muted">{t('analytics.body')}</p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={saving || !profile}
          role="switch"
          aria-checked={optedIn}
          className={
            'shrink-0 min-h-[44px] px-4 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
            (optedIn
              ? 'bg-primary text-white border-primary'
              : 'bg-surface-2 text-muted border-line hover:text-ink')
          }
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : optedIn ? t('analytics.on') : t('analytics.off')}
        </button>
      </div>
    </section>
  )
}

// ── Account section ───────────────────────────────────────────────────────────

function AccountSection() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { t } = useI18n()

  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showPwForm, setShowPwForm] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [signingOut, setSigningOut] = useState(false)

  // Phase C — account management
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? null)
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const p = rowToProfile(data as ProfileRow)
            setProfile(p)
            setDisplayName(p.displayName ?? '')
          }
        })
    })
  }, [supabase])

  const handleSaveName = async () => {
    if (!email) return
    setNameSaving(true); setNameMsg(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setNameSaving(false); return }
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: displayName.trim() || null })
    setNameSaving(false)
    if (error) {
      setNameMsg({ type: 'error', text: error.message })
    } else {
      setProfile(prev => prev ? { ...prev, displayName: displayName.trim() || null } : null)
      setNameMsg({ type: 'success', text: t('settings.nameSaved') })
      setTimeout(() => setNameMsg(null), 3000)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: t('login.errMismatch') }); return }
    if (newPw.length < 8) { setPwMsg({ type: 'error', text: t('login.min8') }); return }
    setPwSaving(true); setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwSaving(false)
    if (error) {
      setPwMsg({ type: 'error', text: error.message })
    } else {
      setPwMsg({ type: 'success', text: t('settings.pwUpdated') })
      setNewPw(''); setConfirmPw(''); setShowPwForm(false)
      setTimeout(() => setPwMsg(null), 3000)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    const next = newEmail.trim()
    if (!next) return
    setEmailSaving(true); setEmailMsg(null)
    const { error } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings` }
    )
    setEmailSaving(false)
    if (error) {
      setEmailMsg({ type: 'error', text: error.message })
    } else {
      setNewEmail('')
      setEmailMsg({ type: 'success', text: t('account.emailChangeSent') })
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('signed out')
      const tables = await gatherUserData(supabase, user.id)
      const doc = buildExportDocument(
        { id: user.id, email: user.email ?? null },
        tables,
        new Date().toISOString()
      )
      downloadJson(doc, exportFilename())
    } catch (err) {
      console.error('export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="bg-surface border border-line rounded-3xl p-7 shadow-sm">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-ink">{t('settings.account')}</h3>
          <p className="text-sm text-muted">
            {email ?? <span className="inline-block w-32 h-3.5 bg-surface-2 rounded animate-pulse" />}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Display name */}
        <div>
          <label htmlFor="display-name" className="block text-sm font-medium text-muted mb-1.5">
            {t('settings.displayName')} <span className="text-faint font-normal">{t('settings.optional')}</span>
          </label>
          <div className="flex gap-2">
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={email ? userLabel(null, email) : 'Your name'}
              maxLength={60}
              className="flex-1 min-h-[44px] rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all"
            />
            <button
              onClick={handleSaveName}
              disabled={nameSaving}
              aria-label={t('settings.save')}
              className="min-h-[44px] px-4 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-deep disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {nameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('settings.save')}
            </button>
          </div>
          {nameMsg && (
            <p className={`mt-1.5 text-xs flex items-center gap-1 ${nameMsg.type === 'success' ? 'text-success' : 'text-urgent'}`}>
              {nameMsg.type === 'success'
                ? <CheckCircle className="w-3.5 h-3.5" />
                : <AlertCircle className="w-3.5 h-3.5" />}
              {nameMsg.text}
            </p>
          )}
        </div>

        {/* Change / set password */}
        <div>
          {!showPwForm ? (
            <button
              onClick={() => { setShowPwForm(true); setPwMsg(null) }}
              className="flex items-center gap-2 text-sm font-semibold text-ink hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              <Lock className="w-4 h-4" /> {t('settings.setChangePw')}
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3 bg-surface-2 rounded-2xl p-4 border border-line">
              <p className="text-sm font-semibold text-ink">{t('reset.title')}</p>
              {(['settings.newPw', 'settings.confirmNewPw'] as const).map((labelKey, i) => {
                const isNew = i === 0
                const val = isNew ? newPw : confirmPw
                const setVal = isNew ? setNewPw : setConfirmPw
                return (
                  <div key={labelKey}>
                    <label className="block text-xs font-medium text-muted mb-1">{t(labelKey)}</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        value={val}
                        onChange={e => setVal(e.target.value)}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 pr-10 text-ink placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all"
                      />
                      {isNew && (
                        <button
                          type="button"
                          onClick={() => setShowPw(s => !s)}
                          aria-label={showPw ? t('login.hidePassword') : t('login.showPassword')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {pwMsg && (
                <p className={`text-xs flex items-center gap-1 ${pwMsg.type === 'success' ? 'text-success' : 'text-urgent'}`}>
                  {pwMsg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {pwMsg.text}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={pwSaving}
                  aria-label={t('settings.updatePw')}
                  className="min-h-[40px] px-4 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-deep disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('settings.updatePw')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPwForm(false); setNewPw(''); setConfirmPw(''); setPwMsg(null) }}
                  className="min-h-[40px] px-4 rounded-xl text-sm font-semibold text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Change email */}
        <form onSubmit={handleChangeEmail} className="border-t border-line pt-5">
          <label htmlFor="acc-email" className="block text-sm font-medium text-muted mb-1.5">
            {t('account.changeEmail')}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="acc-email"
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder={t('account.newEmail')}
                className="w-full min-h-[44px] rounded-xl border border-line bg-surface pl-9 pr-3 text-ink placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={emailSaving || !newEmail.trim()}
              aria-label={t('account.sendEmailChange')}
              className="min-h-[44px] px-4 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-deep disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary whitespace-nowrap"
            >
              {emailSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('account.sendEmailChange')}
            </button>
          </div>
          {emailMsg && (
            <p className={`mt-1.5 text-xs flex items-start gap-1 ${emailMsg.type === 'success' ? 'text-success' : 'text-urgent'}`}>
              {emailMsg.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
              {emailMsg.text}
            </p>
          )}
        </form>

        {/* Export my data */}
        <div className="border-t border-line pt-5">
          <p className="text-sm font-medium text-ink">{t('account.exportTitle')}</p>
          <p className="text-xs text-muted mt-0.5 mb-3">{t('account.exportBody')}</p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 bg-surface-2 hover:bg-line border border-line text-ink px-4 min-h-[44px] rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('account.exportBtn')}
          </button>
        </div>

        {/* Sign out */}
        <div className="pt-5 border-t border-line">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 text-sm font-semibold text-ink hover:text-primary disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {t('settings.signOut')}
          </button>
        </div>

        {/* Danger zone — delete account */}
        <div className="pt-5 border-t border-line">
          <div className="flex items-start gap-3 rounded-2xl bg-urgent-soft border border-urgent/20 p-4">
            <AlertTriangle className="w-5 h-5 text-urgent shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-urgent">{t('account.dangerTitle')}</p>
              <p className="text-xs text-urgent/80 mt-0.5 leading-relaxed">{t('account.dangerBody')}</p>
              <button
                onClick={() => setShowDelete(true)}
                className="mt-3 inline-flex items-center gap-2 bg-urgent text-white px-4 min-h-[44px] rounded-xl font-semibold text-sm hover:bg-urgent/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-urgent"
              >
                <Trash2 className="w-4 h-4" />
                {t('account.deleteBtn')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDelete && (
          <DeleteAccountDialog
            onClose={() => setShowDelete(false)}
            onConfirmed={async () => { await supabase.auth.signOut(); router.push('/login') }}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

/** Typed-confirmation dialog for irreversible account deletion. */
function DeleteAccountDialog({
  onClose,
  onConfirmed,
}: {
  onClose: () => void
  onConfirmed: () => Promise<void>
}) {
  const supabase = useMemo(() => createClient(), [])
  const { t } = useI18n()
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requiredWord = t('account.deleteConfirmWord')
  const canDelete = confirmText.trim().toUpperCase() === requiredWord.toUpperCase()

  const handleDelete = async () => {
    if (!canDelete) return
    setDeleting(true); setError(null)
    const { error: rpcErr } = await supabase.rpc('delete_own_account')
    if (rpcErr) {
      setDeleting(false)
      setError(t('account.deleteErr'))
      return
    }
    await onConfirmed()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="relative w-full sm:max-w-md bg-surface border border-line rounded-t-3xl sm:rounded-3xl shadow-xl p-6"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-urgent-soft flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-urgent" />
            </div>
            <h2 id="delete-account-title" className="text-lg font-bold text-ink">
              {t('account.deleteConfirmTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.cancel')}
            className="rounded-lg p-1.5 text-faint hover:bg-surface-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted leading-relaxed mb-4">{t('account.deleteConfirmBody')}</p>

        <input
          type="text"
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder={t('account.deleteConfirmPlaceholder')}
          aria-label={t('account.deleteConfirmPlaceholder')}
          className="w-full min-h-[44px] rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-urgent focus:border-urgent transition-all"
        />

        {error && (
          <p className="mt-2 text-xs text-urgent flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-urgent text-white px-4 min-h-[44px] rounded-xl font-semibold text-sm hover:bg-urgent/90 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-urgent"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {t('account.deleteConfirmBtn')}
          </button>
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 min-h-[44px] rounded-xl text-sm font-semibold text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('common.cancel')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

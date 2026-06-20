'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { DME_SUPPLIERS } from '@/lib/suppliers'
import { PushToggle } from '@/components/PushToggle'
import { BackButton } from '@/components/ui/BackButton'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { createClient } from '@/lib/supabase/client'
import { rowToProfile, userLabel, type Profile, type ProfileRow } from '@/lib/profile'
import { useI18n } from '@/lib/i18n'
import {
  Bell, ShieldCheck, ExternalLink, Truck, User, Loader2,
  Lock, Eye, EyeOff, CheckCircle, AlertCircle, LogOut, Languages,
} from 'lucide-react'

const BUFFER_PRESETS = [7, 14, 21, 30]

export default function SettingsPage() {
  const { safetyBufferDays, setSafetyBufferDays } = useStore()
  const { t } = useI18n()

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <BackButton />
      <header>
        <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('settings.kicker')}</h2>
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t('settings.title')}</h1>
      </header>

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

        {/* Sign out */}
        <div className="pt-2 border-t border-line">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 text-sm font-semibold text-urgent hover:text-urgent/80 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent rounded"
          >
            {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {t('settings.signOut')}
          </button>
        </div>
      </div>
    </section>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, ArrowRight, ShieldCheck, AlertCircle, Loader2,
  Lock, Eye, EyeOff, UserPlus, LogIn, ChevronLeft,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { LanguageToggle } from '@/components/ui/LanguageToggle'

type View = 'signin' | 'signup' | 'magic' | 'forgot'

interface Msg { type: 'success' | 'error'; text: string }

/**
 * Where to land after auth. Read from the `?next=` query param (set by the
 * landing page's two paths), defaulting to /dashboard. Guarded against
 * open-redirects: must be a same-site absolute path, never an external URL.
 */
function getNextPath(): string {
  if (typeof window === 'undefined') return '/dashboard'
  const next = new URLSearchParams(window.location.search).get('next')
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('://')) {
    return next
  }
  return '/dashboard'
}

function PasswordInput({
  id, value, onChange, placeholder, autoComplete,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-faint pointer-events-none" />
      <input
        id={id}
        type={show ? 'text' : 'password'}
        required
        placeholder={placeholder ?? '••••••••'}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full bg-surface border border-line rounded-xl py-3.5 pl-12 pr-12 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all placeholder:text-faint"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? t('login.hidePassword') : t('login.showPassword')}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

function StatusMsg({ msg }: { msg: Msg }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      role="status"
      className={`mt-5 p-4 rounded-xl flex items-start gap-3 border ${
        msg.type === 'success'
          ? 'bg-success-soft border-success/20 text-success'
          : 'bg-urgent-soft border-urgent/20 text-urgent'
      }`}
    >
      {msg.type === 'success'
        ? <ShieldCheck className="w-5 h-5 shrink-0" />
        : <AlertCircle className="w-5 h-5 shrink-0" />}
      <span className="text-sm font-medium leading-snug">{msg.text}</span>
    </motion.div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useI18n()

  const [view, setView] = useState<View>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<Msg | null>(null)

  const clearMsg = () => setMsg(null)

  const switchView = (v: View) => { setView(v); clearMsg() }

  // ── Sign in with password ────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); clearMsg()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      router.push(getNextPath())
    }
  }

  // ── Create account ───────────────────────────────────────────────────────
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setMsg({ type: 'error', text: t('login.errMismatch') })
      return
    }
    if (password.length < 8) {
      setMsg({ type: 'error', text: t('login.errMin8') })
      return
    }
    setLoading(true); clearMsg()
    const next = getNextPath()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setLoading(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    // If email confirmation is required, session is null — show a prompt.
    // If disabled in Supabase dashboard, session is set and we can navigate.
    if (data.session) {
      router.push(next)
    } else {
      setMsg({ type: 'success', text: t('login.createdConfirm') })
    }
  }

  // ── Magic link (passwordless fallback) ──────────────────────────────────
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); clearMsg()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getNextPath())}`,
      },
    })
    setLoading(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: t('login.magicSent') })
    }
  }

  // ── Forgot password ──────────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); clearMsg()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // The callback exchanges the recovery code and redirects to /auth/reset.
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    })
    setLoading(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: t('login.resetSent') })
    }
  }

  // ── Google (OAuth) ───────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true); clearMsg()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getNextPath())}`,
      },
    })
    // On success the browser redirects to Google, so we only land here on error.
    if (error) {
      setMsg({ type: 'error', text: error.message })
      setLoading(false)
    }
  }

  const subtitle =
    view === 'signup' ? t('login.subSignup') :
    view === 'forgot' ? t('login.subForgot') :
    view === 'magic' ? t('login.subMagic') :
    t('login.subSignin')

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md flex justify-end mb-4">
        <LanguageToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface border border-line rounded-2xl p-8 shadow-sm"
      >
        {/* Logo / wordmark */}
        <div className="flex justify-center mb-7">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center mb-1 tracking-tight">T1D Supply Hub</h1>
        <p className="text-muted text-center text-sm mb-7">{subtitle}</p>

        {/* Tab row — only for signin / signup */}
        {(view === 'signin' || view === 'signup') && (
          <div className="flex rounded-xl bg-surface-2 border border-line p-1 mb-6 gap-1">
            <button
              onClick={() => switchView('signin')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                view === 'signin'
                  ? 'bg-surface shadow-sm text-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <LogIn className="w-4 h-4" /> {t('login.signinTab')}
            </button>
            <button
              onClick={() => switchView('signup')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                view === 'signup'
                  ? 'bg-surface shadow-sm text-ink'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <UserPlus className="w-4 h-4" /> {t('login.createTab')}
            </button>
          </div>
        )}

        {/* Back button for sub-views */}
        {(view === 'magic' || view === 'forgot') && (
          <button
            onClick={() => switchView('signin')}
            className="flex items-center gap-1 text-sm text-muted hover:text-ink mb-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <ChevronLeft className="w-4 h-4" /> {t('login.backToSignIn')}
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* ── Sign in ── */}
          {view === 'signin' && (
            <motion.form
              key="signin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSignIn}
              className="space-y-4"
            >
              <div>
                <label htmlFor="si-email" className="block text-sm font-medium text-muted mb-2 ml-1">{t('login.emailLabel')}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-faint pointer-events-none" />
                  <input
                    id="si-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full bg-surface border border-line rounded-xl py-3.5 pl-12 pr-4 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all placeholder:text-faint"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label htmlFor="si-pw" className="text-sm font-medium text-muted">{t('login.passwordLabel')}</label>
                  <button
                    type="button"
                    onClick={() => switchView('forgot')}
                    className="text-xs text-primary hover:text-primary-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  >
                    {t('login.forgotLink')}
                  </button>
                </div>
                <PasswordInput
                  id="si-pw"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                aria-label={t('login.signInBtn')}
                className="w-full bg-primary hover:bg-primary-deep text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /> {t('login.signInBtn')}</>}
              </button>
              <AnimatePresence>{msg && <StatusMsg msg={msg} />}</AnimatePresence>
              <div className="border-t border-line pt-4 text-center">
                <button
                  type="button"
                  onClick={() => switchView('magic')}
                  className="text-sm text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  {t('login.emailMeLink')}
                </button>
              </div>
            </motion.form>
          )}

          {/* ── Create account ── */}
          {view === 'signup' && (
            <motion.form
              key="signup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSignUp}
              className="space-y-4"
            >
              <div>
                <label htmlFor="su-email" className="block text-sm font-medium text-muted mb-2 ml-1">{t('login.emailLabel')}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-faint pointer-events-none" />
                  <input
                    id="su-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full bg-surface border border-line rounded-xl py-3.5 pl-12 pr-4 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all placeholder:text-faint"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="su-pw" className="block text-sm font-medium text-muted mb-2 ml-1">{t('login.passwordLabel')}</label>
                <PasswordInput
                  id="su-pw"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                />
                <p className="text-xs text-faint mt-1.5 ml-1">{t('login.min8')}</p>
              </div>
              <div>
                <label htmlFor="su-confirm" className="block text-sm font-medium text-muted mb-2 ml-1">{t('login.confirmLabel')}</label>
                <PasswordInput
                  id="su-confirm"
                  value={confirm}
                  onChange={setConfirm}
                  placeholder={t('login.confirmPlaceholder')}
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                aria-label={t('login.createBtn')}
                className="w-full bg-primary hover:bg-primary-deep text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><UserPlus className="w-5 h-5" /> {t('login.createBtn')}</>}
              </button>
              <AnimatePresence>{msg && <StatusMsg msg={msg} />}</AnimatePresence>
            </motion.form>
          )}

          {/* ── Magic link (passwordless fallback) ── */}
          {view === 'magic' && (
            <motion.form
              key="magic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleMagicLink}
              className="space-y-4"
            >
              <p className="text-sm text-muted -mt-2">{t('login.magicIntro')}</p>
              <div>
                <label htmlFor="ml-email" className="block text-sm font-medium text-muted mb-2 ml-1">{t('login.emailLabel')}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-faint pointer-events-none" />
                  <input
                    id="ml-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full bg-surface border border-line rounded-xl py-3.5 pl-12 pr-4 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all placeholder:text-faint"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                aria-label={t('login.sendMagic')}
                className="w-full bg-primary hover:bg-primary-deep text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <>{t('login.sendMagic')} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
              </button>
              <AnimatePresence>{msg && <StatusMsg msg={msg} />}</AnimatePresence>
            </motion.form>
          )}

          {/* ── Forgot password ── */}
          {view === 'forgot' && (
            <motion.form
              key="forgot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleForgot}
              className="space-y-4"
            >
              <p className="text-sm text-muted -mt-2">{t('login.forgotIntro')}</p>
              <div>
                <label htmlFor="fp-email" className="block text-sm font-medium text-muted mb-2 ml-1">{t('login.emailLabel')}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-faint pointer-events-none" />
                  <input
                    id="fp-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full bg-surface border border-line rounded-xl py-3.5 pl-12 pr-4 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all placeholder:text-faint"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                aria-label={t('login.sendReset')}
                className="w-full bg-primary hover:bg-primary-deep text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : t('login.sendReset')}
              </button>
              <AnimatePresence>{msg && <StatusMsg msg={msg} />}</AnimatePresence>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Google (OAuth) — shown on sign in / create account */}
        {(view === 'signin' || view === 'signup') && (
          <>
            <div className="flex items-center gap-3 my-5" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-faint">{t('login.or')}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-surface border border-line hover:bg-surface-2 text-ink font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <GoogleIcon className="w-5 h-5" />
              {t('login.continueWithGoogle')}
            </button>
          </>
        )}
      </motion.div>

      <div className="mt-6 flex gap-4 text-faint text-xs">
        <span>{t('login.footerEncrypted')}</span>
        <span className="w-1 h-1 bg-line rounded-full my-auto" />
        <span>{t('login.footerYours')}</span>
      </div>
    </div>
  )
}

/** Google's multicolor "G" mark. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  )
}

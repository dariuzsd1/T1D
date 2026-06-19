'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Loader2, AlertCircle, Lock, Eye, EyeOff,
} from 'lucide-react'

/**
 * /auth/reset — set a new password after clicking a password-reset email link.
 *
 * Flow:
 *   1. User clicks "Forgot password?" on /login → resetPasswordForEmail() is
 *      called with redirectTo = /auth/callback?next=/auth/reset
 *   2. /auth/callback exchanges the recovery code for a session (sets cookies),
 *      then redirects here.
 *   3. This page calls supabase.auth.updateUser({ password }) — allowed because
 *      the session is a "recovery" session, not a full sign-in session.
 *   4. On success, redirect to /dashboard.
 *
 * Not in the proxy matcher, so it's reachable without a regular session.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setMsg({ type: 'error', text: 'Passwords don\'t match.' })
      return
    }
    if (password.length < 8) {
      setMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    setLoading(true)
    setMsg(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: 'Password updated! Taking you to your dashboard…' })
      setTimeout(() => router.push('/dashboard'), 1500)
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface border border-line rounded-2xl p-8 shadow-sm"
      >
        <div className="flex justify-center mb-7">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-1 tracking-tight">Set a new password</h1>
        <p className="text-muted text-center text-sm mb-7">
          Choose a strong password for your T1D Supply Hub account.
        </p>

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label htmlFor="rp-pw" className="block text-sm font-medium text-muted mb-2 ml-1">
              New password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-faint pointer-events-none" />
              <input
                id="rp-pw"
                type={showPw ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full bg-surface border border-line rounded-xl py-3.5 pl-12 pr-12 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all placeholder:text-faint"
              />
              <button
                type="button"
                onClick={() => setShowPw(s => !s)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-faint mt-1.5 ml-1">At least 8 characters.</p>
          </div>

          <div>
            <label htmlFor="rp-confirm" className="block text-sm font-medium text-muted mb-2 ml-1">
              Confirm new password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-faint pointer-events-none" />
              <input
                id="rp-confirm"
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Repeat your password"
                className="w-full bg-surface border border-line rounded-xl py-3.5 pl-12 pr-12 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all placeholder:text-faint"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(s => !s)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-deep text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set new password'}
          </button>

          <AnimatePresence>
            {msg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                role="status"
                className={`p-4 rounded-xl flex items-start gap-3 border ${
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
            )}
          </AnimatePresence>
        </form>
      </motion.div>
    </div>
  )
}

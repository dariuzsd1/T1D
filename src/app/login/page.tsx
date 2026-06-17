'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const supabase = createClient()

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setMessage({ type: 'success', text: 'Magic link sent! Check your inbox for the secure link.' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An unexpected error occurred. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface border border-line rounded-2xl p-8 shadow-sm relative z-10"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2 tracking-tight">T1D Supply Hub</h1>
        <p className="text-muted text-center mb-8">Sign in to keep track of your supplies.</p>

        <form onSubmit={handleMagicLink} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-muted mb-2 ml-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-faint" />
              <input
                id="email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface border border-line rounded-xl py-3.5 pl-12 pr-4 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all placeholder:text-faint"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-deep text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Send magic link
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              role="status"
              className={`mt-6 p-4 rounded-xl flex items-start gap-3 border ${
                message.type === 'success'
                  ? 'bg-success-soft border-success/20 text-success'
                  : 'bg-urgent-soft border-urgent/20 text-urgent'
              }`}
            >
              {message.type === 'success' ? <ShieldCheck className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span className="text-sm font-medium leading-snug">{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-8 text-center text-xs text-faint">
          We'll email you a secure sign-in link — no password needed.
        </p>
      </motion.div>

      <div className="mt-8 flex gap-4 text-faint text-xs">
        <span>Passwordless sign-in</span>
        <span className="w-1 h-1 bg-line rounded-full my-auto" />
        <span>Encrypted in transit</span>
      </div>
    </div>
  )
}

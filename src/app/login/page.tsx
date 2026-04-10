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
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#0D0D0D] border border-white/10 rounded-2xl p-8 shadow-2xl relative z-10"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2 tracking-tight">T1D Supply Hub</h1>
        <p className="text-gray-400 text-center mb-8 font-medium">Secure verification for critical medical supplies.</p>

        <form onSubmit={handleMagicLink} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 ml-1">
              Patient Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                id="email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-gray-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Send Magic Link
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
              className={`mt-6 p-4 rounded-xl flex items-start gap-3 border ${
                message.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {message.type === 'success' ? <ShieldCheck className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span className="text-sm font-medium leading-tight">{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-8 text-center text-xs text-gray-600 font-medium">
          By continuing, you agree to the medical data processing terms.
        </p>
      </motion.div>

      <div className="mt-8 flex gap-6 text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em] relative z-10">
        <span>Precision Tracking</span>
        <span className="w-1 h-1 bg-gray-800 rounded-full my-auto" />
        <span>HIPAA Compliant</span>
        <span className="w-1 h-1 bg-gray-800 rounded-full my-auto" />
        <span>End-to-End Encryption</span>
      </div>
    </div>
  )
}

'use client'

import { useStore } from '@/lib/store'
import { displayStatus } from '@/lib/depletion'
import { AlertTriangle, Clock, ArrowRight, X } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'

export function RiskAlertBanner() {
  const { inventory, safetyBufferDays } = useStore()
  const [dismissed, setDismissed] = useState(false)

  // displayStatus: items with an estimated rate stay out of this banner entirely —
  // an app-wide alarm may only rest on facts (real rate, real 0, real expiry).
  const out = inventory.filter((p) => displayStatus(p, safetyBufferDays) === 'out')
  const low = inventory.filter((p) => displayStatus(p, safetyBufferDays) === 'low')

  if (dismissed || (out.length === 0 && low.length === 0)) return null

  // Red is reserved for a true stockout; routine low-stock uses calm amber (§6).
  const isUrgent = out.length > 0
  const items = isUrgent ? out : low
  const others = items.length - 1

  const tone = isUrgent
    ? 'bg-urgent-soft text-urgent border-urgent/30'
    : 'bg-caution-soft text-caution border-caution/30'

  const message = isUrgent
    ? `You're out of ${items[0].name}${others > 0 ? ` and ${others} other item${others > 1 ? 's' : ''}` : ''} — reorder now.`
    : `${items[0].name} is running low (${items[0].remainingDays} days left)${others > 0 ? `, plus ${others} other item${others > 1 ? 's' : ''}` : ''}.`

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      role="status"
      className={`print:hidden relative z-[100] border-b ${tone}`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {isUrgent ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <Clock className="w-5 h-5 shrink-0" />}
          <p className="text-sm font-medium truncate">{message}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            Review
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss alert"
            className="rounded-full p-1.5 transition-colors hover:bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

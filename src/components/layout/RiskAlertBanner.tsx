'use client'

import { useStore } from '@/lib/store'
import { effectiveLeadTimeDays, daysUntilExpiration } from '@/lib/depletion'
import { itemDisplayStatus, isRescueItem } from '@/lib/rescueItems'
import { isOrderPending } from '@/lib/orderTracking'
import { AlertTriangle, Clock, ArrowRight, X } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n'

export function RiskAlertBanner() {
  const { inventory, safetyBufferDays, shippingLeadTimeDays } = useStore()
  const [dismissed, setDismissed] = useState(false)
  const { t } = useI18n()

  // itemDisplayStatus: items with an estimated rate stay out of this banner
  // entirely — an app-wide alarm may only rest on facts (real rate, real 0, real
  // expiry). Rescue items (glucagon, ketones, hypo) are judged on expiry, and a
  // per-item shipping lead time folds into the reorder trigger. A true stockout
  // always shows regardless of a self-reported order — being at zero is an active
  // emergency even with a box in transit. A routine "low" item already marked as
  // ordered is quieted for a grace window (src/lib/orderTracking.ts).
  const statusOf = (p: (typeof inventory)[number]) =>
    itemDisplayStatus(p, safetyBufferDays, effectiveLeadTimeDays(p, shippingLeadTimeDays))
  // Rescue items lead within each tier — an expired/expiring rescue med is the
  // most important thing on the screen.
  const byRescueFirst = (a: (typeof inventory)[number], b: (typeof inventory)[number]) =>
    Number(isRescueItem(b)) - Number(isRescueItem(a))
  const out = inventory.filter((p) => statusOf(p) === 'out').sort(byRescueFirst)
  const low = inventory
    .filter((p) => statusOf(p) === 'low' && !isOrderPending(p.lastOrderedDate))
    .sort(byRescueFirst)

  if (dismissed || (out.length === 0 && low.length === 0)) return null

  // Red is reserved for a true stockout; routine low-stock uses calm amber (§6).
  const isUrgent = out.length > 0
  const items = isUrgent ? out : low
  const others = items.length - 1
  const head = items[0]
  const headRescue = isRescueItem(head)
  const headExpiryDays = daysUntilExpiration(head.expirationDate)

  const tone = isUrgent
    ? 'bg-urgent-soft text-urgent border-urgent/30'
    : 'bg-caution-soft text-caution border-caution/30'

  // A rescue headline speaks in expiry, not a usage-days count.
  const rescueMessage = isUrgent
    ? (others === 0
        ? t('riskBanner.rescueOutMessage', { name: head.name })
        : t('riskBanner.rescueOutMessagePlus', { name: head.name, count: others }))
    : (others === 0
        ? t('riskBanner.rescueLowMessage', { name: head.name, days: headExpiryDays ?? 0 })
        : t('riskBanner.rescueLowMessagePlus', { name: head.name, days: headExpiryDays ?? 0, count: others }))

  const supplyMessage = isUrgent
    ? (others === 0
        ? t('riskBanner.outMessage', { name: head.name })
        : others === 1
          ? t('riskBanner.outMessagePlusOne', { name: head.name })
          : t('riskBanner.outMessagePlusMany', { name: head.name, count: others }))
    : (others === 0
        ? t('riskBanner.lowMessage', { name: head.name, days: head.remainingDays })
        : others === 1
          ? t('riskBanner.lowMessagePlusOne', { name: head.name, days: head.remainingDays })
          : t('riskBanner.lowMessagePlusMany', { name: head.name, days: head.remainingDays, count: others }))

  const message = headRescue ? rescueMessage : supplyMessage

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
            {t('riskBanner.review')}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            aria-label={t('riskBanner.dismiss')}
            className="rounded-full p-1.5 transition-colors hover:bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

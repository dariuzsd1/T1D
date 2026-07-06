/**
 * "What's Next" agenda — the forward-looking spine of the home page (CLAUDE.md
 * §0/§7: proactive, closes the loop). It answers "what's the next thing I need to
 * do, and when?" using ONLY real stored data.
 *
 * Honesty rule (CLAUDE.md §1/§9.1): every item here is backed by a real date the
 * user (or their refill cycle) actually provides. If the inputs to compute a date
 * are missing, the item is simply omitted — we never invent a plausible-looking
 * date. Pure date logic: no I/O, no React, so it's trivially testable.
 *
 * Deliberately NOT included: "next site/pod change due" — there is no persisted
 * source for it yet (site changes are in-memory only), so surfacing it would mean
 * fabricating a date. It stays out until site_changes is actually loaded.
 */

import { nextEligibleRefillDate } from './refill'
import { isRateEstimated } from './depletion'
import type { Product } from './store'
import type { Appointment } from './appointments'
import type { Prescription } from './prescriptions'

const MS_PER_DAY = 1000 * 60 * 60 * 24

export type AgendaKind = 'refill' | 'appointment' | 'prescription'

export interface AgendaItem {
  key: string
  date: Date
  /** Short, plain, supportive label — e.g. "Reorder Omnipod 5 Pods". */
  label: string
  kind: AgendaKind
  /** Where tapping the row takes the user. */
  href: string
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export interface AgendaInputs {
  inventory: Product[]
  appointments: Appointment[]
  prescriptions: Prescription[]
  now?: Date
}

/**
 * Build the sorted, future-first agenda from real data only. At most one row per
 * category (the soonest), capped at 4 total. Returns [] when nothing is dated —
 * the caller then hides the section rather than showing an empty shell.
 */
export function buildAgenda({
  inventory,
  appointments,
  prescriptions,
  now = new Date(),
}: AgendaInputs): AgendaItem[] {
  const today = startOfDay(now)
  const items: AgendaItem[] = []

  // 1. Refill-eligible (the moat). Requires BOTH a refill interval and a last-fill
  //    date; otherwise the engine returns null and we show nothing. Take the
  //    soonest across items. A date already in the past means "eligible now" →
  //    clamp to today so it reads as actionable, not stale.
  let bestRefill: { date: Date; product: Product } | null = null
  for (const p of inventory) {
    if (!p.refillIntervalDays || p.refillIntervalDays <= 0 || !p.lastFilledDate) continue
    const d = nextEligibleRefillDate(p.lastFilledDate, { supplyDays: p.refillIntervalDays })
    if (!d) continue
    if (!bestRefill || d.getTime() < bestRefill.date.getTime()) bestRefill = { date: d, product: p }
  }
  if (bestRefill) {
    const date = bestRefill.date.getTime() < today.getTime() ? today : bestRefill.date
    items.push({
      key: 'refill',
      date,
      kind: 'refill',
      label: `Reorder ${bestRefill.product.name}`,
      href: '/dashboard/reorder',
    })
  }

  // 2. Next appointment — soonest one that hasn't happened yet.
  const nextAppt = appointments
    .map((a) => ({ a, when: new Date(a.appointmentDate) }))
    .filter((x) => !Number.isNaN(x.when.getTime()) && x.when.getTime() >= today.getTime())
    .sort((x, y) => x.when.getTime() - y.when.getTime())[0]
  if (nextAppt) {
    items.push({
      key: 'appointment',
      date: nextAppt.when,
      kind: 'appointment',
      label: nextAppt.a.title?.trim() || 'Appointment',
      href: '/dashboard/appointments',
    })
  }

  // 3. Next prescription renewal. Two real deadlines feed this:
  //    - the prescription's own expiration date, and
  //    - when the Rx has NO refills left, the run-out date of a linked supply
  //      with a KNOWN rate (running dry with no refills is the renewal cliff —
  //      today + stock÷rate is real math, not a guess; estimates stay out).
  //    Whichever real date is sooner wins. Rx with neither date is skipped.
  const rxCandidates: { p: Prescription; when: Date; viaSupply: string | null }[] = []
  for (const p of prescriptions) {
    let when: Date | null = p.expirationDate ? new Date(p.expirationDate) : null
    if (when && Number.isNaN(when.getTime())) when = null
    let viaSupply: string | null = null
    if (p.refillsRemaining === 0) {
      for (const s of inventory) {
        if (s.prescriptionId !== p.id || isRateEstimated(s.usageRatePerDay)) continue
        const runOut = new Date(today.getTime() + s.remainingDays * MS_PER_DAY)
        if (!when || runOut.getTime() < when.getTime()) {
          when = runOut
          viaSupply = s.name
        }
      }
    }
    if (when && when.getTime() >= today.getTime()) rxCandidates.push({ p, when, viaSupply })
  }
  const nextRx = rxCandidates.sort((x, y) => x.when.getTime() - y.when.getTime())[0]
  if (nextRx) {
    items.push({
      key: 'prescription',
      date: nextRx.when,
      kind: 'prescription',
      label: nextRx.viaSupply
        ? `Renew ${nextRx.p.medicationName} before ${nextRx.viaSupply} runs out`
        : `Renew ${nextRx.p.medicationName}`,
      href: '/dashboard/prescriptions',
    })
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 4)
}

/**
 * A calm, human date label for an agenda row: "Today" / "Tomorrow" / "Jul 14"
 * (with the year appended only when it isn't the current year, so it's never
 * ambiguous but never noisy).
 */
export function formatAgendaDate(date: Date, now: Date = new Date()): string {
  const start = startOfDay(now)
  const target = startOfDay(date)
  const days = Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  const sameYear = target.getFullYear() === start.getFullYear()
  return target.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

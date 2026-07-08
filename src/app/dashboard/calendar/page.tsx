'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Package,
  ArrowRight,
  CalendarCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/ui/BackButton'
import { useStore } from '@/lib/store'
import { useInventory } from '@/lib/useInventory'
import { displayStatus, stockStatus, type StockStatus } from '@/lib/depletion'
import { assessRefill } from '@/lib/refill'
import { reorderTargetFor } from '@/lib/suppliers'
import { useI18n } from '@/lib/i18n'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'

type DayEventKind = 'runout' | 'eligible'

export default function CalendarPage() {
  const { t } = useI18n()
  const { inventory, safetyBufferDays } = useStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  // TanStack Query (shared with Home/Supplies/Reorder): cached + deduplicated,
  // so arriving here from any of those pages reuses the already-fetched data.
  const { isLoading: loading } = useInventory()

  // Per-item forecast: when it runs out (real, from usage) and — when the user
  // has entered a refill cycle — when insurance lets them refill (the moat).
  // Items with no usage rate are 'unset': their run-out date would rest on the
  // fallback guess, so they get no run-out marker or forecast entry (a made-up
  // date on a calendar is exactly what CLAUDE.md §9.1 forbids). Refill-eligible
  // markers stay — those come from real entered dates.
  const items = inventory.map((item) => {
    const rule = item.refillIntervalDays
      ? { supplyDays: item.refillIntervalDays }
      : null
    return {
      item,
      unset: displayStatus(item, safetyBufferDays) === 'unset',
      runOutDate: addDays(new Date(), item.remainingDays),
      status: stockStatus(item.remainingDays, safetyBufferDays),
      assessment: assessRefill(item.remainingDays, item.lastFilledDate, rule),
    }
  })
  const forecastable = items.filter((i) => !i.unset)
  const unsetCount = items.length - forecastable.length

  // Flatten into calendar markers. Refill-eligible markers only appear for items
  // that actually have a refill cycle — nothing is fabricated (CLAUDE.md §9.1).
  const events: { date: Date; name: string; kind: DayEventKind; status: StockStatus }[] = []
  for (const { item, unset, runOutDate, status, assessment } of items) {
    if (!unset) events.push({ date: runOutDate, name: item.name, kind: 'runout', status })
    if (assessment.eligibleDate) {
      events.push({ date: assessment.eligibleDate, name: item.name, kind: 'eligible', status })
    }
  }

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  })
  const startDay = startOfMonth(currentDate).getDay()
  const emptyDays = Array.from({ length: startDay })

  const runoutTone: Record<StockStatus, string> = {
    out: 'bg-urgent-soft border-urgent/30 text-urgent',
    low: 'bg-caution-soft border-caution/30 text-caution',
    ok: 'bg-primary/10 border-primary/20 text-primary',
  }
  const eligibleTone = 'bg-teal/10 border-teal/30 text-teal'

  return (
    <div className="max-w-6xl mx-auto space-y-10" aria-busy={loading}>
      <BackButton />
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">{t('calendar.kicker')}</h2>
          <h1 className="text-3xl font-bold tracking-tight text-ink">{t('calendar.title')}</h1>
        </div>
        <div className="flex bg-surface border border-line rounded-xl overflow-hidden p-1">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            aria-label={t('calendar.prevMonth')}
            className="p-2.5 hover:bg-surface-2 rounded-lg transition-colors text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-5 py-2.5 font-semibold text-sm flex items-center min-w-[150px] justify-center text-ink">
            {format(currentDate, 'MMMM yyyy')}
          </div>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            aria-label={t('calendar.nextMonth')}
            className="p-2.5 hover:bg-surface-2 rounded-lg transition-colors text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs font-medium text-muted -mt-4">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-caution" /> {t('calendar.legendRunsOut')}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal" /> {t('calendar.legendRefillEligible')}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Calendar Grid */}
        <div className="xl:col-span-3">
          <div className="bg-surface border border-line rounded-3xl p-5 sm:p-8 shadow-sm">
            <div className="grid grid-cols-7 mb-4">
              {(['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat'] as const).map((day) => (
                <div key={day} className="text-center text-xs font-semibold uppercase tracking-wide text-faint">
                  {t(`calendar.${day}`)}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-line rounded-xl overflow-hidden">
              {emptyDays.map((_, i) => <div key={`empty-${i}`} className="h-24 sm:h-28 bg-surface" />)}

              {daysInMonth.map((day, i) => {
                const dayEvents = events.filter((e) => isSameDay(e.date, day))
                const isToday = isSameDay(day, new Date())

                return (
                  <div
                    key={i}
                    className={cn(
                      'h-24 sm:h-28 bg-surface p-2 relative transition-colors hover:bg-surface-2',
                      isToday && 'bg-primary/5 ring-1 ring-inset ring-primary/30'
                    )}
                  >
                    <span className={cn('text-xs font-semibold tabular-nums', isToday ? 'text-primary' : 'text-faint')}>
                      {format(day, 'd')}
                    </span>

                    <div className="mt-1.5 space-y-1">
                      {dayEvents.slice(0, 2).map((ev, j) => (
                        <div
                          key={j}
                          className={cn(
                            'p-1 rounded-md text-[11px] font-medium leading-tight border',
                            ev.kind === 'eligible' ? eligibleTone : runoutTone[ev.status]
                          )}
                        >
                          <div className="flex items-center gap-1 truncate">
                            {ev.kind === 'eligible'
                              ? <CalendarCheck className="w-3 h-3 shrink-0" />
                              : <AlertCircle className="w-3 h-3 shrink-0" />}
                            <span className="truncate">{ev.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Forecast Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted px-1">{t('calendar.upcoming')}</h3>

          {loading && items.length === 0 && (
            <div className="animate-pulse space-y-3" aria-hidden="true">
              <div className="h-20 bg-surface-2 rounded-2xl" />
              <div className="h-20 bg-surface-2 rounded-2xl" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="text-sm text-faint px-1">{t('calendar.emptyBody')}</p>
          )}

          {!loading && items.length > 0 && forecastable.length === 0 && (
            <p className="text-sm text-faint px-1">
              {t('calendar.noForecast')}
            </p>
          )}

          {[...forecastable]
            .sort((a, b) => a.runOutDate.getTime() - b.runOutDate.getTime())
            .map(({ item, runOutDate, status, assessment }, idx) => {
              const reorder = reorderTargetFor(item)
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-surface border border-line rounded-2xl p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center border shrink-0',
                      status === 'ok' ? 'bg-surface-2 border-line text-muted' : runoutTone[status]
                    )}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-faint mb-0.5">{format(runOutDate, 'EEE, MMM d, yyyy')}</p>
                      <h4 className="font-semibold text-sm text-ink">{t('calendar.runsOut', { name: item.name })}</h4>

                      {/* Refill-window reconciliation (the moat). Only shows with a cycle. */}
                      {assessment.state !== 'unknown' && (
                        <p className={cn(
                          'mt-1.5 text-xs font-medium',
                          assessment.state === 'gap' ? 'text-urgent'
                            : assessment.state === 'eligible-now' ? 'text-teal'
                            : 'text-muted'
                        )}>
                          {assessment.message}
                        </p>
                      )}

                      <a
                        href={reorder.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:gap-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                      >
                        {reorder.isDirect ? t('common.reorderVia', { label: reorder.label }) : t('common.findSupplier')}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              )
            })}

          <div className="bg-surface-2 rounded-2xl p-4 border border-line">
            <p className="text-xs text-faint leading-relaxed">
              {t('calendar.footNote')}
              {unsetCount > 0 &&
                t(unsetCount === 1 ? 'calendar.unsetNoteOne' : 'calendar.unsetNoteOther', { count: unsetCount })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

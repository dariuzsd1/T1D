'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Package,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { stockStatus, type StockStatus } from '@/lib/depletion'
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

export default function CalendarPage() {
  const { inventory, safetyBufferDays } = useStore()
  const [currentDate, setCurrentDate] = useState(new Date())

  // Real forecast events from inventory. Urgency is the honest stock status
  // (red only for a true stockout, amber for low) — no fabricated severity.
  const forecastEvents = inventory.map((item) => ({
    date: addDays(new Date(), item.remainingDays),
    name: item.name,
    status: stockStatus(item.remainingDays, safetyBufferDays),
  }))

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  })

  const startDay = startOfMonth(currentDate).getDay()
  const emptyDays = Array.from({ length: startDay })

  const eventTone: Record<StockStatus, string> = {
    out: 'bg-urgent-soft border-urgent/30 text-urgent',
    low: 'bg-caution-soft border-caution/30 text-caution',
    ok: 'bg-primary/10 border-primary/20 text-primary',
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Refill forecast</h2>
          <h1 className="text-3xl font-bold tracking-tight text-ink">When your supplies run out</h1>
        </div>
        <div className="flex bg-surface border border-line rounded-xl overflow-hidden p-1">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            aria-label="Previous month"
            className="p-2.5 hover:bg-surface-2 rounded-lg transition-colors text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-5 py-2.5 font-semibold text-sm flex items-center min-w-[150px] justify-center text-ink">
            {format(currentDate, 'MMMM yyyy')}
          </div>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            aria-label="Next month"
            className="p-2.5 hover:bg-surface-2 rounded-lg transition-colors text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Calendar Grid */}
        <div className="xl:col-span-3">
          <div className="bg-surface border border-line rounded-3xl p-5 sm:p-8 shadow-sm">
            <div className="grid grid-cols-7 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-xs font-semibold uppercase tracking-wide text-faint">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-line rounded-xl overflow-hidden">
              {emptyDays.map((_, i) => <div key={`empty-${i}`} className="h-24 sm:h-28 bg-surface" />)}

              {daysInMonth.map((day, i) => {
                const dayEvent = forecastEvents.find((e) => isSameDay(e.date, day))
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

                    {dayEvent && (
                      <div className={cn('mt-2 p-1.5 rounded-lg text-xs font-medium leading-tight border', eventTone[dayEvent.status])}>
                        <div className="flex items-center gap-1 truncate">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span className="truncate">{dayEvent.name}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Forecast Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted px-1">Upcoming run-outs</h3>

          {forecastEvents.length === 0 && (
            <p className="text-sm text-faint px-1">Add supplies to see when they'll run out.</p>
          )}

          {[...forecastEvents]
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map((event, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-surface border border-line rounded-2xl p-5 group"
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center border shrink-0',
                    event.status === 'ok' ? 'bg-surface-2 border-line text-muted' : eventTone[event.status]
                  )}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-faint mb-0.5">{format(event.date, 'EEE, MMM d, yyyy')}</p>
                    <h4 className="font-semibold text-sm text-ink">{event.name} runs out</h4>
                    <button className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary hover:gap-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                      Reorder
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

          <div className="bg-surface-2 rounded-2xl p-4 border border-line">
            <p className="text-xs text-faint leading-relaxed">
              Forecasts use your current usage rate and improve as you log supplies.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

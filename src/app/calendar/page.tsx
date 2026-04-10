'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Package,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns'

export default function CalendarPage() {
  const { inventory } = useStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Calculate real forecast events from inventory
  const forecastEvents = inventory.map(item => ({
    date: addDays(new Date(), item.remainingDays),
    type: 'exhaust' as const,
    name: item.name,
    urgency: item.remainingDays < 7 ? 'critical' as const : 'stable' as const
  }))

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  })

  // Simple calendar grid helpers
  const startDay = startOfMonth(currentDate).getDay()
  const emptyDays = Array.from({ length: startDay })

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] mb-2">Refill Forecasting</h2>
          <h1 className="text-4xl font-black tracking-tight">Supply Lifecycle</h1>
        </div>
        <div className="flex bg-[#0D0D0D] border border-white/10 rounded-xl overflow-hidden p-1">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-3 hover:bg-white/5 transition-all text-gray-500 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-6 py-3 font-black text-xs uppercase tracking-widest flex items-center min-w-[140px] justify-center">
            {format(currentDate, 'MMMM yyyy')}
          </div>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-3 hover:bg-white/5 transition-all text-gray-500 hover:text-white">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-12">
        {/* Calendar Grid */}
        <div className="xl:col-span-3">
          <div className="bg-[#0D0D0D] border border-white/10 rounded-[40px] p-10 overflow-hidden shadow-2xl">
            {/* Week Headers */}
            <div className="grid grid-cols-7 mb-8">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-gray-600">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-white/5">
              {emptyDays.map((_, i) => <div key={`empty-${i}`} className="h-32 bg-[#0D0D0D]" />)}
              
              {daysInMonth.map((day, i) => {
                const dayEvent = FORECAST_EVENTS.find(e => isSameDay(e.date, day))
                
                return (
                  <motion.div 
                    key={i} 
                    whileHover={{ scale: 1.02 }}
                    className={cn(
                      "h-32 bg-[#0D0D0D] p-3 border border-white/5 relative group transition-colors hover:bg-white/[0.02]",
                      isSameDay(day, new Date()) && "bg-blue-600/5 ring-1 ring-blue-500/20"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-bold tabular-nums",
                      isSameDay(day, new Date()) ? "text-blue-400" : "text-gray-600"
                    )}>
                      {format(day, 'd')}
                    </span>

                    {dayEvent && (
                      <div className={cn(
                        "mt-3 p-2 rounded-lg text-[9px] font-black uppercase tracking-tighter leading-tight border transition-all",
                        dayEvent.urgency === 'critical' 
                          ? "bg-red-500/20 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
                          : dayEvent.urgency === 'warning'
                          ? "bg-amber-500/20 border-amber-500/30 text-amber-500"
                          : "bg-blue-500/20 border-blue-500/30 text-blue-400"
                      )}>
                        <div className="flex items-center gap-1.5 truncate">
                          {dayEvent.type === 'exhaust' ? <AlertCircle className="w-2.5 h-2.5" /> : <Package className="w-2.5 h-2.5" />}
                          {dayEvent.name}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Forecast Details */}
        <div className="space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 px-2">Refill Roadmap</h3>
          
          {FORECAST_EVENTS.map((event, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-[#0D0D0D] border border-white/10 rounded-3xl p-6 relative overflow-hidden group"
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center border",
                  event.urgency === 'critical' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white/5 border-white/10 text-gray-500'
                )}>
                  {event.type === 'exhaust' ? <AlertCircle className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{format(event.date, 'MMM d, yyyy')}</p>
                    {event.urgency === 'critical' && <span className="text-[8px] font-black text-red-500 uppercase px-1.5 py-0.5 border border-red-500/30 rounded">Urgent</span>}
                  </div>
                  <h4 className="font-bold text-sm tracking-tight">{event.name} Will Run Out</h4>
                  <button className="mt-4 flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest group-hover:gap-3 transition-all">
                    Order Replacement
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          <div className="bg-white/5 rounded-3xl p-6 border border-white/5 opacity-40">
            <p className="text-[10px] font-medium text-gray-500 leading-relaxed uppercase tracking-widest">
              Forecasts are based on real-time usage rates. Accuracy improves with every confirmed scan.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Map, MapPin, RefreshCcw, Info, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const SITES = [
  { id: 'abdomen-tl', label: 'Top Left Abdomen', lastUsed: '2 days ago', health: 'Optimal', pos: { x: '35%', y: '45%' } },
  { id: 'abdomen-tr', label: 'Top Right Abdomen', lastUsed: '7 days ago', health: 'Optimal', pos: { x: '65%', y: '45%' } },
  { id: 'thigh-l', label: 'Left Thigh', lastUsed: 'Recently used', health: 'Resting', pos: { x: '30%', y: '75%' } },
  { id: 'thigh-r', label: 'Right Thigh', lastUsed: '5 days ago', health: 'Optimal', pos: { x: '70%', y: '75%' } },
  { id: 'arm-l', label: 'Left Arm', lastUsed: '12 days ago', health: 'Optimal', pos: { x: '15%', y: '35%' } },
  { id: 'arm-r', label: 'Right Arm', lastUsed: '3 days ago', health: 'Optimal', pos: { x: '85%', y: '35%' } },
]

export default function SiteTrackerPage() {
  const { siteLogs, addSiteLog } = useStore()
  const [selectedSite, setSelectedSite] = useState<typeof SITES[0] | null>(null)
  
  const handleMarkUsed = () => {
    if (selectedSite) {
      addSiteLog({
        id: Math.random().toString(36).substr(2, 9),
        siteId: selectedSite.id,
        timestamp: new Date().toISOString()
      })
      alert(`Site ${selectedSite.label} logged. Rotate to a new site in 3 days.`)
    }
  }

  // Find the site that was used LEAST recently (or never used)
  const suggestedSite = SITES.reduce((prev, current) => {
    const lastLogPrev = siteLogs.find(l => l.siteId === prev.id)
    const lastLogCurrent = siteLogs.find(l => l.siteId === current.id)
    
    if (!lastLogCurrent) return current
    if (!lastLogPrev) return prev
    
    return new Date(lastLogPrev.timestamp) < new Date(lastLogCurrent.timestamp) ? prev : current
  }, SITES[0])

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] mb-2">Lipohypertrophy Prevention</h2>
          <h1 className="text-4xl font-black tracking-tight">Injection Sites</h1>
        </div>
        <button className="bg-white/5 border border-white/10 px-6 py-4 rounded-xl font-bold flex items-center gap-2 hover:bg-white/10 transition-all">
          <RefreshCcw className="w-5 h-5" />
          Update History
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 pt-8">
        {/* Human Body Map */}
        <div className="lg:col-span-2 relative flex justify-center bg-[#0D0D0D] border border-white/10 rounded-[40px] p-12 overflow-hidden min-h-[600px]">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500 via-transparent to-transparent" />
          </div>

          <div className="relative w-full max-w-sm">
            <svg viewBox="0 0 100 120" className="w-full h-full fill-white/5 stroke-white/10 stroke-[0.2]">
              <path d="M50 5 C55 5, 60 10, 60 15 C60 20, 55 25, 50 25 C45 25, 40 20, 40 15 C40 10, 45 5, 50 5 
                M40 25 L35 30 C30 35, 25 45, 25 55 L22 80 L28 80 L30 55 C32 50, 40 45, 50 45 C60 45, 68 50, 70 55 L72 80 L78 80 L75 55 C75 45, 70 35, 65 30 L60 25 Z
                M40 80 L35 115 L45 115 L48 85 C49 83, 51 83, 52 85 L55 115 L65 115 L60 80 Z" 
              />
            </svg>

            {SITES.map((site) => {
              const lastUsed = siteLogs.find(l => l.siteId === site.id)
              return (
                <motion.button
                  key={site.id}
                  whileHover={{ scale: 1.2 }}
                  onClick={() => setSelectedSite(site)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group"
                  style={{ left: site.pos.x, top: site.pos.y }}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 transition-all",
                    site.id === suggestedSite.id 
                      ? "bg-blue-500 border-white shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse" 
                      : lastUsed 
                        ? "bg-red-500 border-white/40"
                        : "bg-black border-white/20 group-hover:border-white group-hover:bg-blue-500/50"
                  )} />
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-blue-600 rounded-3xl p-8 shadow-[0_0_40px_rgba(37,99,235,0.2)]">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-2 opacity-80">Next Suggested</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xl font-black">{suggestedSite.label}</h4>
                <p className="text-xs font-bold opacity-80 uppercase tracking-widest">
                  {siteLogs.find(l => l.siteId === suggestedSite.id) ? 'Rotated' : 'Fresh Site'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => { setSelectedSite(suggestedSite); handleMarkUsed(); }}
              className="w-full bg-white text-blue-600 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2 leading-none"
            >
              Mark as Used
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {selectedSite ? (
              <motion.div
                key={selectedSite.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0D0D0D] border border-white/10 rounded-3xl p-8"
              >
                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">Site Analysis</h3>
                
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-medium">Site Health</span>
                    <span className="text-emerald-400 font-black flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      {selectedSite.health}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-medium">Last Usage</span>
                    <span className="text-white font-bold">{selectedSite.lastUsed}</span>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex gap-3">
                    <Info className="w-4 h-4 text-gray-600 mt-1" />
                    <p className="text-[10px] text-gray-500 leading-relaxed uppercase tracking-wider font-bold">
                      Rotate sites at least 1 inch apart from previous injection.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-48 border border-white/5 rounded-3xl flex items-center justify-center text-center p-8 opacity-40 italic text-sm text-gray-600">
                Select a site on the map to view detailed analytics.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

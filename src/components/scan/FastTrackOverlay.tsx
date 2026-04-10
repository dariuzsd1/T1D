'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Zap, ArrowRight, Edit3 } from 'lucide-react'
import { ScanResult } from '@/lib/store'

interface FastTrackOverlayProps {
  result: ScanResult;
  onConfirm: () => void;
  onManualEdit: () => void;
}

export function FastTrackOverlay({ result, onConfirm, onManualEdit }: FastTrackOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#050505] border border-emerald-500/30 rounded-[40px] p-10 shadow-[0_0_80px_rgba(16,185,129,0.15)] max-w-lg w-full text-center relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
      
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
          <Zap className="w-10 h-10 text-emerald-400 fill-emerald-400/20" />
        </div>
      </div>

      <div className="space-y-2 mb-10">
        <h2 className="text-3xl font-black tracking-tight">High Confidence Match</h2>
        <p className="text-gray-400 font-medium tracking-tight">AI verified your supply with {result.confidence}% accuracy.</p>
      </div>

      <div className="bg-white/5 rounded-3xl p-6 mb-10 border border-white/5">
        <h3 className="text-2xl font-black text-white">{result.product_name}</h3>
        <p className="text-xs font-black text-emerald-500 uppercase tracking-widest mt-1">{result.brand} Verified</p>
      </div>

      <div className="space-y-4">
        <button
          onClick={onConfirm}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black text-lg shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-3 active:scale-95"
        >
          Instant Add
          <ArrowRight className="w-6 h-6" />
        </button>
        
        <button
          onClick={onManualEdit}
          className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] hover:text-white transition-all flex items-center justify-center gap-2 mx-auto"
        >
          <Edit3 className="w-3.5 h-3.5" />
          I want to edit manually
        </button>
      </div>
    </motion.div>
  )
}

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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-surface border border-success/30 rounded-3xl p-10 shadow-sm max-w-lg w-full text-center relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-success" />

      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 bg-success-soft rounded-full flex items-center justify-center border border-success/20">
          <Zap className="w-10 h-10 text-success" />
        </div>
      </div>

      <div className="space-y-2 mb-10">
        <h2 className="text-2xl font-bold tracking-tight text-ink">Confident match</h2>
        <p className="text-muted">Matched to the catalog with {result.confidence}% confidence.</p>
      </div>

      <div className="bg-surface-2 rounded-3xl p-6 mb-10 border border-line">
        <h3 className="text-2xl font-bold text-ink">{result.product_name}</h3>
        <p className="text-xs font-semibold text-success uppercase tracking-widest mt-1">{result.brand}</p>
      </div>

      <div className="space-y-4">
        <button
          onClick={onConfirm}
          className="w-full bg-success hover:brightness-95 text-white py-4 rounded-2xl font-semibold text-lg transition-all flex items-center justify-center gap-3 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-success"
        >
          Add to inventory
          <ArrowRight className="w-6 h-6" />
        </button>

        <button
          onClick={onManualEdit}
          className="text-xs font-semibold text-muted uppercase tracking-[0.15em] hover:text-ink transition-colors flex items-center justify-center gap-2 mx-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Edit details first
        </button>
      </div>
    </motion.div>
  )
}

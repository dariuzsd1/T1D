'use client'

import { useStore } from "@/lib/store";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";

export function RiskAlertBanner() {
  const { inventory } = useStore();
  const [isVisible, setIsVisible] = useState(true);
  
  const criticalItems = inventory.filter(p => p.remainingDays < 3);

  if (criticalItems.length === 0 || !isVisible) return null;

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="bg-red-600 text-white relative z-[100] border-b border-red-500 shadow-[0_4px_20px_rgba(239,68,68,0.3)]"
    >
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black/20 rounded-lg flex items-center justify-center animate-pulse">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="font-black text-xs uppercase tracking-widest mr-2 underline decoration-black/30 underline-offset-4">Critical Shortage:</span>
            <span className="text-sm font-bold tracking-tight">
              {criticalItems[0].name} has only {criticalItems[0].remainingDays} days remaining. 
              {criticalItems.length > 1 && ` (+${criticalItems.length - 1} other items)`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard"
            className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-50 transition-all leading-none"
          >
            Fix Now
            <ArrowRight className="w-3 h-3" />
          </Link>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

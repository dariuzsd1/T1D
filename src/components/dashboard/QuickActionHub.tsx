'use client'

import { useState } from 'react'
import { Plus, Package, Scan, RefreshCcw } from 'lucide-react'
import { useStore } from '@/lib/store'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export function QuickActionHub() {
  const [isOpen, setIsOpen] = useState(false)
  const { inventory, updateProduct } = useStore()

  const handleManualDeplete = async (brand: string) => {
    const item = inventory.find(p => p.brand?.toLowerCase().includes(brand.toLowerCase()))
    if (item && item.quantity > 0) {
      await updateProduct(item.id, { quantity: item.quantity - 1 })
      setIsOpen(false)
    }
  }

  const actions = [
    { 
      label: 'Pod Change', 
      icon: RefreshCcw, 
      onClick: () => handleManualDeplete('Insulet'),
      color: 'bg-emerald-600',
      sub: '-1 Pod & Reset rotation'
    },
    { 
      label: 'Quick Scan', 
      icon: Scan, 
      href: '/scan',
      color: 'bg-blue-600',
      sub: 'AI Recognition'
    },
    { 
      label: 'Update G6', 
      icon: Package, 
      onClick: () => handleManualDeplete('Dexcom'),
      color: 'bg-amber-600',
      sub: '-1 Sensor'
    },
  ]

  return (
    <div className="fixed bottom-8 right-8 z-[110]">
      <AnimatePresence>
        {isOpen && (
          <div className="flex flex-col-reverse gap-4 mb-6 items-end">
            {actions.map((action, idx) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 20 }}
                transition={{ delay: idx * 0.05 }}
              >
                {action.href ? (
                  <Link href={action.href} className="flex items-center gap-4 group">
                    <div className="text-right">
                      <p className="text-xs font-black text-white uppercase tracking-widest">{action.label}</p>
                      <p className="text-[10px] text-gray-500 font-bold">{action.sub}</p>
                    </div>
                    <div className={`${action.color} p-4 rounded-2xl shadow-xl transition-transform active:scale-95 group-hover:scale-105 border border-white/20`}>
                      <action.icon className="w-6 h-6 text-white" />
                    </div>
                  </Link>
                ) : (
                  <button onClick={action.onClick} className="flex items-center gap-4 group">
                    <div className="text-right">
                      <p className="text-xs font-black text-white uppercase tracking-widest">{action.label}</p>
                      <p className="text-[10px] text-gray-500 font-bold">{action.sub}</p>
                    </div>
                    <div className={`${action.color} p-4 rounded-2xl shadow-xl transition-transform active:scale-95 group-hover:scale-105 border border-white/20`}>
                      <action.icon className="w-6 h-6 text-white" />
                    </div>
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "bg-white p-5 rounded-[24px] shadow-2xl flex items-center justify-center transition-all",
          isOpen ? "bg-red-500 rotate-45" : "bg-blue-600"
        )}
      >
        <Plus className={cn("w-8 h-8 transition-colors", isOpen ? "text-white" : "text-white")} />
      </motion.button>
    </div>
  )
}

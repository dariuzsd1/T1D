'use client'

import { useState } from 'react'
import { Plus, Package, Scan, RefreshCcw } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useToast } from '@/components/ui/Toast'
import { logActivity } from '@/lib/activity'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export function QuickActionHub() {
  const [isOpen, setIsOpen] = useState(false)
  const { inventory, updateProduct } = useStore()
  const { showToast } = useToast()

  const handleManualDeplete = async (brand: string, label: string) => {
    const item = inventory.find((p) => p.brand?.toLowerCase().includes(brand.toLowerCase()))
    if (!item) {
      showToast(`No ${label} in your inventory yet.`, 'info')
    } else if (item.quantity > 0) {
      try {
        await updateProduct(item.id, { quantity: item.quantity - 1 })
        void logActivity('supply_used', item.name)
        showToast(`Logged one ${item.name}. ${item.quantity - 1} left.`, 'success')
      } catch (err) {
        console.error('Failed to log usage:', err)
        showToast(`Couldn't save that. ${item.name} is unchanged.`, 'caution')
      }
    } else {
      showToast(`You're out of ${item.name}.`, 'caution')
    }
    setIsOpen(false)
  }

  const actions = [
    {
      label: 'Pod change',
      sub: '−1 pod',
      icon: RefreshCcw,
      onClick: () => handleManualDeplete('Insulet', 'pods'),
      color: 'bg-teal',
    },
    {
      label: 'Scan a supply',
      sub: 'Add to inventory',
      icon: Scan,
      href: '/scan',
      color: 'bg-primary',
    },
    {
      label: 'Log sensor',
      sub: '−1 sensor',
      icon: Package,
      onClick: () => handleManualDeplete('Dexcom', 'sensors'),
      color: 'bg-primary-deep',
    },
  ]

  return (
    <div className="fixed bottom-20 right-5 lg:bottom-8 lg:right-8 z-[110]">
      <AnimatePresence>
        {isOpen && (
          <div className="flex flex-col-reverse gap-3 mb-4 items-end">
            {actions.map((action, idx) => {
              const inner = (
                <>
                  <span className="rounded-xl bg-surface border border-line px-3 py-2 shadow-sm text-right">
                    <span className="block text-xs font-semibold text-ink">{action.label}</span>
                    <span className="block text-[11px] text-faint">{action.sub}</span>
                  </span>
                  <span className={cn(action.color, 'p-3.5 rounded-2xl shadow-md transition-transform active:scale-95 group-hover:scale-105')}>
                    <action.icon className="w-5 h-5 text-white" />
                  </span>
                </>
              )
              return (
                <motion.div
                  key={action.label}
                  initial={{ opacity: 0, scale: 0.9, x: 12 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 12 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  {action.href ? (
                    <Link href={action.href} className="flex items-center gap-3 group">{inner}</Link>
                  ) : (
                    <button onClick={action.onClick} className="flex items-center gap-3 group">{inner}</button>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={isOpen}
        className={cn(
          'p-4 rounded-2xl shadow-lg flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
          isOpen ? 'bg-ink rotate-45' : 'bg-primary'
        )}
      >
        <Plus className="w-7 h-7 text-white" />
      </motion.button>
    </div>
  )
}

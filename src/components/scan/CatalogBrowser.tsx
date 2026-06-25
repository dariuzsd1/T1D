'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X, ChevronRight, ChevronLeft, Loader2,
  Activity, Zap, Droplets, Pen, Droplet,
  TestTube2, FlaskConical, AlertCircle, Heart, Shield, Package,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useDialog } from '@/lib/useDialog'

export interface CatalogItem {
  product_name: string
  brand: string | null
  category: string | null
  units_per_box: number | null
  // Verified per-unit usage rate (e.g. 0.143/day for a 7-day sensor). Present only
  // for wear-duration items; blank for per-person-consumption items (insulin, strips).
  typical_usage_per_day: number | null
  default_refill_interval_days: number | null
  gtin: string | null
}

interface CatalogGroup {
  category: string
  products: CatalogItem[]
}

interface CategoryMeta {
  label: string
  Icon: LucideIcon
  iconClass: string
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  cgm_sensor:     { label: 'CGM Sensors',         Icon: Activity,     iconClass: 'text-primary bg-primary/10' },
  patch_pump:     { label: 'Pumps & Pods',         Icon: Zap,          iconClass: 'text-teal bg-teal/10' },
  infusion_set:   { label: 'Infusion Sets',        Icon: Droplets,     iconClass: 'text-sky-500 bg-sky-50' },
  mdi_supply:     { label: 'Pens & Needles',       Icon: Pen,          iconClass: 'text-violet-500 bg-violet-50' },
  insulin:        { label: 'Insulin',              Icon: Droplet,      iconClass: 'text-cyan-600 bg-cyan-50' },
  bg_supply:      { label: 'Blood Glucose',        Icon: TestTube2,    iconClass: 'text-rose-500 bg-rose-50' },
  ketone_supply:  { label: 'Ketone Testing',       Icon: FlaskConical, iconClass: 'text-amber-500 bg-amber-50' },
  glucagon:       { label: 'Emergency Glucagon',   Icon: AlertCircle,  iconClass: 'text-urgent bg-urgent-soft' },
  hypo_treatment: { label: 'Hypo Treatments',      Icon: Heart,        iconClass: 'text-pink-500 bg-pink-50' },
  skin_care:      { label: 'Skin Care',            Icon: Shield,       iconClass: 'text-success bg-success-soft' },
  other:          { label: 'Other Supplies',       Icon: Package,      iconClass: 'text-muted bg-surface-2' },
}

function getMeta(category: string): CategoryMeta {
  return CATEGORY_META[category] ?? { label: category, Icon: Package, iconClass: 'text-muted bg-surface-2' }
}

interface Props {
  onSelect: (item: CatalogItem) => void
  onClose: () => void
}

export function CatalogBrowser({ onSelect, onClose }: Props) {
  const [groups, setGroups] = useState<CatalogGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState<CatalogGroup | null>(null)

  const handleClose = () => {
    setActiveGroup(null)
    onClose()
  }

  const dialogRef = useDialog<HTMLDivElement>(handleClose)

  useEffect(() => {
    fetch('/api/products/catalog')
      .then(r => r.json())
      .then(setGroups)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const activeMeta = activeGroup ? getMeta(activeGroup.category) : null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={activeGroup ? activeMeta!.label : 'Browse supply catalog'}
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-canvas flex flex-col focus:outline-none"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-line shrink-0">
        {activeGroup ? (
          <button
            onClick={() => setActiveGroup(null)}
            aria-label="Back to categories"
            className="p-2 -ml-1 rounded-xl hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft className="w-5 h-5 text-ink" />
          </button>
        ) : (
          <div className="w-9 shrink-0" />
        )}
        <h2 className="flex-1 text-base font-semibold text-ink text-center truncate">
          {activeGroup ? activeMeta!.label : 'Browse catalog'}
        </h2>
        <button
          onClick={handleClose}
          aria-label="Close catalog"
          className="p-2 -mr-1 rounded-xl hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="w-5 h-5 text-ink" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {!activeGroup ? (
              <motion.div
                key="categories"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.16 }}
                className="grid grid-cols-2 gap-3 p-4"
              >
                {groups.map(group => {
                  const { label, Icon, iconClass } = getMeta(group.category)
                  return (
                    <button
                      key={group.category}
                      onClick={() => setActiveGroup(group)}
                      className="bg-surface border border-line rounded-2xl p-4 text-left hover:border-primary/40 hover:shadow-sm active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconClass}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-ink text-sm leading-tight">{label}</p>
                      <p className="text-faint text-xs mt-0.5">{group.products.length} products</p>
                    </button>
                  )
                })}
              </motion.div>
            ) : (
              <motion.div
                key={activeGroup.category}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.16 }}
                className="divide-y divide-line"
              >
                {activeGroup.products.map((product, i) => (
                  <button
                    key={i}
                    onClick={() => onSelect(product)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-surface-2 active:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink text-sm leading-snug">{product.product_name}</p>
                      {product.brand && (
                        <p className="text-muted text-xs mt-0.5">{product.brand}</p>
                      )}
                      {product.units_per_box != null && (
                        <p className="text-faint text-xs">{product.units_per_box} per box</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-faint shrink-0" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

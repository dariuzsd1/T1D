'use client'

import { Product } from "@/lib/store";
import { RefillStatusBar } from "./RefillStatusBar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Package, Trash2, Edit3, ShoppingCart, Minus, Loader2,
  CalendarClock, ChevronDown, PackagePlus,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  stockStatus,
  reorderByDate,
  daysUntilExpiration,
  isRateEstimated,
  DEFAULT_SAFETY_BUFFER_DAYS,
} from "@/lib/depletion";
import { reorderTargetFor } from "@/lib/suppliers";
import { logActivity } from "@/lib/activity";
import { format } from "date-fns";

interface ProductCardProps {
  product: Product;
  bufferDays?: number;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onUpdate?: (id: string, updates: Partial<Product>) => Promise<void>;
  onOrder?: (name: string) => void;
}

export function ProductCard({
  product,
  bufferDays = DEFAULT_SAFETY_BUFFER_DAYS,
  onEdit,
  onDelete,
  onUpdate,
  onOrder,
}: ProductCardProps) {
  // Semantic color: red is reserved for a true stockout; routine low stock is amber.
  const status = stockStatus(product.remainingDays, bufferDays)

  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRestocking, setIsRestocking] = useState(false)
  const { showToast } = useToast()
  // Items that need attention open by default; well-stocked ones stay tidy.
  const [expanded, setExpanded] = useState(status !== 'ok')

  const tone =
    status === 'out'
      ? { dot: 'bg-urgent', number: 'text-urgent', iconBg: 'bg-urgent-soft border-urgent/30', icon: 'text-urgent', btn: 'bg-urgent text-white' }
      : status === 'low'
      ? { dot: 'bg-caution', number: 'text-caution', iconBg: 'bg-caution-soft border-caution/30', icon: 'text-caution', btn: 'bg-caution text-white' }
      : { dot: 'bg-success', number: 'text-ink', iconBg: 'bg-primary/10 border-primary/20', icon: 'text-primary', btn: 'bg-primary text-white' }

  const reorderBy = reorderByDate(product.remainingDays, bufferDays)
  const expiryDays = daysUntilExpiration(product.expirationDate)
  const reorder = reorderTargetFor(product)

  // When the user hasn't set a real daily usage, the runway is a conservative
  // estimate — say so plainly rather than presenting a guess as fact (CLAUDE.md §9).
  const estimated = isRateEstimated(product.usageRatePerDay)

  const statusLabel =
    status === 'out' ? 'Out of stock' : status === 'low' ? 'Reorder soon' : 'Well stocked'

  // One honest detail line: stock on hand · runway · when to reorder.
  const daysPhrase = estimated
    ? `~${product.remainingDays} days (estimate)`
    : `${product.remainingDays} days`
  const summary =
    status === 'out'
      ? 'Out of stock — reorder now'
      : `${product.quantity} on hand · ${daysPhrase} · reorder by ${format(reorderBy, 'EEE, MMM d')}`

  const handleUseOne = async () => {
    if (product.quantity > 0) {
      setIsUpdating(true)
      try {
        await onUpdate?.(product.id, { quantity: product.quantity - 1 })
        void logActivity('supply_used', product.name)
      } catch (err) {
        console.error('Failed to update:', err)
      } finally {
        setIsUpdating(false)
      }
    }
  }

  // "Reorder = re-add": after a box arrives, restock in one tap. We add a full box
  // on top of what's left — the box size comes from the catalog (matched by name),
  // falling back to 1 when the product isn't known rather than guessing a count.
  const handleRestock = async () => {
    setIsRestocking(true)
    try {
      let boxSize = 1
      try {
        const res = await fetch(`/api/scan/lookup?name=${encodeURIComponent(product.name)}`)
        if (res.ok) {
          const cat = await res.json()
          if (cat?.units_per_box && cat.units_per_box > 0) boxSize = cat.units_per_box
        }
      } catch {
        // Lookup is best-effort; a miss just means a box of 1.
      }
      await onUpdate?.(product.id, { quantity: product.quantity + boxSize })
      void logActivity('supply_restocked', product.name)
      showToast(`Restocked ${product.name}: +${boxSize}.`, 'success')
    } catch (err) {
      console.error('Failed to restock:', err)
      showToast('Could not restock. Please try again.', 'caution')
    } finally {
      setIsRestocking(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete?.(product.id)
    } catch (err) {
      console.error('Failed to delete:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const panelId = `supply-detail-${product.id}`

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-surface border-line hover:border-primary/30 transition-colors overflow-hidden">
        <CardContent className="p-0">
          {/* Collapsed glance — name, status, days. Tap to reveal detail + actions.
              The quick "use one" button sits alongside (not inside) the toggle so a
              user can log usage in one tap without opening the card. */}
          <div className="flex items-center">
            <button
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              aria-controls={panelId}
              className="flex-1 min-w-0 flex items-center gap-4 p-5 text-left transition-colors hover:bg-surface-2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center border shrink-0", tone.iconBg)}>
                <Package className={cn("w-5 h-5", tone.icon)} />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-ink leading-tight truncate">{product.name}</h3>
                <p className="text-sm text-muted truncate">
                  {product.brand ? `${product.brand} · ` : ''}{statusLabel}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className={cn("text-2xl font-black tabular-nums leading-none", tone.number)}>
                  {estimated ? '~' : ''}{product.remainingDays}
                </div>
                <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mt-0.5">
                  {estimated ? 'est. days' : 'days'}
                </div>
              </div>

              <ChevronDown
                className={cn(
                  "w-5 h-5 text-faint transition-transform shrink-0",
                  expanded && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>

            {/* One-tap "use one" — log usage without expanding the card first */}
            <button
              onClick={handleUseOne}
              disabled={isUpdating || product.quantity === 0}
              aria-label={`Use one ${product.name}`}
              title={product.quantity === 0 ? 'None on hand' : 'Log one used'}
              className="shrink-0 mr-4 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-line bg-surface-2 text-ink transition-colors hover:bg-line active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
            </button>
          </div>

          {/* Expanded detail + actions */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                id={panelId}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 pt-1 space-y-4 border-t border-line">
                  {/* Usage rate + edit hand-off */}
                  <div className="flex items-center gap-1.5 pt-3 text-xs text-muted">
                    <span
                      className={cn(
                        "inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
                        estimated
                          ? "bg-caution-soft text-caution border border-caution/30"
                          : "bg-success-soft text-success border border-success/30"
                      )}
                    >
                      {estimated ? 'Estimate' : 'Tracked'}
                    </span>
                    <span>
                      {estimated ? 'Usage rate not set' : `${Math.round(product.usageRatePerDay * 10) / 10}/day`}
                    </span>
                    <span aria-hidden="true">·</span>
                    <button
                      onClick={() => onEdit?.(product.id)}
                      aria-label={estimated ? `Set usage rate for ${product.name}` : `Edit usage rate for ${product.name}`}
                      className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                    >
                      {estimated ? 'Set rate' : 'Edit'}
                    </button>
                  </div>

                  {/* Honest one-line summary */}
                  <p className="text-sm text-muted font-medium">{summary}</p>

                  {/* Expiration + FEFO guidance (use oldest first) */}
                  {expiryDays !== null && (
                    <p className={cn(
                      "flex items-center gap-1.5 text-xs font-medium",
                      expiryDays <= 0 ? "text-urgent" : expiryDays <= 30 ? "text-caution" : "text-muted"
                    )}>
                      <CalendarClock className="w-3.5 h-3.5" />
                      {expiryDays <= 0
                        ? `Expired ${format(new Date(product.expirationDate!), 'MMM d, yyyy')} — do not use`
                        : `Expires ${format(new Date(product.expirationDate!), 'MMM d, yyyy')} · use oldest first`}
                    </p>
                  )}

                  <div className="bg-surface-2 rounded-xl p-4 border border-line">
                    <RefillStatusBar daysRemaining={product.remainingDays} bufferDays={bufferDays} estimated={estimated} />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleUseOne}
                      disabled={isUpdating || product.quantity === 0}
                      aria-label={`Use one ${product.name}`}
                      className={cn(
                        "flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-xs font-semibold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
                        tone.btn
                      )}
                    >
                      {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Minus className="w-3.5 h-3.5" />}
                      Use one
                    </button>

                    <button
                      onClick={handleRestock}
                      disabled={isRestocking}
                      aria-label={`Restock ${product.name}`}
                      title="Add a box (after a reorder arrives)"
                      className="flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-xs font-semibold uppercase tracking-widest bg-surface-2 hover:bg-line border border-line text-ink transition-colors active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {isRestocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackagePlus className="w-3.5 h-3.5" />}
                      Restock
                    </button>

                    <a
                      href={reorder.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onOrder?.(reorder.label)}
                      className="flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-xs font-semibold uppercase tracking-widest bg-surface-2 hover:bg-line border border-line text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Reorder
                    </a>

                    <div className="ml-auto flex gap-1">
                      <button
                        onClick={() => onEdit?.(product.id)}
                        className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center hover:bg-surface-2 rounded-lg text-faint hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`Edit ${product.name}`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center hover:bg-urgent-soft rounded-lg text-faint hover:text-urgent transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-urgent"
                        aria-label={`Delete ${product.name}`}
                      >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

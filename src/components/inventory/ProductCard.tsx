import { Product } from "@/lib/store";
import { RefillStatusBar } from "./RefillStatusBar";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Trash2, Edit3, ShoppingCart, Minus, Loader2, CalendarClock } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  stockStatus,
  reorderByDate,
  daysUntilExpiration,
  DEFAULT_SAFETY_BUFFER_DAYS,
} from "@/lib/depletion";
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
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Semantic color: red is reserved for a true stockout; routine low stock is amber.
  const status = stockStatus(product.remainingDays, bufferDays)
  const tone =
    status === 'out'
      ? { number: 'text-red-500', iconBg: 'bg-red-500/20 border-red-500/40', icon: 'text-red-400', btn: 'bg-red-500 text-white' }
      : status === 'low'
      ? { number: 'text-amber-400', iconBg: 'bg-amber-500/15 border-amber-500/30', icon: 'text-amber-400', btn: 'bg-amber-500 text-white' }
      : { number: 'text-white', iconBg: 'bg-blue-500/10 border-blue-500/20', icon: 'text-blue-400', btn: 'bg-blue-600 text-white' }

  const reorderBy = reorderByDate(product.remainingDays, bufferDays)
  const expiryDays = daysUntilExpiration(product.expirationDate)

  // One honest sentence: stock on hand · runway · when to reorder.
  const summary =
    status === 'out'
      ? 'Out of stock — reorder now'
      : `${product.quantity} on hand · ~${product.remainingDays} days · reorder by ${format(reorderBy, 'EEE, MMM d')}`

  const handleUseOne = async () => {
    if (product.quantity > 0) {
      setIsUpdating(true)
      try {
        await onUpdate?.(product.id, { quantity: product.quantity - 1 })
      } catch (err) {
        console.error('Failed to update:', err)
      } finally {
        setIsUpdating(false)
      }
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="bg-[#0D0D0D] border-white/10 hover:border-blue-500/30 transition-all overflow-hidden group">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex gap-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border transition-colors", tone.iconBg)}>
                <Package className={cn("w-6 h-6", tone.icon)} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">{product.name}</h3>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-1">{product.brand}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className={cn("text-6xl font-black tabular-nums tracking-tighter leading-none", tone.number)}>
                {product.remainingDays}
              </span>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-[0.2em] mt-1">Days remaining</span>
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleUseOne}
                disabled={isUpdating || product.quantity === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50",
                  tone.btn
                )}
              >
                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Minus className="w-3 h-3" />}
                Use one
              </button>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit?.(product.id)}
                  className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                  aria-label={`Edit ${product.name}`}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                  aria-label={`Delete ${product.name}`}
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Honest one-line summary: stock · runway · reorder-by */}
          <p className="text-sm text-gray-400 font-medium mb-2">{summary}</p>

          {/* Expiration + FEFO guidance (use oldest first) */}
          {expiryDays !== null && (
            <p className={cn(
              "flex items-center gap-1.5 text-xs font-medium mb-4",
              expiryDays <= 0 ? "text-red-400" : expiryDays <= 30 ? "text-amber-400" : "text-gray-500"
            )}>
              <CalendarClock className="w-3.5 h-3.5" />
              {expiryDays <= 0
                ? `Expired ${format(new Date(product.expirationDate!), 'MMM d, yyyy')} — do not use`
                : `Expires ${format(new Date(product.expirationDate!), 'MMM d, yyyy')} · use oldest first`}
            </p>
          )}

          <div className="bg-black/40 rounded-xl p-4 border border-white/5 mb-6">
            <RefillStatusBar daysRemaining={product.remainingDays} bufferDays={bufferDays} />
          </div>

          <button
            onClick={() => onOrder?.(product.name)}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2 group-hover:border-blue-500/30"
          >
            <ShoppingCart className="w-4 h-4" />
            Reorder
          </button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

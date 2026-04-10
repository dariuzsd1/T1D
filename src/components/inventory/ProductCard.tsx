import { Product } from "@/lib/store";
import { RefillStatusBar } from "./RefillStatusBar";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Trash2, Edit3, ShoppingCart, Minus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ProductCardProps {
  product: Product;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onUpdate?: (id: string, updates: Partial<Product>) => Promise<void>;
  onOrder?: (name: string) => void;
}

export function ProductCard({ product, onEdit, onDelete, onUpdate, onOrder }: ProductCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center border transition-colors",
                product.remainingDays < 7 
                  ? "bg-red-500/20 border-red-500/40" 
                  : "bg-blue-500/10 border-blue-500/20"
              )}>
                <Package className={cn("w-6 h-6", product.remainingDays < 7 ? "text-red-400" : "text-blue-400")} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">{product.name}</h3>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">{product.brand}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col">
              <span className={cn(
                "text-6xl font-black tabular-nums tracking-tighter leading-none",
                product.remainingDays < 7 ? "text-red-500" : "text-white"
              )}>
                {product.remainingDays}
              </span>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mt-1">Days Remaining</span>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <button 
                onClick={handleUseOne}
                disabled={isUpdating || product.quantity === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50",
                  product.remainingDays < 7 
                    ? "bg-red-500 text-white shadow-[0_5px_15px_rgba(239,68,68,0.3)]" 
                    : "bg-blue-600 text-white"
                )}
              >
                {isUpdating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                Use One
              </button>
              
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => onEdit?.(product.id)}
                  className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                  aria-label="Edit product"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                  aria-label="Delete product"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-black/40 rounded-xl p-4 border border-white/5 mb-6">
            <RefillStatusBar daysRemaining={product.remainingDays} />
          </div>

          <button 
            onClick={() => onOrder?.(product.name)}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2 group-hover:border-blue-500/30"
          >
            <ShoppingCart className="w-4 h-4" />
            Quick Order Refill
          </button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

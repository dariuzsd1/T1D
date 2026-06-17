'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useStore } from "@/lib/store";
import { ProductCard } from "@/components/inventory/ProductCard";
import { EditProductModal } from "@/components/inventory/EditProductModal";
import { stockStatus } from "@/lib/depletion";
import { useToast } from "@/components/ui/Toast";
import { Plus, TrendingDown, PackageCheck } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { inventory, setInventory, updateProduct, removeProduct, safetyBufferDays } = useStore();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingProduct = inventory.find((p) => p.id === editingId) ?? null

  const handleOrder = (name: string) =>
    showToast(`Reorder for ${name} isn't connected yet — coming in a later update.`, 'info')
  
  // Fetch inventory on mount
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/inventory')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const result = await response.json()
        setInventory(result.data || [])
        setError(null)
      } catch (err: any) {
        console.error('Failed to fetch inventory:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()
  }, [])
  
  // Most urgent first. "Needs attention" = anything that would dip below the
  // user's safety buffer (their reserve), not just items at literal zero.
  const sortedInventory = [...inventory].sort((a, b) => a.remainingDays - b.remainingDays);

  const needsAttention = sortedInventory.filter(p => stockStatus(p.remainingDays, safetyBufferDays) !== 'ok');
  const stableItems = sortedInventory.filter(p => stockStatus(p.remainingDays, safetyBufferDays) === 'ok');

  return (
    <div className="space-y-12">
      {/* Header Section */}
      <section className="flex justify-between items-end">
        <div>
          <h2 className="text-muted text-xs font-semibold uppercase tracking-[0.2em] mb-2">Your supplies</h2>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Supply overview</h1>
        </div>

        <Link
          href="/scan"
          className="bg-primary hover:bg-primary-deep text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          <Plus className="w-5 h-5" />
          Add supply
        </Link>
      </section>

      {/* Loading State */}
      {loading && (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-surface-2 rounded w-32 mx-auto" />
            <div className="h-8 bg-surface-2 rounded w-24 mx-auto" />
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-urgent-soft border border-urgent/30 rounded-2xl p-6">
          <p className="text-urgent font-semibold mb-2">Failed to load inventory</p>
          <p className="text-urgent/80 text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && inventory.length === 0 && (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center space-y-4">
          <p className="text-muted font-medium">No supplies tracked yet</p>
          <Link
            href="/scan"
            className="inline-block bg-primary hover:bg-primary-deep text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add your first supply
          </Link>
        </div>
      )}

      {/* Stats Summary */}
      {!loading && <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-caution-soft border border-caution/20 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <TrendingDown className="w-24 h-24 text-caution" />
          </div>
          <p className="text-caution text-[11px] font-semibold uppercase tracking-widest leading-none mb-4">Reorder soon</p>
          <h3 className="text-5xl font-black text-ink tabular-nums">{needsAttention.length}</h3>
          <p className="text-sm text-caution/90 font-medium mt-2">
            {needsAttention.length > 0
              ? `Would drop below your ${safetyBufferDays}-day reserve`
              : `Everything is comfortably stocked`}
          </p>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-6 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <PackageCheck className="w-24 h-24 text-primary" />
          </div>
          <p className="text-muted text-[11px] font-semibold uppercase tracking-widest leading-none mb-4">Tracked supplies</p>
          <h3 className="text-5xl font-black text-ink tabular-nums">{inventory.length}</h3>
          <p className="text-sm text-muted font-medium mt-2">Items you're keeping an eye on</p>
        </div>
      </section>}

      {/* NEEDS ATTENTION */}
      {!loading && needsAttention.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-caution rounded-full" />
            <h2 className="text-base font-semibold tracking-wide text-caution">Reorder soon</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {needsAttention.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                bufferDays={safetyBufferDays}
                onUpdate={updateProduct}
                onDelete={removeProduct}
                onOrder={handleOrder}
                onEdit={setEditingId}
              />
            ))}
          </div>
        </section>
      )}

      {/* STABLE SECTION */}
      {!loading && stableItems.length > 0 && (
        <section className="space-y-6 pt-12 border-t border-line">
          <h2 className="text-base font-semibold tracking-wide text-muted">Well stocked</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {stableItems.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                bufferDays={safetyBufferDays}
                onUpdate={updateProduct}
                onDelete={removeProduct}
                onOrder={handleOrder}
                onEdit={setEditingId}
              />
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {editingProduct && (
          <EditProductModal
            product={editingProduct}
            onClose={() => setEditingId(null)}
            onUpdate={updateProduct}
            onSaved={(name) => showToast(`Updated ${name}.`, 'success')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
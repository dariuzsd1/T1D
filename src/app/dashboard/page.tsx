'use client'

import { useEffect, useState } from 'react'
import { useStore } from "@/lib/store";
import { ProductCard } from "@/components/inventory/ProductCard";
import { stockStatus } from "@/lib/depletion";
import { useToast } from "@/components/ui/Toast";
import { Plus, TrendingDown, PackageCheck } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { inventory, setInventory, updateProduct, removeProduct, safetyBufferDays } = useStore();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-[0.2em] mb-2">Your supplies</h2>
          <h1 className="text-3xl font-bold tracking-tight">Supply overview</h1>
        </div>
        
        <Link 
          href="/scan"
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-4 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)]"
        >
          <Plus className="w-5 h-5" />
          Add Supply
        </Link>
      </section>

      {/* Loading State */}
      {loading && (
        <div className="bg-[#0D0D0D] border border-white/10 rounded-2xl p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-white/10 rounded w-32 mx-auto" />
            <div className="h-8 bg-white/10 rounded w-24 mx-auto" />
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
          <p className="text-red-400 font-bold mb-2">Failed to load inventory</p>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && inventory.length === 0 && (
        <div className="bg-[#0D0D0D] border border-white/10 rounded-2xl p-12 text-center space-y-4">
          <p className="text-gray-500 font-bold">No supplies tracked yet</p>
          <Link 
            href="/scan"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add Your First Supply
          </Link>
        </div>
      )}

      {/* Stats Summary */}
      {!loading && <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
            <TrendingDown className="w-24 h-24 text-amber-500" />
          </div>
          <p className="text-amber-400 text-[11px] font-semibold uppercase tracking-widest leading-none mb-4">Reorder soon</p>
          <h3 className="text-5xl font-black text-white">{needsAttention.length}</h3>
          <p className="text-sm text-amber-200/80 font-medium mt-2">
            {needsAttention.length > 0
              ? `Would drop below your ${safetyBufferDays}-day reserve`
              : `Everything is comfortably stocked`}
          </p>
        </div>
        <div className="bg-[#0D0D0D] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
           <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
            <PackageCheck className="w-24 h-24 text-blue-500" />
          </div>
          <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-widest leading-none mb-4">Tracked supplies</p>
          <h3 className="text-5xl font-black text-white">{inventory.length}</h3>
          <p className="text-sm text-gray-500 font-medium mt-2">Items you're keeping an eye on</p>
        </div>
      </section>}

      {/* NEEDS ATTENTION */}
      {!loading && needsAttention.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            <h2 className="text-base font-semibold tracking-wide text-amber-400">Reorder soon</h2>
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
              />
            ))}
          </div>
        </section>
      )}

      {/* STABLE SECTION */}
      {!loading && stableItems.length > 0 && (
        <section className="space-y-6 pt-12 border-t border-white/5">
          <h2 className="text-base font-semibold tracking-wide text-gray-400">Well stocked</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {stableItems.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                bufferDays={safetyBufferDays}
                onUpdate={updateProduct}
                onDelete={removeProduct}
                onOrder={handleOrder}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
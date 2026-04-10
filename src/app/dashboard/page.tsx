'use client'

import { useEffect, useState } from 'react'
import { useStore } from "@/lib/store";
import { ProductCard } from "@/components/inventory/ProductCard";
import { Plus, Search, Filter, TrendingDown, PackageCheck } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const { inventory, setInventory, updateProduct, removeProduct } = useStore();
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
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
  
  // Risk-First Sorting: Most urgent items first
  const sortedInventory = [...inventory].sort((a, b) => a.remainingDays - b.remainingDays);
  
  const criticalItems = sortedInventory.filter(p => p.remainingDays < 7);
  const stableItems = sortedInventory.filter(p => p.remainingDays >= 7);

  return (
    <div className="space-y-12">
      {/* Header Section */}
      <section className="flex justify-between items-end">
        <div>
          <h2 className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] mb-2">Triage Dashboard</h2>
          <h1 className="text-4xl font-black tracking-tight">Supply Risk Analysis</h1>
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
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-red-500/40 transition-all">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
            <TrendingDown className="w-24 h-24 text-red-500" />
          </div>
          <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest leading-none mb-4">Critical Shortages</p>
          <h3 className="text-5xl font-black text-white">{criticalItems.length}</h3>
          <p className="text-sm text-red-300 font-medium mt-2">
            {criticalItems.length > 0 
              ? `Requires immediate replenishment action` 
              : `All supplies are currently stable`}
          </p>
        </div>
        <div className="bg-[#0D0D0D] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
           <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
            <PackageCheck className="w-24 h-24 text-blue-500" />
          </div>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest leading-none mb-4">Inventory Health</p>
          <h3 className="text-5xl font-black text-white">{inventory.length}</h3>
          <p className="text-sm text-gray-500 font-medium mt-2">Active medical products tracked</p>
        </div>
      </section>}

      {/* CRITICAL SECTION */}
      {!loading && criticalItems.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
            <h2 className="text-lg font-black uppercase tracking-widest text-red-500">Urgent Depletion</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {criticalItems.map((item) => (
              <ProductCard 
                key={item.id} 
                product={item} 
                onUpdate={updateProduct}
                onDelete={removeProduct}
                onOrder={(name) => alert(`Ordering refill for ${name}...`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* STABLE SECTION */}
      {!loading && stableItems.length > 0 && (
        <section className="space-y-6 pt-12 border-t border-white/5">
          <h2 className="text-lg font-black uppercase tracking-widest text-gray-600">Stable Inventory</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {stableItems.map((item) => (
              <ProductCard 
                key={item.id} 
                product={item} 
                onUpdate={updateProduct}
                onDelete={removeProduct}
                onOrder={(name) => alert(`Ordering refill for ${name}...`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
import { create } from 'zustand'
import { createClient } from './supabase/client'
import {
  effectiveRunwayDays,
  DEFAULT_SAFETY_BUFFER_DAYS,
} from './depletion'

export interface Product {
  id: string;
  brand: string;
  name: string;
  category: string;
  quantity: number;
  remainingDays: number;
  lastScanned: string;
  usageRatePerDay: number;
  expirationDate?: string | null;
}

export interface ScanResult {
  product_name: string | null;
  brand: string | null;
  confidence: number;
  alternatives: any[];
}

export interface SiteLog {
  id: string;
  siteId: string;
  timestamp: string;
  notes?: string;
}

/** Always derive the headline runway from quantity/usage/expiry so it stays honest
 *  and responds to "Use One" / restock actions. */
function withRunway(product: Product): Product {
  return { ...product, remainingDays: effectiveRunwayDays(product) }
}

interface T1DStore {
  inventory: Product[];
  activeScan: ScanResult | null;
  isScanning: boolean;
  siteLogs: SiteLog[];
  safetyBufferDays: number;

  // Actions
  setInventory: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  setActiveScan: (result: ScanResult | null) => void;
  setScanning: (status: boolean) => void;
  addSiteLog: (log: SiteLog) => void;
  setSafetyBufferDays: (days: number) => void;
}

// NOTE: no `persist` middleware. Inventory and site logs are PHI; the dashboard
// re-fetches them from Supabase (the source of truth) on mount, so caching them
// unencrypted in localStorage (where they'd survive logout) is an unnecessary risk.
export const useStore = create<T1DStore>()((set) => ({
  inventory: [],
  activeScan: null,
  isScanning: false,
  siteLogs: [],
  safetyBufferDays: DEFAULT_SAFETY_BUFFER_DAYS,

  setInventory: (inventory) =>
    set({ inventory: inventory.map(withRunway) }),

  addProduct: (product) => set((state) => ({
    inventory: [...state.inventory, withRunway(product)]
  })),

  updateProduct: async (id, updates) => {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('supplies')
        .update({
          quantity: updates.quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (!error) {
        set((state) => ({
          inventory: state.inventory.map(p =>
            p.id === id ? withRunway({ ...p, ...updates }) : p
          )
        }))
      }
    } catch (err) {
      console.error('Failed to update product:', err)
    }
  },

  removeProduct: async (id) => {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('supplies')
        .delete()
        .eq('id', id)

      if (!error) {
        set((state) => ({
          inventory: state.inventory.filter(p => p.id !== id)
        }))
      }
    } catch (err) {
      console.error('Failed to remove product:', err)
    }
  },

  setActiveScan: (activeScan) => set({ activeScan }),
  setScanning: (isScanning) => set({ isScanning }),
  addSiteLog: (log) => set((state) => ({
    siteLogs: [log, ...state.siteLogs]
  })),
  setSafetyBufferDays: (safetyBufferDays) => set({ safetyBufferDays }),
}))

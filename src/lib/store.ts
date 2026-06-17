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
  // Insurance refill cycle (powers the refill-window engine, src/lib/refill.ts).
  // Optional until the DB columns land — see docs/REFILL_RULES_MIGRATION.md.
  refillIntervalDays?: number | null;
  lastFilledDate?: string | null;
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

/** localStorage key for the only thing we cache locally: the non-PHI safety buffer. */
export const SAFETY_BUFFER_KEY = 't1d-safety-buffer'

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
      // Only send the columns that actually changed so an expiration edit
      // doesn't clobber quantity (or vice-versa).
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (updates.quantity !== undefined) payload.quantity = updates.quantity
      if (updates.expirationDate !== undefined)
        payload.expiration_date = updates.expirationDate

      const { error } = await supabase
        .from('supplies')
        .update(payload)
        .eq('id', id)

      if (error) {
        console.error('Failed to update product:', error)
        return
      }

      // Refill-cycle columns are optional until docs/REFILL_RULES_MIGRATION.md is
      // applied. Write them separately and best-effort so a "column does not
      // exist" error can never break the core quantity/expiration save above.
      if (
        updates.refillIntervalDays !== undefined ||
        updates.lastFilledDate !== undefined
      ) {
        const refillPayload: Record<string, unknown> = {}
        if (updates.refillIntervalDays !== undefined)
          refillPayload.refill_interval_days = updates.refillIntervalDays
        if (updates.lastFilledDate !== undefined)
          refillPayload.last_filled_date = updates.lastFilledDate

        const { error: refillError } = await supabase
          .from('supplies')
          .update(refillPayload)
          .eq('id', id)

        if (refillError) {
          console.warn(
            'Refill cycle not saved — run docs/REFILL_RULES_MIGRATION.md:',
            refillError.message
          )
        }
      }

      set((state) => ({
        inventory: state.inventory.map(p =>
          p.id === id ? withRunway({ ...p, ...updates }) : p
        )
      }))
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
  setSafetyBufferDays: (safetyBufferDays) => {
    // The buffer is a non-PHI UI preference, so it's safe to remember locally
    // (PHI like inventory/site logs is still never persisted). PreferencesHydrator
    // re-applies this after mount to avoid any SSR/client hydration mismatch.
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SAFETY_BUFFER_KEY, String(safetyBufferDays))
    }
    set({ safetyBufferDays })
  },
}))

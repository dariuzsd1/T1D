import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createClient } from './supabase/client'

export interface Product {
  id: string;
  brand: string;
  name: string;
  category: string;
  quantity: number;
  remainingDays: number;
  lastScanned: string;
  usageRatePerDay: number;
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

interface T1DStore {
  inventory: Product[];
  activeScan: ScanResult | null;
  isScanning: boolean;
  siteLogs: SiteLog[];
  
  // Actions
  setInventory: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  setActiveScan: (result: ScanResult | null) => void;
  setScanning: (status: boolean) => void;
  addSiteLog: (log: SiteLog) => void;
}

export const useStore = create<T1DStore>()(
  persist(
    (set) => ({
      inventory: [],
      activeScan: null,
      isScanning: false,
      siteLogs: [],

      setInventory: (inventory) => set({ inventory }),
      
      addProduct: (product) => set((state) => ({ 
        inventory: [...state.inventory, product] 
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
                p.id === id ? { ...p, ...updates } : p
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
    }),
    {
      name: 't1d-supply-storage',
    }
  )
)

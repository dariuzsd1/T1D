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
  // The user's real daily usage. 0/absent means "not set yet" → the runway is a
  // conservative ESTIMATE (see isRateEstimated in depletion.ts), labelled as such.
  usageRatePerDay: number;
  expirationDate?: string | null;
  // Insurance refill cycle (powers the refill-window engine, src/lib/refill.ts).
  // refillIntervalDays = dispensed days-supply; the rule kind + its one param
  // (threshold % for 'percent', days-before for 'days_before') model how the
  // plan opens its refill window. Optional until the DB columns land.
  refillIntervalDays?: number | null;
  lastFilledDate?: string | null;
  refillRuleKind?: string | null;
  refillThresholdPct?: number | null;
  refillDaysBefore?: number | null;
  // Out-of-pocket copay per refill (cost & savings layer, src/lib/cost.ts).
  copay?: number | null;
  // The device this consumable feeds (pump/CGM), if any. Optional until the
  // device_id column lands via supabase/setup.sql — see src/lib/devices.ts.
  deviceId?: string | null;
  // The prescription that covers this supply, if any (powers the runway ↔
  // refills-left reconciliation, src/lib/prescriptions.ts rxSupplyStatus).
  prescriptionId?: string | null;
  // Insulin in-use clock (src/lib/depletion.ts inUseDaysRemaining): when the
  // current vial/pen was opened and its discard window (usually 28 days).
  openedDate?: string | null;
  inUseDays?: number | null;
  // Reorder-loop tracking (src/lib/orderTracking.ts): when the user last tapped
  // "Mark as ordered" on this supply. Self-reported, softens proactive nags for
  // a grace window — never hides a true stockout, never fabricates a delivery date.
  lastOrderedDate?: string | null;
}

/** Raw `supplies` row shape as read from Supabase (snake_case), scoped to just
 *  the columns /api/inventory and the caregiver inventory route map into a
 *  Product. Both routes `select('*')`, so extra DB columns are simply ignored
 *  by this type — it only needs to describe what's actually read. */
export interface SupplyRow {
  id: string;
  brand: string | null;
  name: string;
  quantity: number;
  updated_at: string | null;
  usage_rate_per_day: number | null;
  expiration_date: string | null;
  refill_interval_days: number | null;
  last_filled_date: string | null;
  refill_rule_kind: string | null;
  refill_threshold_pct: number | null;
  refill_days_before: number | null;
  copay: number | null;
  device_id: string | null;
  prescription_id: string | null;
  opened_date: string | null;
  in_use_days: number | null;
  last_ordered_date: string | null;
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
  safetyBufferDays: number;

  // Actions
  setInventory: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  setSafetyBufferDays: (days: number) => void;
}

// NOTE: no `persist` middleware. Inventory is PHI; the dashboard re-fetches it
// from Supabase (the source of truth) on mount, so caching it unencrypted in
// localStorage (where it'd survive logout) is an unnecessary risk. Site-change
// history is likewise read straight from Supabase by the rotation-map page.
export const useStore = create<T1DStore>()((set) => ({
  inventory: [],
  safetyBufferDays: DEFAULT_SAFETY_BUFFER_DAYS,

  setInventory: (inventory) =>
    set({ inventory: inventory.map(withRunway) }),

  addProduct: (product) => set((state) => ({
    inventory: [...state.inventory, withRunway(product)]
  })),

  updateProduct: async (id, updates) => {
    const supabase = createClient()

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

    // A failed core write must reach the caller — the UI may never report
    // success (or update local state) for a save that didn't happen.
    if (error) throw new Error(error.message)

    // Optional columns (usage rate + refill cycle) are added by supabase/setup.sql.
    // Write them separately and best-effort so a "column does not exist" error
    // on an un-migrated DB can never break the core quantity/expiration save above.
    if (
      updates.usageRatePerDay !== undefined ||
      updates.refillIntervalDays !== undefined ||
      updates.lastFilledDate !== undefined ||
      updates.refillRuleKind !== undefined ||
      updates.refillThresholdPct !== undefined ||
      updates.refillDaysBefore !== undefined ||
      updates.copay !== undefined ||
      updates.deviceId !== undefined ||
      updates.prescriptionId !== undefined ||
      updates.openedDate !== undefined ||
      updates.inUseDays !== undefined ||
      updates.lastOrderedDate !== undefined
    ) {
      const optionalPayload: Record<string, unknown> = {}
      if (updates.usageRatePerDay !== undefined)
        // Store NULL (not 0) when cleared so it reads back as "estimate".
        optionalPayload.usage_rate_per_day =
          updates.usageRatePerDay > 0 ? updates.usageRatePerDay : null
      if (updates.refillIntervalDays !== undefined)
        optionalPayload.refill_interval_days = updates.refillIntervalDays
      if (updates.lastFilledDate !== undefined)
        optionalPayload.last_filled_date = updates.lastFilledDate
      if (updates.refillRuleKind !== undefined)
        optionalPayload.refill_rule_kind = updates.refillRuleKind || null
      if (updates.refillThresholdPct !== undefined)
        optionalPayload.refill_threshold_pct =
          updates.refillThresholdPct && updates.refillThresholdPct > 0 ? updates.refillThresholdPct : null
      if (updates.refillDaysBefore !== undefined)
        optionalPayload.refill_days_before =
          updates.refillDaysBefore != null && updates.refillDaysBefore >= 0 ? updates.refillDaysBefore : null
      if (updates.copay !== undefined)
        // NULL when cleared so it's simply not counted (never $0 fabricated).
        optionalPayload.copay = updates.copay && updates.copay > 0 ? updates.copay : null
      if (updates.deviceId !== undefined)
        // NULL when unlinked. Best-effort like the others (column may be pre-migration).
        optionalPayload.device_id = updates.deviceId || null
      if (updates.prescriptionId !== undefined)
        optionalPayload.prescription_id = updates.prescriptionId || null
      if (updates.openedDate !== undefined)
        optionalPayload.opened_date = updates.openedDate || null
      if (updates.inUseDays !== undefined)
        optionalPayload.in_use_days = updates.inUseDays && updates.inUseDays > 0 ? updates.inUseDays : null
      if (updates.lastOrderedDate !== undefined)
        // NULL clears it — set on "Mark as ordered", cleared on undo or on restock.
        optionalPayload.last_ordered_date = updates.lastOrderedDate || null

      const { error: optionalError } = await supabase
        .from('supplies')
        .update(optionalPayload)
        .eq('id', id)

      if (optionalError) {
        console.warn(
          'Usage rate / refill cycle not saved — run supabase/setup.sql:',
          optionalError.message
        )
      }
    }

    set((state) => ({
      inventory: state.inventory.map(p =>
        p.id === id ? withRunway({ ...p, ...updates }) : p
      )
    }))
  },

  removeProduct: async (id) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('supplies')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)

    set((state) => ({
      inventory: state.inventory.filter(p => p.id !== id)
    }))
  },

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

/**
 * Database type definitions for T1D Supply Hub
 * Matches Supabase schema exactly
 */

export type UUID = string;

export interface SupplyCategory {
  id: UUID;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Supply {
  id: UUID;
  user_id: UUID;
  name: string;
  category_id: UUID | null;
  brand: string | null;
  model: string | null;
  quantity: number;
  unit: string;
  expiration_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteChange {
  id: UUID;
  user_id: UUID;
  supply_id: UUID;
  applied_date: string;
  expected_duration_days: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: UUID;
  user_id: UUID;
  title: string;
  description: string | null;
  appointment_date: string;
  appointment_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Frontend inventory representation
 * Derived from Supply + SiteChange data
 */
export interface InventoryItem {
  id: UUID;
  brand: string | null;
  name: string;
  category: string;
  quantity: number;
  remainingDays: number;
  lastScanned: string;
  usageRatePerDay: number;
  expirationDate: string | null;
  unitType: string;
}

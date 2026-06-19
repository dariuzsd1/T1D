/**
 * Medical devices (pumps / CGMs) the user owns. PHI — stored in the
 * `medical_devices` table under Row-Level Security (see supabase/setup.sql §9).
 * Consumable supplies link to a device via `supplies.device_id`, so a pump can
 * display its reservoirs / sensors / infusion sets together with their runway.
 *
 * The table is created by supabase/setup.sql; until it's run the Devices page
 * uses `isMissingTableError` (src/lib/prescriptions.ts) to show a setup prompt
 * instead of crashing — the same pattern as the other newer tables.
 */

export type DeviceKind = 'pump' | 'cgm' | 'pen' | 'meter'

export interface MedicalDevice {
  id: string
  brand: string
  model: string | null
  kind: DeviceKind
  nickname: string | null
  startedOn: string | null
  notes: string | null
}

/** A row as stored in Postgres (snake_case). */
export interface MedicalDeviceRow {
  id: string
  brand: string
  model: string | null
  kind: DeviceKind
  nickname: string | null
  started_on: string | null
  notes: string | null
}

export function rowToDevice(r: MedicalDeviceRow): MedicalDevice {
  return {
    id: r.id,
    brand: r.brand,
    model: r.model,
    kind: (r.kind ?? 'pump') as DeviceKind,
    nickname: r.nickname,
    startedOn: r.started_on,
    notes: r.notes,
  }
}

/** Editable fields → DB columns for an insert/update payload. */
export function deviceToRow(d: Partial<MedicalDevice>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (d.brand !== undefined) row.brand = d.brand
  if (d.model !== undefined) row.model = d.model || null
  if (d.kind !== undefined) row.kind = d.kind
  if (d.nickname !== undefined) row.nickname = d.nickname || null
  if (d.startedOn !== undefined) row.started_on = d.startedOn || null
  if (d.notes !== undefined) row.notes = d.notes || null
  return row
}

export const DEVICE_KIND_LABEL: Record<DeviceKind, string> = {
  pump: 'Insulin pump',
  cgm: 'Continuous glucose monitor',
  pen: 'Insulin pen',
  meter: 'Blood glucose meter',
}

export interface DevicePreset {
  brand: string
  model: string
  kind: DeviceKind
}

/**
 * Tap-to-add presets so adding a device is a choice, not free-typing. Medtronic
 * is listed first (the user's focus); common other ecosystems follow. Custom
 * brand/model is always allowed too.
 */
export const DEVICE_PRESETS: DevicePreset[] = [
  { brand: 'Medtronic', model: 'MiniMed 780G', kind: 'pump' },
  { brand: 'Medtronic', model: 'MiniMed 770G', kind: 'pump' },
  { brand: 'Medtronic', model: 'Guardian 4 Sensor', kind: 'cgm' },
  { brand: 'Medtronic', model: 'Simplera Sync', kind: 'cgm' },
  { brand: 'Omnipod', model: 'Omnipod 5', kind: 'pump' },
  { brand: 'Tandem', model: 't:slim X2', kind: 'pump' },
  { brand: 'Dexcom', model: 'G7', kind: 'cgm' },
  { brand: 'Abbott', model: 'FreeStyle Libre 3', kind: 'cgm' },
]

/** Display label for a device: nickname if set, else "Brand Model". */
export function deviceLabel(d: MedicalDevice): string {
  if (d.nickname && d.nickname.trim()) return d.nickname
  return [d.brand, d.model].filter(Boolean).join(' ')
}

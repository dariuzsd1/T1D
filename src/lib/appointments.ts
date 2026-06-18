/**
 * Appointment manager types + helpers (CLAUDE.md §7-V3: "endo cadence linking
 * supplies ↔ prescriptions ↔ visits"). The `Appointment` type already existed in
 * database.ts with no UI — this wires it up.
 *
 * Appointments are PHI. They live in their own `appointments` table under
 * Row-Level Security (created by supabase/setup.sql). Until that runs the table
 * won't exist; the UI uses `isMissingTableError` (shared from ./prescriptions) to
 * show a one-time setup prompt instead of crashing.
 */

// Re-export so pages can import the shared helper from here too.
export { isMissingTableError } from './prescriptions'

export const APPOINTMENT_TYPES = [
  { value: 'endocrinology', label: 'Endocrinology' },
  { value: 'lab', label: 'Lab work' },
  { value: 'pump_trainer', label: 'Pump trainer' },
  { value: 'cgm_trainer', label: 'CGM trainer' },
  { value: 'primary_care', label: 'Primary care' },
  { value: 'other', label: 'Other' },
] as const

export function appointmentTypeLabel(value: string): string {
  return APPOINTMENT_TYPES.find((t) => t.value === value)?.label ?? 'Appointment'
}

export interface Appointment {
  id: string
  title: string
  description: string | null
  appointmentDate: string // ISO timestamp
  appointmentType: string
  notes: string | null
}

/** A row as stored in Postgres (snake_case). */
export interface AppointmentRow {
  id: string
  title: string
  description: string | null
  appointment_date: string
  appointment_type: string
  notes: string | null
}

export function rowToAppointment(r: AppointmentRow): Appointment {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    appointmentDate: r.appointment_date,
    appointmentType: r.appointment_type,
    notes: r.notes,
  }
}

/** Editable fields mapped to DB columns for an insert/update payload. */
export function appointmentToRow(a: Partial<Appointment>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (a.title !== undefined) row.title = a.title
  if (a.description !== undefined) row.description = a.description || null
  if (a.appointmentDate !== undefined) row.appointment_date = a.appointmentDate
  if (a.appointmentType !== undefined) row.appointment_type = a.appointmentType
  if (a.notes !== undefined) row.notes = a.notes || null
  return row
}

export type AppointmentTiming = 'past' | 'soon' | 'upcoming'

/**
 * When the visit is relative to now — derived only from the real date, nothing
 * fabricated. `soon` = within the lead window so the user can plan supplies/Rx
 * around it; `past` = already happened.
 */
export function appointmentTiming(
  appointmentDate: string,
  leadDays = 7,
  now: Date = new Date()
): AppointmentTiming {
  const when = new Date(appointmentDate).getTime()
  if (Number.isNaN(when)) return 'upcoming'
  const diffDays = (when - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'past'
  if (diffDays <= leadDays) return 'soon'
  return 'upcoming'
}

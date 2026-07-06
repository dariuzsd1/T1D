/**
 * Prescription manager types + helpers (CLAUDE.md §7-V2: "Prescription manager +
 * renewal nudges").
 *
 * Prescriptions are PHI. They live in their own `prescriptions` table under
 * Row-Level Security (see docs/PRESCRIPTIONS_CAREGIVERS_MIGRATION.md). Until that
 * migration is run the table won't exist; the UI uses `isMissingTableError` to
 * detect that and show a one-time setup prompt instead of crashing.
 */

export interface Prescription {
  id: string
  medicationName: string
  dosage: string | null
  prescriber: string | null
  pharmacy: string | null
  rxNumber: string | null
  writtenDate: string | null
  expirationDate: string | null
  refillsRemaining: number | null
  lastFilledDate: string | null
  notes: string | null
}

/** A row as stored in Postgres (snake_case). */
export interface PrescriptionRow {
  id: string
  medication_name: string
  dosage: string | null
  prescriber: string | null
  pharmacy: string | null
  rx_number: string | null
  written_date: string | null
  expiration_date: string | null
  refills_remaining: number | null
  last_filled_date: string | null
  notes: string | null
}

export function rowToPrescription(r: PrescriptionRow): Prescription {
  return {
    id: r.id,
    medicationName: r.medication_name,
    dosage: r.dosage,
    prescriber: r.prescriber,
    pharmacy: r.pharmacy,
    rxNumber: r.rx_number,
    writtenDate: r.written_date,
    expirationDate: r.expiration_date,
    refillsRemaining: r.refills_remaining,
    lastFilledDate: r.last_filled_date,
    notes: r.notes,
  }
}

/** The editable fields, mapped to DB columns for an insert/update payload. */
export function prescriptionToRow(p: Partial<Prescription>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (p.medicationName !== undefined) row.medication_name = p.medicationName
  if (p.dosage !== undefined) row.dosage = p.dosage || null
  if (p.prescriber !== undefined) row.prescriber = p.prescriber || null
  if (p.pharmacy !== undefined) row.pharmacy = p.pharmacy || null
  if (p.rxNumber !== undefined) row.rx_number = p.rxNumber || null
  if (p.writtenDate !== undefined) row.written_date = p.writtenDate || null
  if (p.expirationDate !== undefined) row.expiration_date = p.expirationDate || null
  if (p.refillsRemaining !== undefined) row.refills_remaining = p.refillsRemaining
  if (p.lastFilledDate !== undefined) row.last_filled_date = p.lastFilledDate || null
  if (p.notes !== undefined) row.notes = p.notes || null
  return row
}

/**
 * True when a Supabase/PostgREST error means "this table hasn't been created
 * yet" — so a page can show a setup prompt instead of a scary error. Covers the
 * Postgres undefined_table code (42P01) and PostgREST's schema-cache miss.
 */
export function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204') return true
  const msg = (error.message || '').toLowerCase()
  return (
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  )
}

/**
 * Reconcile a supply's runway with the prescription that covers it — the one
 * sentence a clinician would want the patient to see ("you're about to run out
 * AND you have no refills left" is the call-the-office moment, and neither app
 * surface shows it alone).
 *
 * Facts only (CLAUDE.md §9): refill counts and expiration dates are real user
 * input; the "runs out in ~N days" clause is included only when the usage rate
 * is real (an estimated runway must not be stated as a deadline).
 * Returns null when nothing is actionable.
 *
 * `level` maps to tone: 'act' = renewal needed now (caution), 'plan' = renewal
 * coming up (muted). Never urgent-red — that stays reserved for stockouts.
 */
export interface RxSupplyStatus {
  level: 'act' | 'plan'
  message: string
}

export function rxSupplyStatus(opts: {
  supplyName: string
  runwayDays: number
  rateEstimated: boolean
  prescription: Pick<Prescription, 'expirationDate' | 'refillsRemaining'>
  now?: Date
}): RxSupplyStatus | null {
  const { supplyName, runwayDays, rateEstimated, prescription: rx, now = new Date() } = opts

  const expired =
    rx.expirationDate != null && new Date(rx.expirationDate).getTime() < now.getTime()
  const daysClause =
    !rateEstimated && runwayDays > 0
      ? ` It runs out in about ${runwayDays} day${runwayDays === 1 ? '' : 's'}.`
      : ''

  if (expired) {
    const when = new Date(rx.expirationDate as string).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
    return {
      level: 'act',
      message: `The prescription for ${supplyName} expired ${when}.${daysClause} Ask for a renewal before reordering.`,
    }
  }
  if (rx.refillsRemaining === 0) {
    return {
      level: 'act',
      message: `No refills left on the prescription for ${supplyName}.${daysClause} Ask for a renewal.`,
    }
  }
  if (rx.refillsRemaining === 1) {
    return {
      level: 'plan',
      message: `One refill left on the prescription for ${supplyName}. Plan a renewal at your next visit.`,
    }
  }
  return null
}

export type RenewalStatus = 'ok' | 'due-soon' | 'needs-renewal'

/**
 * Derive a renewal status from real fields only — never fabricated.
 * `needs-renewal`: no refills left, or the prescription has expired.
 * `due-soon`: expires within `leadDays`, or only one refill remains.
 * `ok`: otherwise (or not enough data to judge → treated as ok, not alarming).
 */
export function renewalStatus(p: Prescription, leadDays = 30, now: Date = new Date()): RenewalStatus {
  const expired =
    p.expirationDate != null && new Date(p.expirationDate).getTime() < now.getTime()
  if (expired || p.refillsRemaining === 0) return 'needs-renewal'

  if (p.expirationDate != null) {
    const days = Math.floor(
      (new Date(p.expirationDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (days <= leadDays) return 'due-soon'
  }
  if (p.refillsRemaining != null && p.refillsRemaining <= 1) return 'due-soon'
  return 'ok'
}

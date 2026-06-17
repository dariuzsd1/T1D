/**
 * Caregiver share types + helpers (CLAUDE.md §7-V2 / §8: "caregiver/share
 * access (parents, partners co-manage supplies)").
 *
 * A "share" is a row the patient (owner) creates, granting a caregiver — keyed by
 * the caregiver's email — read or manage access to the patient's data. The actual
 * cross-account access is enforced in Postgres by Row-Level Security policies that
 * match `auth.email()` against accepted shares (see
 * docs/PRESCRIPTIONS_CAREGIVERS_MIGRATION.md). This module is the typed client
 * surface for managing those rows; `isMissingTableError` is shared from
 * ./prescriptions so a page can show a setup prompt before the table exists.
 */

export type CaregiverRole = 'view' | 'manage'
export type ShareStatus = 'invited' | 'accepted' | 'revoked'

export interface CaregiverShare {
  id: string
  caregiverEmail: string
  role: CaregiverRole
  status: ShareStatus
  createdAt: string | null
  acceptedAt: string | null
}

export interface CaregiverShareRow {
  id: string
  caregiver_email: string
  role: CaregiverRole
  status: ShareStatus
  created_at: string | null
  accepted_at: string | null
}

export function rowToShare(r: CaregiverShareRow): CaregiverShare {
  return {
    id: r.id,
    caregiverEmail: r.caregiver_email,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at,
  }
}

/** Lightweight email check — enough to catch typos before we store an invite. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export const ROLE_LABEL: Record<CaregiverRole, string> = {
  view: 'Can view',
  manage: 'Can view & manage',
}

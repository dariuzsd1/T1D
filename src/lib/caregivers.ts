/**
 * Caregiver share types + helpers (CLAUDE.md §7-V2 / §8: "caregiver/share
 * access (parents, partners co-manage supplies)").
 *
 * A "share" is a row the patient (owner) creates, granting a caregiver — keyed by
 * the caregiver's email — read or manage access to the patient's data. The actual
 * cross-account access is enforced in Postgres by Row-Level Security policies that
 * match `auth.jwt() ->> 'email'` against accepted shares (see supabase/setup.sql).
 */

export type CaregiverRole = 'view' | 'manage'
export type ShareStatus = 'invited' | 'accepted' | 'revoked'

/** A share the current user OWNS (they are the patient). */
export interface CaregiverShare {
  id: string
  ownerId: string
  caregiverEmail: string
  role: CaregiverRole
  status: ShareStatus
  createdAt: string | null
  acceptedAt: string | null
}

/** A row as stored in Postgres (snake_case). Includes owner_email (Phase 3). */
export interface CaregiverShareRow {
  id: string
  owner_id: string
  owner_email: string | null
  caregiver_email: string
  role: CaregiverRole
  status: ShareStatus
  created_at: string | null
  accepted_at: string | null
}

export function rowToShare(r: CaregiverShareRow): CaregiverShare {
  return {
    id: r.id,
    ownerId: r.owner_id,
    caregiverEmail: r.caregiver_email,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at,
  }
}

/**
 * A share the current user received — they are the caregiver, the patient is
 * the owner. ownerEmail comes from the owner_email column stored at invite time.
 * `status` drives the consent step: an 'invited' share grants no access until
 * the caregiver accepts it (RLS requires 'accepted').
 */
export interface SharedWithMe {
  shareId: string
  ownerId: string
  ownerEmail: string | null
  role: CaregiverRole
  status: ShareStatus
  createdAt: string | null
}

export function rowToSharedWithMe(r: CaregiverShareRow): SharedWithMe {
  return {
    shareId: r.id,
    ownerId: r.owner_id,
    ownerEmail: r.owner_email,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
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

export interface Profile {
  id: string
  displayName: string | null
  createdAt: string
}

export interface ProfileRow {
  id: string
  display_name: string | null
  created_at: string
  updated_at: string
}

export function rowToProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    displayName: r.display_name,
    createdAt: r.created_at,
  }
}

/**
 * Returns a human-readable label for the user: their display name if set,
 * otherwise the local part of their email (everything before the @), otherwise
 * a generic fallback. Never shows a raw UUID.
 */
export function userLabel(profile: Profile | null, email: string | null): string {
  if (profile?.displayName) return profile.displayName
  if (email) return email.split('@')[0]
  return 'Account'
}

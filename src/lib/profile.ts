import { createClient } from '@/lib/supabase/client'

export interface Profile {
  id: string
  displayName: string | null
  preferredName: string | null
  pronouns: string | null
  timezone: string | null
  theme: string | null
  locale: string | null
  avatarPath: string | null
  createdAt: string
}

export interface ProfileRow {
  id: string
  display_name: string | null
  preferred_name: string | null
  pronouns: string | null
  timezone: string | null
  theme: string | null
  locale: string | null
  avatar_path: string | null
  created_at: string
  updated_at: string
}

export function rowToProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    displayName: r.display_name,
    preferredName: r.preferred_name ?? null,
    pronouns: r.pronouns ?? null,
    timezone: r.timezone ?? null,
    theme: r.theme ?? null,
    locale: r.locale ?? null,
    avatarPath: r.avatar_path ?? null,
    createdAt: r.created_at,
  }
}

/**
 * Public URL for an avatar stored in the `avatars` bucket, or null if unset.
 * The bucket is public (avatars are not PHI), so no signed URL is needed.
 * A cache-busting query is appended so a freshly uploaded avatar shows at once.
 */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const supabase = createClient()
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Returns a human-readable label for the user: preferred/display name if set,
 * otherwise the local part of their email (everything before the @), otherwise
 * a generic fallback. Never shows a raw UUID.
 */
export function userLabel(profile: Profile | null, email: string | null): string {
  if (profile?.preferredName) return profile.preferredName
  if (profile?.displayName) return profile.displayName
  if (email) return email.split('@')[0]
  return 'Account'
}

/** Up to two-letter initials for the avatar fallback. */
export function initialsFor(profile: Profile | null, email: string | null): string {
  const label = userLabel(profile, email)
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return label.slice(0, 2).toUpperCase()
}

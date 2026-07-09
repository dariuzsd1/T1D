'use client'

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { rowToProfile, type Profile, type ProfileRow } from '@/lib/profile'

interface ProfileValue {
  profile: Profile | null
  email: string | null
  loading: boolean
  /** Re-fetch after the user edits their profile or uploads an avatar. */
  refresh: () => Promise<void>
}

const ProfileContext = createContext<ProfileValue | null>(null)

/**
 * Loads the signed-in user's profile once for the whole dashboard, so the
 * avatar/name are available to the nav, the profile page, and settings without
 * each refetching. Mirrors the LanguageProvider pattern.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProfile(null); setEmail(null); setLoading(false); return }
    setEmail(user.email ?? null)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    if (data) setProfile(rowToProfile(data as ProfileRow))
    setLoading(false)
  }, [supabase])

  // Standard fetch-on-mount; goes away if this provider migrates to TanStack Query.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh() }, [refresh])

  return (
    <ProfileContext.Provider value={{ profile, email, loading, refresh }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider')
  return ctx
}

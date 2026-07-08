'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/components/profile/ProfileProvider'
import { useI18n, type Lang } from '@/lib/i18n'
import { useTheme, type Theme } from '@/lib/theme'
import { useStore } from '@/lib/store'

/**
 * Makes language + theme + safety-buffer preferences follow the user across
 * devices by syncing them through `profiles`. Cookie/localStorage remain the
 * first-paint cache; the server row is the cross-device source of truth.
 *
 * Flow:
 *  1. Once, when the profile loads, seed the in-app prefs FROM the profile (so a
 *     fresh device adopts the user's saved choices).
 *  2. After seeding, persist any change the user makes BACK to the profile.
 * Renders nothing.
 */
export function PreferenceSync() {
  const supabase = useMemo(() => createClient(), [])
  const { profile, loading } = useProfile()
  const { lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const safetyBufferDays = useStore((s) => s.safetyBufferDays)
  const setSafetyBufferDays = useStore((s) => s.setSafetyBufferDays)
  const seeded = useRef(false)

  // 1. Seed once from the profile (profile wins on a fresh device).
  useEffect(() => {
    if (loading || !profile || seeded.current) return
    if (profile.locale === 'en' || profile.locale === 'fr' || profile.locale === 'es') {
      if (profile.locale !== lang) setLang(profile.locale as Lang)
    }
    if (profile.theme === 'light' || profile.theme === 'dark' || profile.theme === 'system') {
      if (profile.theme !== theme) setTheme(profile.theme as Theme)
    }
    if (typeof profile.safetyBufferDays === 'number' && profile.safetyBufferDays > 0) {
      if (profile.safetyBufferDays !== safetyBufferDays) setSafetyBufferDays(profile.safetyBufferDays)
    }
    seeded.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile])

  // 2. Persist language changes back to the profile.
  useEffect(() => {
    if (!seeded.current || !profile || lang === profile.locale) return
    supabase.from('profiles').update({ locale: lang }).eq('id', profile.id).then(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  // 3. Persist theme changes back to the profile.
  useEffect(() => {
    if (!seeded.current || !profile || theme === profile.theme) return
    supabase.from('profiles').update({ theme }).eq('id', profile.id).then(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  // 4. Persist safety-buffer changes back to the profile.
  useEffect(() => {
    if (!seeded.current || !profile || safetyBufferDays === profile.safetyBufferDays) return
    supabase.from('profiles').update({ safety_buffer_days: safetyBufferDays }).eq('id', profile.id).then(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safetyBufferDays])

  return null
}

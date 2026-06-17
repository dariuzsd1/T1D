import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'

/**
 * Server-side Supabase client (Server Components, Route Handlers).
 * Uses the `@supabase/ssr` getAll/setAll cookie interface so auth tokens
 * refresh correctly. Always authorize with `supabase.auth.getUser()` — it
 * verifies the token against the Auth server, unlike the spoofable session.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: the proxy refreshes the session cookies instead.
          }
        },
      },
    }
  )
}

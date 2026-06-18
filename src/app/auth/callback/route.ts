import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Magic-link / OAuth callback. With @supabase/ssr the sign-in link arrives here
 * as `?code=…` (PKCE flow). We exchange that code for a session — which sets the
 * auth cookies via our server client — then forward the user on. Without this
 * step the proxy never sees a logged-in user and bounces back to /login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Where to land after a successful sign-in (defaults to the dashboard).
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('Auth callback: code exchange failed —', error.message)
  }

  // No code, or the exchange failed → back to login with a hint.
  return NextResponse.redirect(`${origin}/login?error=auth`)
}

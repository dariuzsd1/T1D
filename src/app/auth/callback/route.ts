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
  // Only accept a same-origin relative path: `${origin}${next}` would otherwise
  // let a crafted `?next=@evil.com` / `?next=.evil.com` (or `//evil.com`) escape
  // to another host — a classic open redirect. Anything unexpected → /dashboard.
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('Auth callback: code exchange failed:', error.message)
  }

  // No code, or the exchange failed → back to login with a hint.
  return NextResponse.redirect(`${origin}/login?error=auth`)
}

/**
 * Accept only a same-origin, single-slash relative path (e.g. "/dashboard").
 * Rejects absolute URLs, protocol-relative "//host", backslash tricks, and
 * userinfo/host escapes — all of which would turn `${origin}${next}` into an
 * off-site redirect. Falls back to "/dashboard".
 */
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return '/dashboard'
  }
  return raw
}

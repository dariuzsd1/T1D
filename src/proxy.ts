import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env'

/**
 * Next.js 16 renamed `middleware` → `proxy`. This guards the authenticated
 * routes and, critically, threads any refreshed Supabase auth cookies back
 * onto the response so the session token refresh isn't lost (fixes M7).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the token against the Supabase Auth server — the
  // session cookie alone is spoofable, so never authorize on it (C5).
  //
  // Resilience: if Supabase is unreachable (e.g. a paused free-tier project, or a
  // transient network error), DON'T let that throw out of the middleware — that
  // would 500 every matched route and make the whole site look dead. Degrade to
  // "logged out" instead, so pages still render (protected ones bounce to login).
  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch (err) {
    console.error('proxy: Supabase auth check failed (treating as logged out):', err)
  }

  const { pathname } = request.nextUrl
  const isProtected =
    pathname.startsWith('/dashboard') || pathname.startsWith('/scan')

  // Carry any refreshed auth cookies onto a redirect so they aren't dropped.
  const redirectTo = (to: string) => {
    const url = request.nextUrl.clone()
    url.pathname = to
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  if (!user && isProtected) {
    return redirectTo('/login')
  }

  if (user && pathname === '/login') {
    return redirectTo('/dashboard')
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/scan/:path*', '/login'],
}

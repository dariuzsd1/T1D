import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: cookieStore,
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protect Dashboard & Scan routes
  if (!session && (req.nextUrl.pathname.startsWith('/dashboard') || req.nextUrl.pathname.startsWith('/scan'))) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to Dashboard if already logged in
  if (session && req.nextUrl.pathname === '/login') {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/scan/:path*', '/login'],
}

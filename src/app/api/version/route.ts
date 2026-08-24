import { NextResponse } from 'next/server'

/**
 * GET /api/version
 *
 * Reports the build the server is currently running. A tab left open for days
 * keeps executing the bundle it first loaded: Next.js navigates on the client,
 * so nothing re-fetches the document and a deploy never reaches that session.
 * The client compares this against the id it was compiled with and offers a
 * reload when they differ (src/components/layout/UpdateBanner.tsx).
 *
 * Never cached: a stale answer here would defeat the entire point.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

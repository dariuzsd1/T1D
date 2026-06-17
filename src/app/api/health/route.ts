import { NextResponse } from 'next/server'

/**
 * GET /api/health
 * Minimal liveness check for uptime monitoring / deployment probes.
 * Reports only what's actually true — that the app is up and responding.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    time: new Date().toISOString(),
  })
}

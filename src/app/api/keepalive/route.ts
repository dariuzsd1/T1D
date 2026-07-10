import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorMessage } from '@/lib/utils'

/**
 * GET /api/keepalive
 *
 * Issues ONE trivial read against Supabase so a free-tier project never hits the
 * 7-day inactivity pause, even if push notifications (the daily notify-refills
 * cron that otherwise keeps it warm) are ever turned off. Pinged on a schedule by
 * .github/workflows/keepalive.yml.
 *
 * Deliberately separate from /api/health: health is a pure app-liveness probe and
 * must not depend on the DB, whereas the whole point HERE is to touch Postgres.
 * The query hits the public-read `products` table (no auth, no PHI); even an
 * error still round-tripped to the database, which is all that's needed to keep
 * it awake, so this always responds 200 and reports the DB result in the body.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('products').select('id').limit(1)
    return NextResponse.json({
      ok: !error,
      db: error ? 'error' : 'reached',
      time: new Date().toISOString(),
      ...(error ? { message: error.message } : {}),
    })
  } catch (err) {
    // The app is up (we got here), the DB attempt is what matters; report and 200.
    return NextResponse.json({
      ok: false,
      db: 'error',
      time: new Date().toISOString(),
      message: errorMessage(err),
    })
  }
}

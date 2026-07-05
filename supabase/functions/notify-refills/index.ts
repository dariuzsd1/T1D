/**
 * notify-refills — the FCM server half (docs/PUSH_NOTIFICATIONS.md).
 *
 * Runs daily via pg_cron (supabase/cron.sql): scans every user's supplies with
 * the service-role key, finds real alerts, and pushes them through FCM HTTP v1.
 *
 * KEEP IN SYNC: the two pure engines below are ports of
 *   - src/lib/depletion.ts  (effectiveRunwayDays / stockStatus / displayStatus)
 *   - src/lib/refill.ts     (assessRefill — the insurance-gap moat)
 * If either source module changes, re-port it here. They are pure date/number
 * logic with no imports, so the copy is line-for-line.
 *
 * Honesty rules (CLAUDE.md §9), enforced server-side exactly like the UI:
 *   - estimates never alarm: an unknown usage rate can only alert through facts
 *     (0 on hand, or a real expiration date inside the lead window)
 *   - the insurance-gap alert only fires on a KNOWN rate — a gap computed from
 *     the fallback guess would be a fabricated emergency
 *   - nothing is sent twice: notification_log dedupes per item+kind for 3 days
 *   - quiet hours (user's timezone) are respected; the next daily run catches up
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

// ─── ported from src/lib/depletion.ts ────────────────────────────────────────

const MS_PER_DAY = 1000 * 60 * 60 * 24
const DEFAULT_SAFETY_BUFFER_DAYS = 14
const DEFAULT_USAGE_RATE_PER_DAY = 1

interface RunwayInput {
  quantity: number
  usageRatePerDay: number
  expirationDate?: string | null
}

function isRateEstimated(usageRatePerDay?: number | null): boolean {
  return !(typeof usageRatePerDay === 'number' && usageRatePerDay > 0)
}

function daysOfStock(quantity: number, usageRatePerDay: number): number {
  const usage = usageRatePerDay > 0 ? usageRatePerDay : DEFAULT_USAGE_RATE_PER_DAY
  return Math.max(0, Math.floor(quantity / usage))
}

function daysUntilExpiration(expirationDate?: string | null): number | null {
  if (!expirationDate) return null
  const ms = new Date(expirationDate).getTime()
  if (Number.isNaN(ms)) return null
  return Math.floor((ms - Date.now()) / MS_PER_DAY)
}

function effectiveRunwayDays(p: RunwayInput): number {
  const stock = daysOfStock(p.quantity, p.usageRatePerDay)
  const exp = daysUntilExpiration(p.expirationDate)
  if (exp === null) return stock
  return Math.max(0, Math.min(stock, exp))
}

type StockStatus = 'out' | 'low' | 'ok'
type DisplayStatus = StockStatus | 'unset'

function stockStatus(runwayDays: number, bufferDays: number = DEFAULT_SAFETY_BUFFER_DAYS): StockStatus {
  if (runwayDays <= 0) return 'out'
  if (runwayDays <= bufferDays) return 'low'
  return 'ok'
}

function displayStatus(p: RunwayInput, bufferDays: number = DEFAULT_SAFETY_BUFFER_DAYS): DisplayStatus {
  if (p.quantity <= 0) return 'out'
  if (!isRateEstimated(p.usageRatePerDay)) {
    return stockStatus(effectiveRunwayDays(p), bufferDays)
  }
  const exp = daysUntilExpiration(p.expirationDate)
  if (exp !== null && exp <= 0) return 'out'
  if (exp !== null && exp <= bufferDays) return 'low'
  return 'unset'
}

// ─── ported from src/lib/refill.ts ───────────────────────────────────────────

const DEFAULT_REFILL_THRESHOLD = 0.75

interface RefillRule {
  supplyDays: number
  refillThreshold?: number
}

function startOfToday(now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

function nextEligibleRefillDate(
  lastFilledDate: string | null | undefined,
  rule: RefillRule | null | undefined
): Date | null {
  if (!lastFilledDate || !rule || !rule.supplyDays || rule.supplyDays <= 0) return null
  const filled = new Date(lastFilledDate).getTime()
  if (Number.isNaN(filled)) return null
  const threshold = rule.refillThreshold ?? DEFAULT_REFILL_THRESHOLD
  return new Date(filled + rule.supplyDays * threshold * MS_PER_DAY)
}

function daysUntilRefillEligible(
  lastFilledDate: string | null | undefined,
  rule: RefillRule | null | undefined,
  now: Date = new Date()
): number | null {
  const eligible = nextEligibleRefillDate(lastFilledDate, rule)
  if (!eligible) return null
  const diff = eligible.getTime() - startOfToday(now).getTime()
  return Math.max(0, Math.ceil(diff / MS_PER_DAY))
}

/** The gap check only (the full assessRefill message strings live client-side). */
function refillGapDays(
  runwayDays: number,
  lastFilledDate: string | null | undefined,
  rule: RefillRule | null | undefined
): number {
  const daysUntilEligible = daysUntilRefillEligible(lastFilledDate, rule)
  if (daysUntilEligible === null || daysUntilEligible <= 0) return 0
  return runwayDays < daysUntilEligible ? daysUntilEligible - runwayDays : 0
}

// ─── FCM HTTP v1 (OAuth via the service-account JSON secret) ─────────────────

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const b64urlJson = (obj: unknown): string => b64url(new TextEncoder().encode(JSON.stringify(obj)))

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const raw = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const der = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

/** Mint a short-lived OAuth access token for the FCM scope. */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const unsigned =
    b64urlJson({ alg: 'RS256', typ: 'JWT' }) +
    '.' +
    b64urlJson({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  const key = await importPrivateKey(sa.private_key)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`OAuth token exchange failed: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.access_token as string
}

/** Send one push. Returns 'ok' | 'dead-token' | 'error'. */
async function sendFcm(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  url: string
): Promise<'ok' | 'dead-token' | 'error'> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          // The service worker (public/firebase-messaging-sw.js) opens data.url
          // on click; webpush headers keep the notification calm (no sound tag).
          data: { url },
          webpush: { headers: { Urgency: 'normal' } },
        },
      }),
    }
  )
  if (res.ok) return 'ok'
  const text = await res.text()
  // 404 UNREGISTERED / 400 INVALID_ARGUMENT on a stale token → purge it so we
  // stop pushing at a browser profile that no longer exists.
  if (res.status === 404 || text.includes('UNREGISTERED') || text.includes('INVALID_ARGUMENT')) {
    return 'dead-token'
  }
  console.error(`FCM send failed (${res.status}): ${text}`)
  return 'error'
}

// ─── quiet hours ─────────────────────────────────────────────────────────────

/** The user's current local hour (0-23); falls back to UTC on a bad timezone. */
function hourIn(timezone: string | null): number {
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone ?? 'UTC',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
    return parseInt(s, 10) % 24
  } catch {
    return new Date().getUTCHours()
  }
}

/** True when `hour` falls inside a window that may wrap midnight (22 → 8). */
function inQuietHours(hour: number, start: number | null, end: number | null): boolean {
  if (start == null || end == null || start === end) return false
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

// ─── row shapes (only the columns this function reads) ───────────────────────

interface SupplyRow {
  id: string
  user_id: string
  name: string
  quantity: number
  usage_rate_per_day: number | null
  expiration_date: string | null
  refill_interval_days: number | null
  last_filled_date: string | null
}
interface PrefsRow {
  user_id: string
  push_enabled: boolean
  lead_time_days: number | null
  quiet_hours_start: number | null
  quiet_hours_end: number | null
}
interface ProfileRow {
  id: string
  timezone: string | null
  safety_buffer_days: number | null
}
interface TokenRow {
  id: string
  user_id: string
  token: string
}
interface LogRow {
  user_id: string
  supply_id: string | null
  kind: string
}

const DEDUPE_DAYS = 3

Deno.serve(async (req) => {
  // Only the scheduler (or an operator) with the service-role key may trigger a
  // scan — a signed-in user's JWT passes platform verification but not this.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }

  const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT')
  if (!saRaw) {
    return new Response(
      JSON.stringify({ error: 'FCM_SERVICE_ACCOUNT secret not set — see docs/PUSH_NOTIFICATIONS.md' }),
      { status: 500 }
    )
  }
  const sa = JSON.parse(saRaw) as ServiceAccount

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey)

  // One round of reads; the free tier is fine with this at personal scale.
  const since = new Date(Date.now() - DEDUPE_DAYS * MS_PER_DAY).toISOString()
  const [tokensRes, suppliesRes, prefsRes, profilesRes, logRes] = await Promise.all([
    supabase.from('fcm_tokens').select('id, user_id, token'),
    supabase.from('supplies').select(
      'id, user_id, name, quantity, usage_rate_per_day, expiration_date, refill_interval_days, last_filled_date'
    ),
    supabase.from('notification_prefs').select('*'),
    supabase.from('profiles').select('id, timezone, safety_buffer_days'),
    supabase.from('notification_log').select('user_id, supply_id, kind').gte('sent_at', since),
  ])
  for (const r of [tokensRes, suppliesRes, prefsRes, profilesRes] as const) {
    if (r.error) {
      return new Response(JSON.stringify({ error: r.error.message }), { status: 500 })
    }
  }
  // A missing notification_log table (setup.sql not re-run) shouldn't stop
  // alerts — it just means no dedupe this run.
  const recentLog: LogRow[] = logRes.error ? [] : (logRes.data as LogRow[])

  const tokens = (tokensRes.data ?? []) as TokenRow[]
  const supplies = (suppliesRes.data ?? []) as SupplyRow[]
  const prefsByUser = new Map((prefsRes.data as PrefsRow[] ?? []).map((p) => [p.user_id, p]))
  const profileByUser = new Map((profilesRes.data as ProfileRow[] ?? []).map((p) => [p.id, p]))
  const tokensByUser = new Map<string, TokenRow[]>()
  for (const t of tokens) {
    tokensByUser.set(t.user_id, [...(tokensByUser.get(t.user_id) ?? []), t])
  }
  const alreadySent = new Set(recentLog.map((l) => `${l.user_id}|${l.supply_id}|${l.kind}`))

  let accessToken: string | null = null // minted lazily, only if something must send
  const deadTokenIds: string[] = []
  const logInserts: { user_id: string; supply_id: string; kind: string }[] = []
  let alerts = 0
  let sent = 0
  let skippedQuiet = 0

  for (const [userId, userTokens] of tokensByUser) {
    const prefs = prefsByUser.get(userId)
    if (prefs && prefs.push_enabled === false) continue

    const profile = profileByUser.get(userId)
    if (inQuietHours(hourIn(profile?.timezone ?? null), prefs?.quiet_hours_start ?? 22, prefs?.quiet_hours_end ?? 8)) {
      skippedQuiet++
      continue // the next daily run catches up outside the window
    }

    // Lead time: the user's notification preference, else their app safety
    // buffer, else the app default — the same number the UI alarms against.
    const lead = prefs?.lead_time_days ?? profile?.safety_buffer_days ?? DEFAULT_SAFETY_BUFFER_DAYS

    for (const s of supplies.filter((x) => x.user_id === userId)) {
      const input: RunwayInput = {
        quantity: s.quantity,
        usageRatePerDay: s.usage_rate_per_day ?? 0,
        expirationDate: s.expiration_date,
      }
      const status = displayStatus(input, lead)
      const runway = effectiveRunwayDays(input)
      const rateKnown = !isRateEstimated(s.usage_rate_per_day)

      // Alert 1 — run-out (facts only; 'unset' never alerts, same as the UI).
      let runoutBody: string | null = null
      if (status === 'out') runoutBody = `${s.name} is out. Reorder now.`
      else if (status === 'low') {
        runoutBody = rateKnown
          ? `${s.name} runs low in about ${runway} day${runway === 1 ? '' : 's'}. Reorder soon.`
          : `${s.name} expires soon. Use it first and reorder.`
      }

      // Alert 2 — the moat: you'd run out before insurance lets you refill.
      // Known rates only; a gap computed from the fallback guess would be fabricated.
      const gapDays = rateKnown
        ? refillGapDays(runway, s.last_filled_date,
            s.refill_interval_days ? { supplyDays: s.refill_interval_days } : null)
        : 0

      const queue: { kind: 'runout' | 'gap'; title: string; body: string }[] = []
      if (runoutBody && !alreadySent.has(`${userId}|${s.id}|runout`)) {
        queue.push({
          kind: 'runout',
          title: status === 'out' ? 'Out of supply' : 'Running low',
          body: runoutBody,
        })
      }
      if (gapDays > 0 && !alreadySent.has(`${userId}|${s.id}|gap`)) {
        queue.push({
          kind: 'gap',
          title: 'Refill gap ahead',
          body: `${s.name}: you'd run out ${gapDays} day${gapDays === 1 ? '' : 's'} before your refill date. Ask your pharmacy for an early-refill override.`,
        })
      }

      for (const alert of queue) {
        alerts++
        accessToken ??= await getAccessToken(sa)
        let delivered = false
        for (const t of userTokens) {
          const result = await sendFcm(
            accessToken, sa.project_id, t.token, alert.title, alert.body, '/dashboard/reorder'
          )
          if (result === 'ok') { sent++; delivered = true }
          else if (result === 'dead-token') deadTokenIds.push(t.id)
        }
        // Log only what was actually delivered somewhere — an undelivered alert
        // should retry tomorrow, not be suppressed by its own failure.
        if (delivered) logInserts.push({ user_id: userId, supply_id: s.id, kind: alert.kind })
      }
    }
  }

  if (deadTokenIds.length > 0) {
    await supabase.from('fcm_tokens').delete().in('id', deadTokenIds)
  }
  if (logInserts.length > 0) {
    const { error: logErr } = await supabase.from('notification_log').insert(logInserts)
    if (logErr) console.warn('notification_log insert failed (dedupe off until setup.sql is re-run):', logErr.message)
  }

  return new Response(
    JSON.stringify({
      users: tokensByUser.size,
      supplies: supplies.length,
      alerts,
      sent,
      deadTokensRemoved: deadTokenIds.length,
      usersInQuietHours: skippedQuiet,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

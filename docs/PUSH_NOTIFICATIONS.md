# Push notifications (FCM) — implementation guide

> Status: **not yet implemented.** This is the highest-ROI MVP feature (a
> rarely-opened app only works if it reaches the user *off-device*), but it
> needs external setup that can't live in the repo alone. This doc is the
> step-by-step to land it at **$0/month** (no Firebase Blaze, no Twilio) per
> MASTER_SUGGESTIONS §6.

## Architecture ($0, no credit card)

```
Supabase pg_cron (daily)            ← free, built into Supabase
  → Supabase Edge Function          ← free tier
      → scans supplies for items that cross the safety buffer
      → POSTs to FCM HTTP v1 API    ← Firebase Cloud Messaging is free & unlimited
          → browser/device shows the notification
```

We deliberately **do not** use Firebase Cloud Functions (they require the Blaze
pay-as-you-go plan + a credit card). `pg_cron` + an Edge Function replace them
for free.

## What you need to provide

1. **Firebase project** (free Spark plan is fine — we only use FCM).
   - Console → Project settings → Cloud Messaging → **Web Push certificates** →
     generate a **VAPID key pair**. Copy the public key.
   - Project settings → Service accounts → **generate a private key** (JSON).
     This is used server-side by the Edge Function to call the FCM HTTP v1 API.
2. **Supabase**: a real project (not paused), with `pg_cron` enabled
   (Dashboard → Database → Extensions → enable `pg_cron` and `pg_net`).

## Steps

### 1. Client: register a service worker + get a token
- Add `firebase` to deps; create `public/firebase-messaging-sw.js`.
- On the dashboard, after login, ask permission and call `getToken(messaging,
  { vapidKey })`. Store the returned token.
- Env: `NEXT_PUBLIC_FIREBASE_*` config values + `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.

### 2. DB: store device tokens under RLS (PHI-adjacent)
```sql
create table fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz default now()
);
alter table fcm_tokens enable row level security;
create policy "own tokens" on fcm_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 2b. DB: per-user notification preferences (quiet hours / lead time)
```sql
create table notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  -- How many days of lead time before a run-out to alert. Defaults to the
  -- app's safety buffer (14) but the user can tune it on the Settings page.
  lead_time_days integer not null default 14,
  quiet_hours_start smallint default 22,  -- 0-23, local hour
  quiet_hours_end   smallint default 8,
  created_at timestamptz default now()
);
alter table notification_prefs enable row level security;
create policy "own prefs" on notification_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 3. Edge Function: `notify-refills`
- Reads each user's supplies, computes runway with the **same logic as
  `src/lib/depletion.ts`** (keep them in sync — port `effectiveRunwayDays` /
  `stockStatus`), finds items at/under the user's safety buffer.
- For each, sends an FCM message via the HTTP v1 API using the service-account
  JSON (store it as a Supabase secret, never in the repo).
- Message copy should be specific and calm, e.g.
  `"Omnipod runs low Thursday — reorder soon."` (matches §6 tone).
- Respect quiet hours + per-user channel/threshold prefs once those exist.
- **Reuse the engines already in the app** — port these two pure modules into the
  function (Deno) so the server and client agree exactly:
  - `src/lib/depletion.ts` → `effectiveRunwayDays` / `stockStatus` (run-out alerts)
  - `src/lib/refill.ts` → `assessRefill` (the moat: alert on the `gap` state, i.e.
    "you'll run out before insurance lets you refill — request an override").

Skeleton (`supabase/functions/notify-refills/index.ts`):
```ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
// Copy effectiveRunwayDays/stockStatus + assessRefill here (or import a shared file).

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // service role: bypasses RLS, server-only
  )

  const { data: supplies } = await supabase.from('supplies').select('*')
  const { data: prefs } = await supabase.from('notification_prefs').select('*')
  const { data: tokens } = await supabase.from('fcm_tokens').select('*')

  for (const s of supplies ?? []) {
    const pref = prefs?.find((p) => p.user_id === s.user_id)
    const lead = pref?.lead_time_days ?? 14
    const runway = effectiveRunwayDays(s)               // from depletion.ts
    const refill = assessRefill(runway, s.last_filled_date,
      s.refill_interval_days ? { supplyDays: s.refill_interval_days } : null) // refill.ts

    if (stockStatus(runway, lead) === 'ok' && refill.state !== 'gap') continue
    const message = refill.state === 'gap' ? refill.message : `${s.name} runs low soon — reorder.`

    for (const t of tokens?.filter((x) => x.user_id === s.user_id) ?? []) {
      await sendFcm(t.token, message) // FCM HTTP v1 via the service-account JWT
    }
  }
  return new Response('ok')
})
```

### 4. Schedule it with pg_cron (free)
```sql
select cron.schedule(
  'notify-refills-daily',
  '0 14 * * *',  -- 14:00 UTC daily
  $$ select net.http_post(
       url := 'https://<project-ref>.functions.supabase.co/notify-refills',
       headers := '{"Authorization":"Bearer <service-role-or-function-secret>"}'::jsonb
     ); $$
);
```

## Secrets checklist (none committed)
- `NEXT_PUBLIC_FIREBASE_*` (public web config) → `.env.local` / Vercel
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY` → `.env.local` / Vercel
- Firebase service-account JSON → **Supabase Edge Function secret**, not the repo
- Keep the Supabase project warm (it pauses after ~7 days idle) — a free GitHub
  Actions weekly ping works, or upgrade later.

## When you're ready
Provide the Firebase web config + VAPID public key and confirm `pg_cron` is
enabled, and the client + Edge Function pieces can be built against them.

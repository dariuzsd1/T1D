# Push notifications (FCM) — deploy checklist

> Status: **client half DONE · server half BUILT, awaiting the steps below.**
> The app already registers the service worker, asks permission, and stores
> device tokens (`src/components/PushToggle.tsx` on the Settings page). The
> sender is written too: `supabase/functions/notify-refills/index.ts`. What's
> left is ~20 minutes of one-time dashboard setup — no code. Total cost: **$0/month**
> (no Firebase Blaze, no credit card; pg_cron + Edge Function replace Cloud Functions).

## Architecture (already built)

```
Supabase pg_cron (daily 14:00 UTC)              ← supabase/cron.sql
  → Edge Function notify-refills                ← supabase/functions/notify-refills/
      → reads supplies/prefs/tokens with the service role
      → same honest engines as the app (depletion.ts + refill.ts ports):
          · run-out alerts measured against YOUR lead time / safety buffer
          · "estimates never alarm" — an unset usage rate can't page you
          · the moat: "you'd run out N days before your refill date" (gap)
      → respects quiet hours (your timezone), dedupes for 3 days
        (notification_log), purges dead tokens
      → FCM HTTP v1 → the browser shows the notification, click opens the app
```

## What you do (in order)

### 1. Get the Firebase service-account key (2 min)
Firebase Console → project **t1-diabetes** → ⚙ Project settings →
**Service accounts** → *Generate new private key* → a JSON file downloads.
Treat it like a password. Never commit it.

### 2. Make sure the DB is current (1 min)
Re-run `supabase/setup.sql` in the SQL editor (idempotent). It creates
`fcm_tokens`, `notification_prefs`, and the new `notification_log` (§16).

### 3. Deploy the function (5 min)

> **Dashboard copy-paste no longer works, and this doc used to say it did.**
> `index.ts` imports the depletion engine from `../_shared/depletion.ts`
> (line 44). Pasting just `index.ts` into the dashboard leaves that relative
> import pointing at nothing. The function has to be deployed as a *bundle* so
> the `_shared/` file travels with it, which means the CLI.

```
npx supabase login
npx supabase functions deploy notify-refills --no-verify-jwt --project-ref <PROJECT-REF>
```

`npx` avoids a global install. The project ref is the subdomain in your Supabase
dashboard URL.

### 3a. REDEPLOY whenever `supabase/functions/**` changes — including `_shared/`

This is the easiest thing in the project to forget, and the consequence is
silent. Vercel auto-deploys the app on every push; **nothing auto-deploys this
function.** CI builds and tests it but has no Supabase step. So the app can be
running corrected math while the daily push is still computing the old answers,
and nobody finds out, because a notification that says the wrong number looks
exactly like one that says the right number.

That is not hypothetical. The 2026-09/10 audit changed `_shared/depletion.ts`
three times — the insulin in-use window, the measured wear rate, and threading
`now` through — and the deployed function kept using the pre-audit engine until
it was redeployed by hand. Which is precisely the drift `_shared/depletion.ts`
exists to prevent: read the comment at the top of that file, where the same
thing happened once before and left "the one channel meant to reach a user
without them opening the app" warning latest of all.

CI prints a reminder when a push touches `supabase/functions/**`. Treat it as a
to-do, not noise.
Turn **JWT verification OFF** for this function (dashboard: Edge Functions →
notify-refills → its settings → toggle *Verify JWT* off). The function is
instead protected by a secret you set in the next step, sent as a custom header
— this avoids the service-role-key mismatch that causes a "403 Forbidden".

### 4. Set the secrets (3 min)
Dashboard → Edge Functions → notify-refills → **Secrets** → add **two**:

| Name | Value |
|---|---|
| `FCM_SERVICE_ACCOUNT` | the entire contents of the JSON from step 1, pasted as one value |
| `CRON_SECRET` | any long password YOU make up (e.g. a random 30+ char string). You'll reuse this exact value in steps 5 and 6. |

(CLI alternative: `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)" CRON_SECRET="your-long-password"`)

### 5. Enable the scheduler (3 min)
Dashboard → Database → **Extensions** → enable `pg_cron` **and** `pg_net`.
Then open `supabase/cron.sql`, replace the two placeholders (`<PROJECT-REF>`,
and `<CRON-SECRET>` = the same password you set above), and run it in the SQL
editor once. (Already scheduled an older version? Run
`select cron.unschedule('notify-refills-daily');` first.)

### 6. Send yourself a test (2 min)
1. In the app: Settings → enable push (the toggle stores your token).
2. Trigger a scan manually — SQL editor (same `<CRON-SECRET>` as above):
   ```sql
   select net.http_post(
     url     := 'https://<PROJECT-REF>.functions.supabase.co/notify-refills',
     headers := jsonb_build_object(
       'Content-Type',  'application/json',
       'x-cron-secret', '<CRON-SECRET>'
     ),
     body    := '{}'::jsonb
   );
   ```
3. Check the response in
   `select status_code, content from net._http_response order by id desc limit 1;`
   — you should see `200` and `{"users":1,...,"sent":N}`. If an item is
   genuinely low, the notification appears (close the tab first to see the
   background path).
4. No low items? Temporarily set one supply's quantity to 0, re-run, restore it.

## How it decides to notify (so the alerts stay trustworthy)

- **Lead time**: `notification_prefs.lead_time_days`, else your profile's
  safety buffer, else 14 — the same threshold the app's UI alarms against.
- **Estimates never alarm**: items without a usage rate only alert on facts
  (0 on hand, or a real expiration date inside the lead window) — identical to
  the in-app `displayStatus` rule.
- **Gap alerts** (insurance moat) fire only for items with a known rate AND a
  refill cycle (days-between-refills + last-filled), when runway < eligibility.
- **Dedupe**: one alert per item per kind per 3 days (`notification_log`).
  Undelivered sends are not logged, so they retry the next day.
- **Quiet hours**: per-user window (default 22:00–08:00 in your profile's
  timezone); a user inside the window is skipped and caught up next run.
- **Dead tokens** (uninstalled browser/profile) are deleted automatically.

## Secrets checklist (nothing committed)
- Firebase **web** config + VAPID key: public by design, already in the repo
  (`src/lib/firebase/config.ts`).
- Firebase **service-account JSON** → only the `FCM_SERVICE_ACCOUNT` function
  secret (step 4).
- **service_role key** → only inside the pg_cron job's SQL (step 5) and your
  test call. Never in the repo, never in the browser.
- Keep the Supabase project awake (free tier pauses after ~7 idle days) — the
  daily cron call itself counts as activity once this is set up.

## Kept in sync by hand (note for future changes)
`notify-refills/index.ts` embeds ports of `src/lib/depletion.ts` and
`src/lib/refill.ts` (pure logic, no imports available across that boundary).
If either module changes, re-port — the function's header comment says the same.

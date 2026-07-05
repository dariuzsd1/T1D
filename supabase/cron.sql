-- ============================================================================
-- Schedule the notify-refills Edge Function (docs/PUSH_NOTIFICATIONS.md step 5).
--
-- Run this ONCE in the Supabase SQL editor, AFTER:
--   1. Dashboard → Database → Extensions → enable  pg_cron  and  pg_net
--   2. The notify-refills function is deployed (step 3 of the doc)
--
-- Replace the two placeholders below before running:
--   <PROJECT-REF>       your project ref (the subdomain of your Supabase URL)
--   <SERVICE-ROLE-KEY>  Dashboard → Settings → API → service_role (secret!)
--
-- 14:00 UTC daily ≈ morning in the US / afternoon in Europe. Per-user quiet
-- hours are respected inside the function itself, so one global time is fine.
-- ============================================================================

select cron.schedule(
  'notify-refills-daily',
  '0 14 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT-REF>.functions.supabase.co/notify-refills',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <SERVICE-ROLE-KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Useful afterwards:
--   select * from cron.job;                                  -- confirm it exists
--   select * from cron.job_run_details order by start_time desc limit 5;
--   select cron.unschedule('notify-refills-daily');          -- to remove it

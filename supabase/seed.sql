-- ============================================================================
-- T1D Supply Hub — OPTIONAL synthetic sample data
-- ============================================================================
-- Run this AFTER supabase/setup.sql, and AFTER you've signed into the app at
-- least once (the magic-link login creates your row in auth.users, which this
-- script needs to attach sample data to your account).
--
-- HOW TO USE:
--   1. Change the email on the next line to the one you log in with.
--   2. Paste the whole file into Supabase → SQL Editor → Run.
--
-- It is IDEMPOTENT: every row it creates is tagged (supplies via model='SAMPLE',
-- the prescription via a known rx_number, site_changes via their sample supplies)
-- and deleted before re-inserting, so re-running never duplicates. It only ever
-- touches its own sample rows — your real data is untouched. To remove the
-- samples later, see the cleanup block at the very bottom.
-- ============================================================================

do $$
declare
  -- 👇 CHANGE THIS to the email you sign in with:
  v_email text := 'dariuzsd1@gmail.com';
  uid uuid;
  cat_pump uuid;
  cat_cgm  uuid;
  cat_insulin uuid;
  s_pods uuid;
  s_sensors uuid;
begin
  select id into uid from auth.users where lower(email) = lower(v_email) limit 1;

  if uid is null then
    raise notice 'No user found for %, — sign into the app once, then re-run. Nothing was changed.', v_email;
    return;
  end if;

  select id into cat_pump    from public.supply_categories where name = 'patch_pump' limit 1;
  select id into cat_cgm     from public.supply_categories where name = 'cgm_sensor' limit 1;
  select id into cat_insulin from public.supply_categories where name = 'insulin'    limit 1;

  -- Clean any prior sample rows for this user (idempotent re-run).
  delete from public.site_changes
    where user_id = uid
      and supply_id in (select id from public.supplies where user_id = uid and model = 'SAMPLE');
  delete from public.supplies     where user_id = uid and model = 'SAMPLE';
  delete from public.prescriptions where user_id = uid and rx_number = 'SAMPLE-RX-001';

  -- ── Supplies: a deliberate spread that exercises every dashboard state ──────
  -- 1) WELL STOCKED — a sensor every ~10 days, 9 on hand → ~90 days.
  insert into public.supplies (user_id, name, brand, model, category_id, quantity, unit, expiration_date, usage_rate_per_day)
  values (uid, 'Dexcom G7 Sensors', 'Dexcom', 'SAMPLE', cat_cgm, 9, 'sensors', (current_date + 300), 0.1);

  -- 2) REORDER SOON (low) — ~0.1 vial/day, only 1 left → ~10 days, under the 14-day buffer.
  insert into public.supplies (user_id, name, brand, model, category_id, quantity, unit, expiration_date, usage_rate_per_day)
  values (uid, 'Humalog U-100 Vial', 'Eli Lilly', 'SAMPLE', cat_insulin, 1, 'vials', (current_date + 120), 0.1);

  -- 3) REFILL-CYCLE item — a pod every ~3 days; lights up the Forecast eligibility marker.
  --    90-day supply last filled 80 days ago → eligible very soon.
  insert into public.supplies (user_id, name, brand, model, category_id, quantity, unit,
                               expiration_date, usage_rate_per_day, refill_interval_days, last_filled_date)
  values (uid, 'Omnipod 5 Pods', 'Insulet', 'SAMPLE', cat_pump, 6, 'pods',
          (current_date + 200), 0.34, 90, (current_date - 80))
  returning id into s_pods;

  -- 4) NEAR EXPIRY — plenty of stock, but expiry in 20 days caps the runway (amber FEFO note).
  insert into public.supplies (user_id, name, brand, model, category_id, quantity, unit, expiration_date, usage_rate_per_day)
  values (uid, 'FreeStyle Libre 3 Sensors', 'Abbott', 'SAMPLE', cat_cgm, 4, 'sensors', (current_date + 20), 0.07)
  returning id into s_sensors;

  -- ── Site changes: a recent pod application + an older sensor application ─────
  insert into public.site_changes (user_id, supply_id, applied_date, expected_duration_days, notes)
  values
    (uid, s_pods,    (current_date - 2),  3,  'Sample: upper-left abdomen'),
    (uid, s_sensors, (current_date - 9), 10,  'Sample: back of left arm');

  -- ── One sample prescription (renewal logic reads these dates) ───────────────
  insert into public.prescriptions
    (user_id, medication_name, dosage, prescriber, pharmacy, rx_number,
     written_date, expiration_date, refills_remaining, last_filled_date, notes)
  values
    (uid, 'Insulin Lispro (Humalog)', 'U-100, 3 vials/90 days', 'Dr. A. Rivera',
     'CVS Specialty', 'SAMPLE-RX-001',
     (current_date - 80), (current_date + 285), 2, (current_date - 80),
     'Sample prescription — safe to delete.');

  raise notice 'Seeded sample data for % (user %).', v_email, uid;
end $$;

-- ============================================================================
-- CLEANUP (optional) — remove all sample data later. Edit the email and run:
-- ----------------------------------------------------------------------------
-- do $$
-- declare v_email text := 'maria.benkirane1@gmail.com'; uid uuid;
-- begin
--   select id into uid from auth.users where lower(email)=lower(v_email);
--   if uid is null then return; end if;
--   delete from public.site_changes where user_id=uid
--     and supply_id in (select id from public.supplies where user_id=uid and model='SAMPLE');
--   delete from public.supplies      where user_id=uid and model='SAMPLE';
--   delete from public.prescriptions where user_id=uid and rx_number='SAMPLE-RX-001';
-- end $$;
-- ============================================================================

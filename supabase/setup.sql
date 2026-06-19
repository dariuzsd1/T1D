-- ============================================================================
-- T1D Supply Hub — COMPLETE database setup (single source of truth)
-- ============================================================================
-- Run this ONCE in your Supabase project: Dashboard → SQL Editor → New query →
-- paste everything → Run. It creates every table, security policy, and trigger
-- the app needs. It is **idempotent** — safe to re-run; it won't duplicate or
-- destroy your real data (the optional sample-data block at the very bottom is
-- the only part that touches rows, and only rows it marked itself).
--
-- This supersedes running the individual docs/*_MIGRATION.md files piecemeal.
-- Every column here matches what the code reads/writes (verified against
-- src/lib/store.ts, src/app/api/inventory/route.ts, src/lib/prescriptions.ts,
-- src/lib/caregivers.ts, src/types/database.ts).
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- Shared helper: keep updated_at fresh on every UPDATE.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================================
-- 1. SUPPLY CATEGORIES  (shared catalog, not PHI — readable by any signed-in user)
-- ============================================================================
create table if not exists public.supply_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

alter table public.supply_categories enable row level security;

drop policy if exists "categories readable by authenticated" on public.supply_categories;
create policy "categories readable by authenticated" on public.supply_categories
  for select to authenticated using (true);

insert into public.supply_categories (name, description) values
  ('patch_pump',   'Insulin patch pumps and pods (e.g. Omnipod)'),
  ('cgm_sensor',   'Continuous glucose monitor sensors (e.g. Dexcom, Libre)'),
  ('infusion_set', 'Infusion sets and cannulas for tubed pumps'),
  ('insulin',      'Insulin vials, pens, and cartridges'),
  ('bg_supply',    'Test strips, lancets, ketone strips'),
  ('other',        'Anything else')
on conflict (name) do nothing;


-- ============================================================================
-- 2. SUPPLIES  (the core inventory — PHI, Row-Level Security on)
--    Columns consolidated from: base schema + REFILL_RULES + BARCODE migrations.
-- ============================================================================
create table if not exists public.supplies (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  category_id     uuid references public.supply_categories(id) on delete set null,
  brand           text,
  model           text,
  quantity        numeric not null default 1,
  unit            text not null default 'pieces',
  expiration_date date,
  -- How many units the user goes through per day. NULL = not set yet; the app
  -- then shows an honest conservative *estimate* instead of a fabricated number.
  usage_rate_per_day numeric,
  -- Out-of-pocket copay the user pays per refill (cost & savings layer). NULL =
  -- not entered → simply not counted; we never guess a price.
  copay numeric,
  -- Insurance refill-window engine (src/lib/refill.ts):
  refill_interval_days integer,
  last_filled_date     date,
  -- Barcode/GS1 scan capture (src/lib/gs1.ts):
  barcode         text,
  lot_number      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- For older projects that created `supplies` before these columns existed:
alter table public.supplies
  add column if not exists model                text,
  add column if not exists usage_rate_per_day    numeric,
  add column if not exists copay                 numeric,
  add column if not exists refill_interval_days integer,
  add column if not exists last_filled_date      date,
  add column if not exists barcode               text,
  add column if not exists lot_number            text;

create index if not exists supplies_user_id_idx on public.supplies(user_id);

alter table public.supplies enable row level security;

drop policy if exists "own supplies" on public.supplies;
create policy "own supplies" on public.supplies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists supplies_set_updated_at on public.supplies;
create trigger supplies_set_updated_at before update on public.supplies
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 3. SITE CHANGES  (injection/pod-site rotation history — PHI)
--    Drives "days remaining" in src/app/api/inventory/route.ts.
-- ============================================================================
create table if not exists public.site_changes (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  supply_id              uuid references public.supplies(id) on delete cascade,
  applied_date           date not null default current_date,
  expected_duration_days integer not null default 3,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists site_changes_user_id_idx on public.site_changes(user_id);

alter table public.site_changes enable row level security;

drop policy if exists "own site changes" on public.site_changes;
create policy "own site changes" on public.site_changes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists site_changes_set_updated_at on public.site_changes;
create trigger site_changes_set_updated_at before update on public.site_changes
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 4. PRESCRIPTIONS  (PHI) — matches src/lib/prescriptions.ts (PrescriptionRow)
-- ============================================================================
create table if not exists public.prescriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  medication_name   text not null,
  dosage            text,
  prescriber        text,
  pharmacy          text,
  rx_number         text,
  written_date      date,
  expiration_date   date,
  refills_remaining integer,
  last_filled_date  date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists prescriptions_user_id_idx on public.prescriptions(user_id);

alter table public.prescriptions enable row level security;

drop policy if exists "own prescriptions" on public.prescriptions;
create policy "own prescriptions" on public.prescriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists prescriptions_set_updated_at on public.prescriptions;
create trigger prescriptions_set_updated_at before update on public.prescriptions
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 5. CAREGIVER SHARES  (who the patient has granted access to)
--    Matches src/lib/caregivers.ts (CaregiverShareRow).
-- ============================================================================
create table if not exists public.caregiver_shares (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  caregiver_email text not null,
  role            text not null default 'view'  check (role in ('view','manage')),
  status          text not null default 'accepted' check (status in ('invited','accepted','revoked')),
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  unique (owner_id, caregiver_email)
);

alter table public.caregiver_shares enable row level security;

drop policy if exists "owner manages shares" on public.caregiver_shares;
create policy "owner manages shares" on public.caregiver_shares
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "caregiver sees own invites" on public.caregiver_shares;
create policy "caregiver sees own invites" on public.caregiver_shares
  for select using (lower(caregiver_email) = lower(auth.jwt() ->> 'email'));

-- Cross-account READ access: a caregiver with an accepted share can read the
-- patient's supplies + prescriptions. Additive to the "own rows" policies.
drop policy if exists "caregiver can view shared supplies" on public.supplies;
create policy "caregiver can view shared supplies" on public.supplies
  for select using (
    exists (
      select 1 from public.caregiver_shares cs
      where cs.owner_id = supplies.user_id
        and cs.status = 'accepted'
        and lower(cs.caregiver_email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "caregiver can view shared prescriptions" on public.prescriptions;
create policy "caregiver can view shared prescriptions" on public.prescriptions
  for select using (
    exists (
      select 1 from public.caregiver_shares cs
      where cs.owner_id = prescriptions.user_id
        and cs.status = 'accepted'
        and lower(cs.caregiver_email) = lower(auth.jwt() ->> 'email')
    )
  );


-- Add owner_email to caregiver_shares so a caregiver can see whose data they
-- are viewing (Phase 3). Owner inserts their own email at invite time.
alter table public.caregiver_shares
  add column if not exists owner_email text;

-- Manage-role write access (Phase 3): caregivers with role='manage' can UPDATE
-- and DELETE the patient's supplies, and UPDATE site_changes. The existing SELECT
-- policies already let any accepted caregiver read those rows.
drop policy if exists "caregiver can manage shared supplies" on public.supplies;
create policy "caregiver can manage shared supplies" on public.supplies
  for update using (
    exists (
      select 1 from public.caregiver_shares cs
      where cs.owner_id = supplies.user_id
        and cs.role = 'manage'
        and cs.status = 'accepted'
        and lower(cs.caregiver_email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "caregiver can delete shared supplies" on public.supplies;
create policy "caregiver can delete shared supplies" on public.supplies
  for delete using (
    exists (
      select 1 from public.caregiver_shares cs
      where cs.owner_id = supplies.user_id
        and cs.role = 'manage'
        and cs.status = 'accepted'
        and lower(cs.caregiver_email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists "caregiver can manage shared site changes" on public.site_changes;
create policy "caregiver can manage shared site changes" on public.site_changes
  for update using (
    exists (
      select 1 from public.caregiver_shares cs
      where cs.owner_id = site_changes.user_id
        and cs.role = 'manage'
        and cs.status = 'accepted'
        and lower(cs.caregiver_email) = lower(auth.jwt() ->> 'email')
    )
  );


-- ============================================================================
-- 6. APPOINTMENTS  (endo/visit cadence — PHI; type exists in database.ts, no UI yet)
-- ============================================================================
create table if not exists public.appointments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  description      text,
  appointment_date timestamptz not null,
  appointment_type text not null default 'endocrinology',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists appointments_user_id_idx on public.appointments(user_id);

alter table public.appointments enable row level security;

drop policy if exists "own appointments" on public.appointments;
create policy "own appointments" on public.appointments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 7. PUSH NOTIFICATIONS  (for later — used by the FCM Edge Function, not the
--    running frontend yet; see docs/PUSH_NOTIFICATIONS.md). Harmless to create now.
-- ============================================================================
create table if not exists public.fcm_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);
alter table public.fcm_tokens enable row level security;
drop policy if exists "own tokens" on public.fcm_tokens;
create policy "own tokens" on public.fcm_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.notification_prefs (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  push_enabled      boolean not null default true,
  lead_time_days    integer not null default 14,
  quiet_hours_start smallint default 22,
  quiet_hours_end   smallint default 8,
  created_at        timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
drop policy if exists "own prefs" on public.notification_prefs;
create policy "own prefs" on public.notification_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ============================================================================
-- 8. MEDICAL ID  (emergency card — PHI). The user may OPT IN to expose a
--    read-only copy via an unguessable link so a first responder can see it
--    without logging in. Matches src/lib/medicalId.ts.
-- ============================================================================
create table if not exists public.medical_profiles (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  full_name               text,
  date_of_birth           date,
  blood_type              text,
  diagnosis               text,
  insulin_types           text,
  devices                 text,
  allergies               text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  doctor_name             text,
  doctor_phone            text,
  notes                   text,
  is_public               boolean not null default false,
  public_token            uuid not null default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.medical_profiles enable row level security;

drop policy if exists "own medical profile" on public.medical_profiles;
create policy "own medical profile" on public.medical_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists medical_profiles_set_updated_at on public.medical_profiles;
create trigger medical_profiles_set_updated_at before update on public.medical_profiles
  for each row execute function public.set_updated_at();

-- There is intentionally NO anon SELECT policy on this table. Public read happens
-- ONLY through this security-definer function, ONLY when the user opted in
-- (is_public) AND the caller presents the exact unguessable token — so the table
-- can't be enumerated. Date of birth is deliberately NOT returned.
create or replace function public.get_public_medical_id(p_token uuid)
returns table (
  full_name               text,
  blood_type              text,
  diagnosis               text,
  insulin_types           text,
  devices                 text,
  allergies               text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  doctor_name             text,
  doctor_phone            text,
  notes                   text
)
language sql
security definer
set search_path = public
as $$
  -- Columns are qualified with the `mp` alias so they don't collide with the
  -- identically-named RETURNS TABLE output columns ("ambiguous column" error).
  select mp.full_name, mp.blood_type, mp.diagnosis, mp.insulin_types, mp.devices,
         mp.allergies, mp.emergency_contact_name, mp.emergency_contact_phone,
         mp.doctor_name, mp.doctor_phone, mp.notes
  from public.medical_profiles mp
  where mp.public_token = p_token and mp.is_public = true
$$;

grant execute on function public.get_public_medical_id(uuid) to anon, authenticated;


-- ============================================================================
-- 9. MEDICAL DEVICES  (pumps / CGMs the user owns — PHI). Consumable supplies
--    link to a device via supplies.device_id, so a pump can show its
--    reservoirs / sensors / infusion sets together. Matches src/lib/devices.ts.
-- ============================================================================
create table if not exists public.medical_devices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  brand       text not null,
  model       text,
  kind        text not null default 'pump' check (kind in ('pump','cgm','pen','meter')),
  nickname    text,
  started_on  date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists medical_devices_user_id_idx on public.medical_devices(user_id);

alter table public.medical_devices enable row level security;

drop policy if exists "own devices" on public.medical_devices;
create policy "own devices" on public.medical_devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists medical_devices_set_updated_at on public.medical_devices;
create trigger medical_devices_set_updated_at before update on public.medical_devices
  for each row execute function public.set_updated_at();

-- Link a consumable supply to the device it feeds (nullable — most supplies are
-- standalone). on delete set null so removing a device never deletes its supplies.
-- Created here (after medical_devices exists) so the FK resolves on a fresh run.
alter table public.supplies
  add column if not exists device_id uuid references public.medical_devices(id) on delete set null;

create index if not exists supplies_device_id_idx on public.supplies(device_id);


-- ============================================================================
-- 10. PRODUCTS  (diabetes-supply reference catalog — not PHI, public read)
--     Populated from data/diabetes_catalog.csv via Supabase dashboard CSV import
--     or scripts/load_catalog.py. GTINs filled by scripts/enrich_gtins.py.
--     Powers barcode→product lookup in /api/scan/lookup + scan/page.tsx.
-- ============================================================================
create table if not exists public.products (
  id                           uuid primary key default gen_random_uuid(),
  category                     text,
  brand                        text,
  product_name                 text not null,
  common_names                 text,
  gtin                         text unique,
  unit                         text,
  units_per_box                integer,
  typical_usage_per_day        numeric,
  default_refill_interval_days integer,
  rx_required                  boolean default false,
  notes                        text,
  source_url                   text,
  last_verified                date,
  created_at                   timestamptz not null default now()
);

-- Partial index: only rows with a real GTIN need to be looked up by GTIN.
create index if not exists products_gtin_idx on public.products(gtin) where gtin is not null;

alter table public.products enable row level security;

-- Reference data only — no PHI. Any authenticated user may read; no user writes.
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select using (true);


-- ============================================================================
-- 11. PROFILES  (Phase 5 — display name for each user; auto-created on signup)
-- ============================================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new user is created (magic link,
-- password sign-up, or OAuth). ON CONFLICT DO NOTHING makes it safe for
-- existing accounts that already have rows.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill a profile row for any user that signed up before this table existed.
-- Safe to re-run; ON CONFLICT prevents duplicates.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;


-- ============================================================================
-- DONE. Tables + security are ready. Sample data is in supabase/seed.sql
-- (optional — run that separately after you've signed in once).
-- ============================================================================

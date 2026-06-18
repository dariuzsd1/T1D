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
-- DONE. Tables + security are ready. Sample data is in supabase/seed.sql
-- (optional — run that separately after you've signed in once).
-- ============================================================================

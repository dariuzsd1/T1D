# Turning on Prescriptions + Caregiver sharing

The app already has the **Prescriptions** and **Caregivers** pages built. They
just need two new tables in your database. Until you run this, those pages show a
friendly "one quick setup step" prompt instead of crashing — nothing breaks.

This is a one-time, ~3-minute copy-paste in your Supabase dashboard. **You don't
need to touch any code.**

---

## Step 1 — Open the SQL editor

1. Go to [supabase.com](https://supabase.com) and open your project.
2. Left sidebar → **SQL Editor** → **+ New query**.

## Step 2 — Paste and run all of this

```sql
-- ============================================================
-- 1. PRESCRIPTIONS  (PHI — protected by Row-Level Security)
-- ============================================================
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

alter table public.prescriptions enable row level security;

-- The owner can do anything with their own prescriptions.
create policy "own prescriptions" on public.prescriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 2. CAREGIVER SHARES  (who you've granted access to)
-- ============================================================
create table if not exists public.caregiver_shares (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  caregiver_email text not null,
  role            text not null default 'view'
                    check (role in ('view','manage')),
  status          text not null default 'accepted'
                    check (status in ('invited','accepted','revoked')),
  created_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  unique (owner_id, caregiver_email)
);

alter table public.caregiver_shares enable row level security;

-- The patient (owner) manages their own list of caregivers.
create policy "owner manages shares" on public.caregiver_shares
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- A caregiver can see the invites addressed to their email.
create policy "caregiver sees own invites" on public.caregiver_shares
  for select
  using (lower(caregiver_email) = lower(auth.jwt() ->> 'email'));

-- ============================================================
-- 3. CROSS-ACCOUNT ACCESS  (the actual sharing)
--    A caregiver with an active share can READ the patient's
--    supplies and prescriptions. These are ADDITIONAL policies;
--    your existing "own rows" policies still apply.
-- ============================================================
create policy "caregiver can view shared supplies" on public.supplies
  for select
  using (
    exists (
      select 1 from public.caregiver_shares cs
      where cs.owner_id = supplies.user_id
        and cs.status = 'accepted'
        and lower(cs.caregiver_email) = lower(auth.jwt() ->> 'email')
    )
  );

create policy "caregiver can view shared prescriptions" on public.prescriptions
  for select
  using (
    exists (
      select 1 from public.caregiver_shares cs
      where cs.owner_id = prescriptions.user_id
        and cs.status = 'accepted'
        and lower(cs.caregiver_email) = lower(auth.jwt() ->> 'email')
    )
  );
```

Press **Run** (Ctrl/Cmd + Enter). You should see "Success. No rows returned."

> If your project predates the `auth.jwt()` helper, replace
> `auth.jwt() ->> 'email'` with `auth.email()` (newer Supabase) — both return the
> signed-in user's email.

## Step 3 — Use it

- **Prescriptions** page: add medications, dosages, refills-left, and expiry. The
  app flags **"Needs renewal"** when refills hit zero or a prescription has
  expired, and **"Renew soon"** as it approaches — all from the real dates you
  enter, nothing fabricated.
- **Caregivers** page: add a caregiver by email and choose **view** or
  **view & manage**. Remove them any time to cut access immediately.

---

## What works now vs. what's next (being honest)

**Works now:** you can manage prescriptions fully, and manage exactly who you've
shared with. The cross-account policies above mean a caregiver who signs in with
the invited email is genuinely authorized by the database to read your supplies
and prescriptions.

**Not built yet (documented next steps):**
- **A caregiver "viewing as" switch.** The current dashboard shows the
  *signed-in* user's own data, so a caregiver logging in still lands on their own
  dashboard. A "you're viewing **Alex's** supplies" account-switch is the next
  piece to surface the access the policies already grant.
- **Automatic invite emails.** We record the share, but don't email the caregiver
  yet — share the app link with them directly. (Hooking Supabase Auth invites or
  Resend is the future step.)
- **The `manage` role** currently grants the same *read* access as `view` at the
  database level. Write access for caregivers (logging use / edits on someone
  else's data) needs its own `update`/`insert` policies — add them when the
  "viewing as" flow lands so writes are unambiguous.

## Security notes

- Both tables have **Row-Level Security on**. By default each user only sees their
  own rows; the cross-account policies *additively* grant a caregiver read access
  only while an `accepted` share exists. Revoking (deleting the share) removes it.
- Prescriptions are PHI. Keep your Supabase project on a plan with a signed BAA
  before storing real patient data (per CLAUDE.md §5).

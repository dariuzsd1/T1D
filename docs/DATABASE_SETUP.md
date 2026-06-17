# Database setup — the one guide to follow

This is the **single, complete** setup for the app's backend. Run it once and every
page (inventory, forecast, prescriptions, caregivers) has real data to work with.

> This **supersedes** running the individual `docs/*_MIGRATION.md` files
> (`REFILL_RULES_MIGRATION`, `PRESCRIPTIONS_CAREGIVERS_MIGRATION`, `BARCODE_SCANNING`,
> and the DB part of `PUSH_NOTIFICATIONS`). Those stay as background explanations, but
> `supabase/setup.sql` already contains everything they do. **You only run the two files
> in `supabase/`.**

You do **not** need to edit any app code. Total time: ~10 minutes.

---

## Step 1 — Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) → sign in → **New project**.
2. Pick a name (e.g. `t1d-supply-hub`), set a **database password** (save it somewhere),
   choose the region closest to you, and create it. Wait ~2 min for it to provision.

## Step 2 — Copy your two keys

1. In the project: **Project Settings** (gear) → **API**.
2. Copy these two values:
   - **Project URL** → e.g. `https://abcd1234.supabase.co`
   - **anon public** key (under "Project API keys") → a long string.

> The `anon` key is safe to expose to the browser — Row-Level Security protects the
> data. Do **not** use the `service_role` key in the app.

## Step 3 — Connect the app to Supabase

1. In the project folder, copy `.env.example` to a new file named `.env.local`.
2. Fill in the two values from Step 2:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```
3. If you deploy on **Vercel**, add those same two variables in
   Vercel → your project → **Settings → Environment Variables**, then redeploy.

## Step 4 — Create all the tables

1. In Supabase: left sidebar → **SQL Editor** → **+ New query**.
2. Open `supabase/setup.sql` from this repo, copy **everything**, paste it in, and click
   **Run** (Ctrl/Cmd + Enter).
3. You should see **"Success. No rows returned."**
4. Check **Table Editor** — you'll see `supplies`, `site_changes`, `prescriptions`,
   `caregiver_shares`, `supply_categories`, `appointments`, plus the push tables, each
   with a **RLS** (Row-Level Security) badge.

> `setup.sql` is safe to re-run anytime — it only creates what's missing and never
> deletes your data.

## Step 5 — Sign in once (required before seeding)

1. Run the app: `npm run dev` → open `http://localhost:3000`.
2. You'll land on **/login**. Enter the email you want to use and click **Send magic
   link**. Check your inbox and click the link — you're now signed in.
3. The dashboard will be **empty** for now — that's expected; the next step fills it.

> ⚠️ **Why this order matters:** the sample-data script attaches rows to *your* account,
> which only exists in the database after your first sign-in. Magic-link email works out
> of the box on Supabase's free tier — no email setup needed.

## Step 6 — Add sample data (so the app shows something)

1. Open `supabase/seed.sql`. Near the top, change the email line to the **same email you
   just logged in with**:
   ```sql
   v_email text := 'you@example.com';
   ```
2. Copy the whole file into a new SQL Editor query and **Run** it.
3. You should see a notice like *"Seeded sample data for …"*. (If it says "No user
   found", you haven't completed Step 5 with that exact email yet.)

`seed.sql` is also safe to re-run — it replaces its own sample rows instead of
duplicating them. To remove the samples later, use the cleanup block at the bottom of
that file.

## Step 7 — See it work

Reload the app. You should now see:
- **Dashboard** — sample supplies sorted into **"Reorder soon"** vs **"Well stocked"**,
  one flagged as expiring soon.
- **Forecast** (calendar) — a **teal "refill-eligible" marker** for the Omnipod sample
  (it has a refill cycle), and run-out markers for the others.
- **Prescriptions** and **Caregivers** — load normally (no "one quick setup step"
  prompt). Add a prescription or a caregiver and it persists.

Try **Use one** on a card, **Edit** a supply's refill cycle, or add your own real
supply via **Scan** — all of it saves to Supabase.

---

## Important: this is for your own / synthetic data only

Until the project is on a paid plan with a signed **BAA**, do **not** store other
people's real medical data (PHI). Use your own data or the synthetic samples. This
matches CLAUDE.md §5 and the reason the false "HIPAA compliant" claims were removed.

## Troubleshooting

| Symptom | Fix |
|---|---|
| App shows a connection error / login does nothing | `.env.local` values wrong or dev server not restarted after editing it. Restart `npm run dev`. |
| `seed.sql` says "No user found" | Sign in once (Step 5) with the **exact** email in `v_email`, then re-run. |
| A page says "one quick setup step" | You haven't run `setup.sql` yet (Step 4), or ran it on a different project than your env vars point to. |
| Caregiver policy error mentioning `auth.jwt()` | Very old project: replace `auth.jwt() ->> 'email'` with `auth.email()` in `setup.sql` and re-run. |

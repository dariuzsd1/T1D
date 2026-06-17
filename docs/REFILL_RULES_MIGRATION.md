# Activating the insurance refill-window engine

The app already contains the **refill-window engine** (`src/lib/refill.ts`) and
the UI that shows it (the calendar's teal "refill-eligible" markers and the
"you'll run out before your refill date" warnings). It's wired and waiting — it
just needs two new columns in your database to store each item's refill cycle.

This is a one-time, 2-minute step you do in your Supabase dashboard. **You do not
need to touch any code**, and the app code is already forward-compatible: the
moment these columns exist, the feature lights up on its own.

---

## What this adds

| Column | Meaning |
|---|---|
| `refill_interval_days` | How many days one filled supply is meant to last (e.g. `90` for a 90-day supply). |
| `last_filled_date` | The date you last picked up / received that supply. |

From those two values the engine computes **when your insurance will let you
refill** (most US plans allow it once ~75% of the days are used) and compares it
against when you'll actually run out — so it can warn you *before* you're stuck.

---

## Step 1 — Open the SQL editor

1. Go to [supabase.com](https://supabase.com) and open your project.
2. In the left sidebar, click **SQL Editor**.
3. Click **+ New query**.

## Step 2 — Paste and run this

```sql
alter table public.supplies
  add column if not exists refill_interval_days integer,
  add column if not exists last_filled_date date;
```

Click **Run** (or press Ctrl/Cmd + Enter). You should see "Success. No rows
returned." That's it — the columns now exist.

> These columns are **optional** (nullable). Existing supplies keep working
> exactly as before; items without a refill cycle simply don't show
> eligibility info — nothing is fabricated.

## Step 3 — Add a refill cycle to an item (to see it work)

Once the columns exist, you can set them **right inside the app**:

1. On your dashboard, hover a supply card and click the **pencil (Edit)** icon.
2. In the dialog, fill in the **Refill cycle** section:
   - **Supply length (days)** — e.g. `90` for a 90-day supply.
   - **Last filled** — the date you last received it.
3. Click **Save changes**.

> (You can also set `refill_interval_days` and `last_filled_date` directly in
> **Table Editor → `supplies`** if you prefer.)

Now open the app's **Forecast** (calendar) page. You'll see:
- a **teal "refill-eligible" marker** on the date insurance allows a refill, and
- if you'd run out before then, a **"request an early-refill override"** warning.

> Before you run the migration, the app still works normally — it just quietly
> skips saving the refill cycle (you'll see a one-line note in the browser
> console). Nothing breaks.

---

## Security note

These columns live on the `supplies` table, which is already protected by
Row-Level Security (each user can only read/write their own rows). No extra RLS
policy is needed — the new columns inherit the table's existing protection.

## That's it

The in-app **Edit supply** dialog already has the Refill cycle inputs, and the
calendar already knows how to display eligibility. Running the SQL above is the
only step needed to turn the whole feature on.

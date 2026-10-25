# Pre-launch stress test and go-public risk audit — brief for a fresh session

Paste the whole of this into a new chat, in the repo root. It is written to be
handed to an assistant with no memory of this project.

Keep this file. Re-run the brief after any significant change, and append what
the audit found so the next run starts from a higher floor.

---

## CONTEXT

You are auditing **T1D Supply Hub**, a Next.js 16 / React 19 / TypeScript app on
Supabase (Postgres + Auth + Edge Functions), deployed on Vercel. Read `CLAUDE.md`
first — it is the source of truth for product decisions and architecture — then
`BACKLOG.md`, `docs/DATABASE_SETUP.md` and `supabase/setup.sql`.

What it does: it manages the **logistics** of Type 1 Diabetes — supplies,
refills, site rotation — not the disease. It forecasts when someone will run out
of insulin, sensors, pods and infusion sets, tells them when insurance will let
them refill, and pushes a daily notification so they never have to open the app
to find out. It currently has **one user, the author**. The plan is to open it to
diabetic communities internationally.

Its design principle, stated throughout the code, is that **the app must never
fabricate a number**. An unknown usage rate shows a labelled estimate and is
excluded from every alarm, rather than guessing. Two audits (2026-09, 2026-10)
hardened this; the `audit-punchlist` notes in `.claude` memory and `git log`
carry the detail. Current state: 511 tests, `tsc`/`eslint`/`build` clean,
`npm run check:catalog` clean.

## YOUR ROLES — apply all four to everything

1. **Professional site stress tester / red-teamer.** Break it. Load, abuse,
   multi-tenancy, auth, injection, enumeration, rate limits, denial of service,
   data leakage between accounts.
2. **A person living with Type 1 Diabetes.** You depend on this being right. A
   wrong reorder date means you ration insulin or go to an ER. You are not
   technical and you are using this on a phone, tired, at 2am.
3. **An endocrinologist / diabetes specialist.** Judge clinical safety, the
   defensibility of every number shown, what a patient could misread, and where
   the app strays toward clinical advice it is not licensed to give.
4. **A diabetes supply distributor / DME operator.** Judge whether the refill,
   dispensing-cycle and insurance-window model survives contact with how
   supplies are actually dispensed, in multiple countries.

## HARD GROUND RULES

- **Verify, never assert.** Run the code. Query the database. Read the row back.
  This project's hardest-won lesson is that a green test suite proves nothing
  about the data: seven real bugs survived 511 passing tests and surfaced only
  when a live table was queried. If you claim something is broken or safe, show
  the command and its output.
- A `2xx` is not proof. A PostgREST write refused by RLS returns `HTTP 200 []`.
- Do not fix anything in this pass unless it is a one-line, zero-risk fix. The
  deliverable is the audit. Propose, prioritise, then wait.
- Severity every finding: **blocker / high / medium / low**, with the concrete
  failure (inputs → wrong output or exposure), not a category label.
- Say plainly when something needs a lawyer, a clinician, or a paid vendor
  rather than code. Do not code around a legal gate.
- "It needs to be perfect" is not a usable bar. The usable bar is **no
  unmitigated blocker or high**, every medium consciously accepted, and a
  written go/no-go. Tell the author if you think they should not launch yet.

## ALREADY-KNOWN SURFACES — verify and go deeper, do not just restate

These were found by reading the code. Each is confirmed to exist; none has been
assessed for a public launch. Start here, then look for what this list misses.

**Unauthenticated PHI endpoint.** `supabase/setup.sql` defines
`get_public_medical_id(uuid)` as `security definer`, granted to `anon`. Given a
token it returns full name, blood type, diagnosis, allergies, emergency contacts
and doctor details. It is the emergency medical-ID card (`src/app/id/[token]`).
Assess: token entropy and enumerability, rate limiting, revocation, the token
living in a URL (browser history, referrer headers, proxy logs, screenshots),
whether `is_public` is the only gate, and what a scraper could harvest.

**World-readable storage.** The `avatars` bucket is created with `public: true`
(`setup.sql` ~line 715). Assess object-path guessability, whether user ids leak
through filenames, listing permissions, and upload abuse (size, type, quota).

**Row-Level Security is the entire multi-tenancy boundary.** Every PHI table is
keyed on `auth.uid() = user_id`, and caregiver sharing adds *additive* policies
gated on `status = 'accepted'`. This has never been tested with a hostile second
account. Assess: can account B read, update or delete any of account A's
supplies, prescriptions, devices, site changes, appointments or medical profile,
directly or via the caregiver tables? Try crafting a share row yourself.

**The push sender runs with the service role and processes every user in one
invocation.** `supabase/functions/notify-refills/index.ts` fetches all tokens,
all supplies, all prefs and all profiles with no pagination, then loops. It is
deployed with `--no-verify-jwt` and protected only by a secret header. Assess the
scaling cliff (wall clock, memory, FCM throughput), what happens on partial
failure mid-loop, whether the secret is strong and rotatable, and whether a
leaked secret lets someone spam every user's device.

**Free tier.** A `keepalive` workflow exists specifically to dodge Supabase's
7-day inactivity pause. Assess the real ceilings — database size, egress,
monthly active users, Edge Function invocations, FCM quota — and the first one
that breaks, with numbers.

**No error monitoring of any kind.** No Sentry, no logging service. Going public
blind to runtime errors. Propose the minimum viable setup, noting that error
payloads from a PHI app must not ship PHI to a third party.

**No rate limiting or bot defence** on signup, auth, or any API route.

**Catalog coverage is the quiet product risk.** `data/diabetes_catalog.csv` is
136 products, heavily US with some German and French entries. Everything the app
can forecast depends on recognising a product. A user whose pump, sensor or
insulin is not in it gets `unset` everywhere: no runway, no reorder date, no
alerts. For an international launch, assess coverage per major market, how a user
contributes a missing product, and what the app does — honestly — when it does
not recognise what someone owns.

**Internationalisation is partial.** UI copy is English, French and Spanish.
But `src/lib/refill.ts` returns **hardcoded English** assessment messages that
the calendar renders raw. Pack sizes, dispensing cycles, insurance-window
behaviour and even insulin brand availability differ by country; the refill
engine models US-style plan rules (eligible at X% used, or N days before
run-out). Assess what breaks for a user in the UK, Germany, India or Brazil.

**Deliberately out of scope — do not touch, and do not propose work on:**
- Dark-mode visual design (delegated elsewhere by the author).
- Prescription-photo intake (`CLAUDE.md` §4) — on a legal hold, not a backlog
  item.

## AREAS TO COVER THAT THE LIST ABOVE DOES NOT

Work these out yourself; the list above is a floor, not a ceiling.

1. **Legal and compliance.** This stores real diabetics' health data. `CLAUDE.md`
   §3 states a Supabase paid tier and a BAA are required before handling real
   PHI at scale, and that compliance claims must never be advertised untruthfully.
   Assess HIPAA exposure (US users), GDPR (EU users — lawful basis, data
   subject rights, deletion, export, data residency; the project is hosted in
   `eu-west-1`), and what minimum paperwork a public launch requires. Be explicit
   that this needs a lawyer.
2. **Medical-device regulation.** Software that tells a patient when they will
   run out of insulin sits near clinical decision support. Assess the risk that
   this is classed as a medical device (EU MDR Annex VIII Rule 11; FDA
   general-wellness vs SaMD), what the app must *not* claim, and what disclaimers
   and wording changes reduce the risk. Flag for professional advice.
3. **Clinical safety at the edges.** Where can the app still be confidently
   wrong? Pay attention to the insulin in-use discard window, concentrated
   insulins (U-200/U-300/U-500), paediatric low doses, pump priming waste,
   sensor failures, and the interaction of several corrections at once. Try to
   construct an input that produces a dangerous number.
4. **Data loss and recovery.** Backups, point-in-time recovery on the current
   tier, what an accidental destructive migration would cost, and whether a user
   can export their own data.
5. **Account lifecycle.** Deletion, caregiver revocation, orphaned shares, email
   change, and what happens to a caregiver's access when the patient leaves.
6. **Trust and honesty in the UI.** The app's whole claim is that it never
   fabricates. Find every place it still shows a number a user could mistake for
   a verified fact, and every alarm that could fire on an assumption.
7. **Support and feedback load.** One maintainer. What arrives in week one from a
   diabetes subreddit or Facebook group, and what is needed before that is
   survivable — a bug channel, a catalog-contribution route, a status page, a
   privacy policy and terms, a way to answer "is my data safe".
8. **The rollout itself.** Propose a staged plan: private beta size, who to
   recruit, what to instrument before launch (success metrics are not yet
   built), what to say publicly about accuracy and limitations, and the
   kill-switch if something is badly wrong.

## DELIVERABLE

1. **Go / no-go**, in one paragraph, up front, with the single biggest reason.
2. **Findings table**: severity, one-line title, the file or surface, the
   concrete failure, the fix, and rough effort.
3. **Blockers**, each with a reproduction and a verified fix plan.
4. **A staged rollout plan** with the gate that must be met before each stage.
5. **What you could not verify** and what access or decision would be needed to
   close it. Be explicit about this — an unverified assumption presented as a
   finding is the failure mode this project has been fighting all along.

Begin by reading `CLAUDE.md`, then tell me your plan before you start running
things.

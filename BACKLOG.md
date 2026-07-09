# Backlog

Non-urgent, buildable work, each scoped enough to hand off with zero back-and-forth. Pick one, branch
off `main`, verify with `npx tsc --noEmit` + `npm test` + `npm run build`, push, leave for review — do
not merge without the user's say-so unless told otherwise.

For anything mid-flight or awaiting merge right now, check the `user-todo` memory file instead — this
file is stable planning, not a status log.

---

## ✅ Done, awaiting review/merge (built 2026-07-07)

All five items below this line were completed in one pass and pushed as five independent branches
(each verified separately: tsc clean, tests green, clean build). None are merged yet — review and
merge whenever, in any order (no file overlap between them):

1. **Test coverage** for the untested pure functions — `test/pure-function-coverage`
2. **Dark-mode tokens** wired via `prefers-color-scheme` — `feat/dark-mode`
3. **Accessibility sweep** (8 buttons losing their accessible name mid-loading-state, fixed; Toast.tsx
   migrated off hardcoded colors so it works in dark mode too) — `fix/a11y-sweep`
4. **Wear-clock auto-depletion**, supplement model (manual logging still wins; auto-decrement only
   fills the gap between taps) — `feat/wear-clock-auto-depletion`. Needs `supabase/setup.sql` re-run
   once merged (adds `supplies.auto_depleted_through`, idempotent).
5. **TanStack Query POC**, Home + Supplies pages only, as scoped — `feat/tanstack-query-poc`

The detailed acceptance criteria that guided each of these are preserved in git history (see each
branch's commit message) rather than repeated here now that they're done.

---

## ✅ `types/database.ts` — resolved by deletion (2026-07-08)

Turned out to be dead code: confirmed zero imports anywhere in `src`. Every lib file already defines
its own manual Row interface + `rowToX()` mapper (appointments.ts, devices.ts, caregivers.ts,
prescriptions.ts, medicalId.ts, etc.) — that's the app's real, consistent pattern, and neither
Supabase client (`src/lib/supabase/client.ts` / `server.ts`) uses a `createClient<Database>()`
generic. Regenerating a stale-but-unused file would have just produced an accurate-but-unused file.
User chose deletion over regenerating-as-reference or the larger "wire it in everywhere" option (the
latter would mean typing both Supabase clients against it and likely fixing small mismatches across
every existing manual Row interface — a real refactor, not a backlog-sized item; revisit as its own
scoped task if ever wanted).

---

## Five-persona re-audit follow-ups (2026-07-08)

A fresh pass of the original five expert audits (MASTER_SUGGESTIONS.md) against the current repo.
Nearly the entire original roadmap has shipped; the app moved from the original D/B+ range to A-/A.
These are the genuine remaining gaps each persona surfaced, scoped as buildable work. Grades and the
full narrative live in the audit write-up (delivered in chat 2026-07-08); this is the actionable log.

### [Technical, A-] The one real coverage gap: no route/component tests
All 16 test files are pure-logic unit tests. Nothing exercises `/api/inventory`, the caregiver
route, or an actual page render — so a regression in the data path or a broken page wouldn't be
caught by CI (only tsc + build would). Also: CI runs tsc + unit tests + build but NOT `npm run lint`.
- **Scope:** (a) add a route-handler test for `/api/inventory` (mock the Supabase client, assert the
  runway-shaped response) and the caregiver read route; (b) optionally one Playwright smoke test that
  loads `/dashboard` against a seeded local DB; (c) add a `lint` step to `.github/workflows/ci.yml`.
- **Acceptance:** CI fails on a broken inventory route or a lint error; tests still green.

### [Domain/Product, A-] Deepen the insurance refill engine (the #1-ranked feature, still shallow)
`src/lib/refill.ts` models a single generic "refill at ~75% of days-supply" rule. The moat is
per-plan eligibility. Give `assessRefill` real inputs: days-supply, refill-at-% OR refill-at-day,
mail-order vs retail (90 vs 30), and a few common plan presets the user can pick per supply.
- **Needs a small product decision first:** which rule shapes to model (don't over-engineer to every
  US plan). Recommend: {daysSupply, refillThresholdPct, channel} covers the vast majority.
- **Scope:** extend RefillRule + a `refill_rules` concept (could reuse the existing supply columns
  refill_interval_days/last_filled_date plus one new `refill_threshold_pct`), unit-tested; surface the
  real eligible date on the calendar + reorder + home. **Blocked on:** the product decision above.

### [Domain/Product, A-] Sick-day / travel "surge buffer" mode
The safety buffer is a single steady number. A temporary mode that raises it for a set window
(travel, sick season) matches audit item #7 (buffer against reserve, not zero) more fully.
- **Scope:** a time-boxed buffer override in the store + a Settings control; runway/alert math already
  reads `safetyBufferDays`, so this is mostly a UI + a stored {untilDate, bufferDays}. Small-medium.

### [Backend/Cost, A] $0 keep-warm insurance against the Supabase 7-day pause
The deployed daily `notify-refills` cron already keeps the project warm, but only if push stays
deployed. A free GitHub Actions weekly cron that pings a lightweight endpoint (e.g. `/api/health`)
is belt-and-suspenders so the DB never pauses even if push is ever turned off.
- **Scope:** one `.github/workflows/keepalive.yml` on a weekly schedule doing a curl to the health
  route. Tiny. No app code.

### [Design, A] Dark-mode human visual QA + rotation-figure review
Dark mode's contrast was verified with the WCAG luminance formula, but no human has eyeballed the
highest-traffic screens (dashboard home, ProductCard, RiskAlertBanner, AppNav, calendar) in dark
mode in a real browser. Pair this with the long-deferred site-rotation SVG body-figure proportions
review (already tracked in the user-todo memory).
- **Scope:** run the app, toggle dark, screenshot the 5 screens, fix any surprise; separately, the
  figure geometry review. Needs the app running (not a headless task).

---

## Decision-required / user-side (from the same audit — not buildable without you)

- **[Strategy, B+] Deep-vs-broad.** The app is broad (works for any brand) but the *moat* — real
  insurance-rule intelligence + a closed reorder loop + device auto-sync — is still deep-link-shallow
  or vendor-blocked. The original strategy said "deep before broad for ONE ecosystem (Omnipod +
  Dexcom)." Decide whether to go deep on one ecosystem's reorder loop next, or keep breadth. This is a
  positioning call only you can make.
- **[Strategy, B+] Instrument the success metric.** Opt-in analytics exists but the roadmap's actual
  success metric ("% of reorder cycles completed without a stockout alert reaching zero") isn't
  measured. If wanted, add funnel events to `src/lib/analytics.ts` — small, but only worth it if
  you'll look at the numbers.
- **[Backend/Cost, A] HIPAA + hosting at funding/scale.** Still correctly deferred: no third-party
  PHI while unfunded, no false compliance claims. Revisit HIPAA/BAA (~$599/mo) and Vercel Hobby→Pro
  (Hobby is non-commercial) only if this ever goes multi-user or commercial. Not now.

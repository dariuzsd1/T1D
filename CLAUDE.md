@AGENTS.md
# CLAUDE.md — T1D Supply Hub

Source of truth for product decisions, priorities, known issues, and architecture.
**Read this at the start of every session. Update it when significant decisions are made.**

---

## 0. The one-paragraph thesis

This app manages the **logistics of diabetes** (supplies, refills, rotation), not the **disease**
(glucose, dosing). That's a real, underserved wedge — every other app fights the glucose battle and
ignores the "I'm out of pods and it's Sunday" panic. Because of that, this app will **never** be
opened reflexively the way a CGM app is, and that's fine. Its entire path to relevance runs through
being **proactive and nearly invisible**: it reaches out at the right moment and closes the loop.

**Vision, one sentence:** the user never runs out of supplies and never has to open the app to make
that happen.

**The moat:** insurance-refill-window intelligence + a closed reorder loop + device-driven
auto-tracking. The headline a user should see is not "runs out in 5 days" — it's
**"refill-eligible Thursday — tap to reorder."** Nobody owns this. Build it.

---

## 1. Current state (be honest about this)

> **Status update 2026-06-17:** Phase 0 and (essentially) Phase 1 are now done.
> Both broken pages compile and are restored; auth migrated to `@supabase/ssr`
> with `getUser()` (middleware is now `src/proxy.ts` — Next 16 renamed it);
> false compliance/openFDA claims removed; depletion math is honest
> (`src/lib/depletion.ts`) with a safety buffer; OCR confidence floors + DoS cap
> fixed; matchCache bounded; expiration capture + edit modal added; and the
> **"Calm Clinical" light-first redesign (§6) is implemented app-wide** with a
> mobile bottom-nav. **Still open:** FCM push (see `docs/PUSH_NOTIFICATIONS.md`,
> needs your Firebase/Supabase setup) and the still-mocked scanner (Phase 2).
> The two-halves description below is retained as historical context.
>
> **Phase 2 progress (2026-06-17):** The moat scaffolding is in, all code-only /
> CI-safe. Built: the **insurance refill-window engine** (`src/lib/refill.ts`:
> `assessRefill` → `gap` flags running out before insurance allows a refill);
> **one-tap reorder deep-links** (`src/lib/suppliers.ts`, wired into the cards +
> calendar as real hand-off links); the **calendar** now overlays run-out +
> teal refill-eligible markers + gap warnings (data-gated); **1-tap site
> rotation** (site-tracker "Mark as used" also decrements a linked supply).
> Refill persistence needs a 2-min DB step — see
> `docs/REFILL_RULES_MIGRATION.md` (the read path is already forward-compatible
> via `select('*')`, so it lights up the moment the columns exist).
>
> **Phase 2 batch 3 (2026-06-17), zero new deps:** (1) **Real barcode scanner**
> on the Add-a-supply page via the browser-native Barcode Detection API
> (`src/components/scan/BarcodeScanner.tsx`, ambient types in
> `src/types/barcode-detector.d.ts`) — no npm dep, Chrome/Safari, graceful manual
> fallback. GS1 labels are parsed (`src/lib/gs1.ts`) to auto-fill the real
> **expiration date** + capture GTIN/lot (honest: only surfaces decoded fields).
> Optional `barcode`/`lot_number` columns are best-effort writes
> (`docs/BARCODE_SCANNING.md`). The photo path is still the legacy mock. (2)
> **Prescriptions** manager — full CRUD page (`/dashboard/prescriptions`) with
> honest renewal nudges derived from real dates (`src/lib/prescriptions.ts`). (3)
> **Caregiver share** (`/dashboard/caregivers`) — invite by email + view/manage
> role + revoke. Both new pages are *table-missing-safe* (show a setup prompt, no
> crash) until `docs/PRESCRIPTIONS_CAREGIVERS_MIGRATION.md` runs (creates
> `prescriptions` + `caregiver_shares` with RLS, incl. cross-account caregiver-read
> policies on supplies/prescriptions). New desktop sidebar links; mobile tab bar
> kept to 4 core items. **Honest gaps documented:** caregiver "viewing-as" switch,
> auto-invite emails, manage-role writes, GTIN→product directory. **Still blocked
> on external access:** device auto-depletion (vendor API keys/OAuth), FCM push
> (Firebase keys).

The app is in **two halves that don't connect**:
- A thoughtful "production pipeline" (`pipeline.ts`, `ocrExtractor.ts`, `apiMatcher.ts`,
  `durationEstimator.ts`) exposed via four API routes.
- A UI (`scan/page.tsx`) that **ignores all of it** and uses a hardcoded `mockResult` behind a
  `setTimeout(4000)`.

So the impressive backend is unreachable dead code, and the visible product is a mock. Two of five
feature pages don't compile and are commented out of the nav. The depletion math users currently see
is **not trustworthy** (server default `remainingDays = 30`, usage rate 0.5/1, actions don't
recompute). For a medical-supply tool, untrustworthy numbers are the cardinal sin.

Maturity: strong visual/UI craft, prototype-grade engineering. **Not production-ready.**

| Area | Grade | One-line |
|---|---|---|
| Visual / UI design | A− | Polished, but wrong emotional register (see §6) |
| Correctness | D | Two pages broken, key endpoint missing await, UI is mocked |
| Security | D | `getSession()` for authz, deprecated auth lib, false compliance claims |
| Architecture | C− | Duplicated divergent logic, dead pipeline, serverless-hostile singletons |
| Accessibility | C− | Contrast, alert(), unlabeled controls |
| Mobile | C | No nav for small screens, fixed-height panels |

---

## 2. Tech stack (settled)

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **Supabase** (managed Postgres) for auth + DB — **this is the right backend, keep it** (see §5)
- **zustand** client store
- **Tailwind** UI
- OCR/entity-extraction pipeline exists — **demote to fallback**, not primary intake path

---

## 3. Critical issues (fix first — "stop the bleeding")

- **C1 — `calendar/page.tsx` doesn't compile.** `useStore` used but not imported; `addDays` missing
  from date-fns import; references undefined `FORECAST_EVENTS`; an unreachable `'warning'` urgency
  branch. Rebuild around refill-eligibility (don't just patch).
- **C2 — `site-tracker/page.tsx` doesn't compile.** `useStore` not imported; `AnimatePresence` not
  imported. These two are why the nav links are commented out in `AppNav.tsx:21-23`.
- **C3 — `/api/scan/match` missing `await`** (`route.ts:38`). `executeAPIMatch` is async but called
  without await; endpoint always returns `{status: undefined, top_matches: undefined}`.
- **C4 — The entire scan pipeline is unreachable; the UI is a mock.** `scan/page.tsx:50-62` hardcodes
  `mockResult` (always Omnipod 5, 94%) and never calls `/api/scan/analyze`. The "Validated against
  openFDA" badge (`scan/page.tsx:268`) is **false** — `fdaDatabase` is 8 hardcoded rows.
- **C5 — Authorization relies on `getSession()`** (middleware, inventory route, page.tsx). Supabase
  warns this reads a **spoofable** cookie. **Use `getUser()` server-side.** Most serious security bug.
- **C6 — False compliance claims on a medical app.** `login/page.tsx:118-120` advertises "HIPAA
  Compliant" and "End-to-End Encryption." Neither is true. Legal/regulatory liability for PHI —
  **remove until a BAA and real controls exist.**
- **C7 — Deliberate 5% random failure shipped in a real path.** `apiMatcher.ts:68`
  `if (Math.random() < 0.05) throw "SIMULATED_NETWORK_FAILURE"`. Remove the fault injector.

---

## 4. Medium issues (next)

- **M1 — Server "singletons" leak across requests in serverless.** `telemetry.ts:15` `logs[]` never
  clears and is returned in API responses → leaks other users' logs in a warm lambda. `matchCache`
  Map never evicts → unbounded memory. Make request-scoped; stop returning debug logs to clients.
- **M2 — Misleading confidence scores.** `ocrExtractor.ts:122-125` forces `Math.max(90,…)` /
  `Math.max(70,…)`, so a barely-matched item still reports ≥90%/≥70%. The ConfidenceBadge instinct
  is right; the math undermines it.
- **M3 — Duplicated divergent logic.** Root `/lib/*` and `/src/lib/*` are different implementations;
  scripts import from both. **Delete `/lib` and `index.html`; one canonical pipeline in `src/lib`.**
- **M4 — "Use One" / "Pod Change" don't affect days-remaining.** `ProductCard.tsx:25` /
  `QuickActionHub.tsx:14` decrement quantity, but `remainingDays` is derived server-side from
  `site_changes` and isn't recomputed. Headline number appears to do nothing.
- **M5 — Client mutations swallow errors but UI reports success** (`store.ts:60-101`). Surface
  failures to the user.
- **M6 — Inventory category hardcoded** (`medical_supply` / `unknown`). `durationEstimator` branches
  on category, so duration estimation can't work end-to-end even if wired. Build a real category map.
- **M7 — Deprecated auth library.** `@supabase/auth-helpers-nextjs` → migrate to `@supabase/ssr`;
  thread refreshed auth cookies through middleware (token refresh is currently lost).
- **M8 — Unbounded OCR input = DoS vector** (`ocrExtractor.ts:75-84`, O(words³)·Fuse, no cap). Cap input.
- **M9 — PHI in localStorage** (`store.ts:110`) unencrypted, survives logout. Stop or scope/clear it.

---

## 5. Architecture decisions (settled)

**Backend: stay on Supabase (managed Postgres). Do NOT migrate to Firebase.** The data is relational
and PHI-regulated (catalogs ↔ prescriptions ↔ inventory ↔ insurance rules) — Postgres's home turf,
Firestore's weak spot. Supabase is portable Postgres (pg_dump exit), has RLS for PHI isolation, and
native search. **Firebase's only role is FCM for push notifications** — a component, not the backend.

Target architecture:
- **Auth:** Supabase Auth, migrated to `@supabase/ssr`, server-side checks via `getUser()` (fixes C5/M7).
- **Data:** normalized schema — `products`, `prescriptions`, `medical_devices`,
  `device_consumables` (join), `supplies` (inventory, FK→products), `site_changes`,
  `insurance_rules`, `appointments`. **Row-Level Security on every PHI table, keyed by `user_id`.**
- **Search:** Postgres `pg_trgm` + `tsvector` (replaces client-side Fuse.js). Algolia/Typesense only
  if typo-tolerant instant-search at scale is needed later.
- **Refill reminders:** `pg_cron` eligibility scan → Supabase Edge Function → **FCM push** (+ email/SMS
  via Resend/Twilio).
- **Cross-platform:** Next.js web now; React Native/Expo later sharing the Supabase client.
- **Compliance:** Supabase paid tier + BAA before real PHI; drop false claims until then.

---

## 6. Visual design direction (settled): "Calm Clinical"

**Lead finding:** the current UI is styled like an **ER triage console** (near-black `#050505`,
pulsing red dots, glowing shadows, vocabulary like "Triage," "Urgent Depletion," "Critical Shortage").
The audience is often someone **diagnosed three weeks ago and frightened.** Category leaders
(Dexcom, Libre, Tidepool, Tandem) do the opposite: light, calm, generous whitespace, semantic color.
**A newly diagnosed T1D would not feel comfortable here.** Fix this.

Principles to adopt:
- **Light-first, calm-clinical.** Neutral canvas, one accent for action, semantic color used sparingly.
- **One glanceable hero number per card.**
- **Demote red.** Red ONLY for a true stockout/emergency. Routine low-stock uses **amber**.
- **Plain, supportive language.** "Your supplies" not "Triage Dashboard"; "Running low" not "Urgent
  Depletion"; "Reorder soon" not "Critical Shortage."
- **Type:** base 16px min (stop dipping to 8–10px), headings 600–700 (not 900), `font-black` reserved
  for the single hero number, sentence case, uppercase only ≥12px and rare. Scale: 28/22/18/16/14/12.

Palette ("Calm Clinical", light-first, dual mode):
```
Canvas    bg #F6F8FB  surface #FFFFFF  surface-2 #EEF2F7  border #DCE3EC
Text      ink #16202E  muted #51606F  faint #6B7A89   (all AA+ on white)
Brand     primary #1E6FE0  primary-deep #134FA3  accent-teal #0E9384
Semantic  success #1F8F4E/#E7F6EC   caution #B26B00/#FBF1DF   urgent #C8341F/#FBE9E6
Dark mode base #0F172A (slate, NOT pure black)  surface #1B2638  text #E6ECF3
```

Accessibility checklist: all text ≥4.5:1 (≥3:1 large); never status-by-color-alone (pair color +
icon + word); `aria-label` on all icon-only controls; replace `alert()` with accessible toasts
(`role="status"`, focus-trapped); visible `focus-visible:ring-2`; respect `prefers-reduced-motion`;
touch targets ≥44×44px; label inputs with `htmlFor`; name the SVG body-map buttons.

Mobile: replace the fixed `w-64 h-screen` sidebar with a **bottom tab bar** (Home / Rotate / Add /
Calendar), thumb-reachable, labeled, ≥44px targets. Add small-screen variants for `p-12`/`text-4xl`.

---

## 7. Feature roadmap

### MVP — "Trustworthy counts + proactive alerts" (prove the wedge)
- Fix depletion math; **separate three numbers**: stock-on-hand vs current-item wear/expiry vs
  expiration date. One honest sentence per item ("4 pods left; ~12 days; reorder by Tue").
- Configurable **safety buffer** ("always keep ≥2 weeks") so alerts fire against reserve, not zero.
- **Expiration / lot tracking** — surface the dormant `expiration_date` field + FEFO ("use oldest first").
- **Proactive push notifications (FCM)** — the cheapest high-impact feature; see §8.
- **User accounts + personalization** — see §8.
- Retuned dashboard; manual entry + manual "Use One" as the **interim** input method only.
- Cut: OCR pipeline, duplicate `/lib`, `index.html`, false compliance/openFDA claims. Rebuild/hide
  the two broken pages.
- Success metric: % of users who complete a reorder cycle without a stockout alert reaching zero.

### V2 — "Close the loop + make it effortless" (the moat)
- **Insurance refill-window engine** — model each item's plan rule (e.g. "90-day supply, refill at
  75% used / day 68"). Model `daysUntilInsuranceLetsMeRefill` and reconcile against `remainingDays`.
- **One-tap reorder / supplier hand-off** — deep-links first, then real integrations for ONE
  ecosystem (Omnipod + Dexcom covers a huge share). Edgepark/Byram/CCS/US MED/local pharmacy.
- **Device-driven auto-depletion** — Dexcom, Libre, Omnipod, Tandem (via Tidepool/Nightscout/vendor
  APIs). Sensor/pod session start → decrement inventory + suggest a rotation log. Kills manual logging.
- **Barcode/GTIN + manifest scan** replaces OCR (scan the pharmacy/shipping label once to ingest a
  whole 90-day order; barcodes carry lot/expiry — faster and more accurate than fuzzy text matching).
- Rebuilt **eligibility-based calendar** (overlay "runs out" + "refill-eligible" per item).
- **1-tap site rotation** tied to the pod-change action (one interaction: −1 pod, log site, advance
  rotation). Show real elapsed time; say "unknown" when unknown — never fake "Optimal."
- Prescription manager + renewal nudges; emergency/travel mode + medical-ID card; caregiver share.
- Success metric: % of refills initiated on the earliest eligible day.

### V3 — "Platform + outcomes"
- Broaden device/insurer/DME coverage; cost/copay/savings layer + deductible-aware year-end stock-up.
- Wire the existing `Appointment` type: endo cadence linking supplies ↔ prescriptions ↔ visits.
- Predictive usage modeling (sick-day/seasonal/activity-adjusted burn rates).
- B2B: clinic dashboards, manufacturer partnerships, real HIPAA/BAA posture.

### Cut / defer
- OCR "AI" pipeline as conceived (mocked, duplicated, fuzzy-matches marketing text) → replace with
  barcode/GTIN + manifest scan.
- `index.html` mockup and duplicate `/lib` → delete.
- "Confidence badges," "validated against openFDA," telemetry/debug-log plumbing → strip until real.
- Manual "Use One" as a primary flow → fallback only.

---

## 8. New features requested by the user (build into the above)

### Push notifications (FCM)
The single highest-ROI delivery mechanism. A "rarely-opened" app only works if it reaches the user
**off-device**. The banner that only fires inside the app is useless — the user isn't in the app when
they run low.
- Implement via **Firebase Cloud Messaging** (the one sanctioned Firebase role; backend stays Supabase).
- Trigger source: `pg_cron` eligibility scan → Supabase Edge Function → FCM (+ optional email/SMS).
- Notification content should be specific and actionable, e.g. "You'll run out of pods 4 days before
  your next eligible refill. Tap to request an override." / "Refill-eligible Thursday — tap to reorder."
- Respect quiet hours and let the user choose channels (push / email / SMS) and thresholds.
- Requires storing FCM device tokens per user (PHI-adjacent — keep under RLS).

### User accounts + personalized experience
Auth already exists (Supabase magic-link). Extend it from "a login gate" into a **personalization
foundation** so alerts, math, and eligibility are tailored to the individual.
- Migrate auth to `@supabase/ssr` + `getUser()` first (fixes C5/M7) — do not build personalization on
  the spoofable session check.
- A first-run **onboarding** that captures the profile the rest of the product depends on:
  which pump/CGM ecosystem (Omnipod/Tandem/Dexcom/Libre), typical usage rate / TDD, insurance plan +
  refill cadence, pharmacy/DME supplier, safety-buffer preference, notification preferences.
- Persist this as a per-user profile under **RLS**; use it to drive personalized depletion math,
  eligibility dates, and notification timing.
- Add **biometric unlock** (holds health data) and, later, **caregiver/share access** (parents,
  partners co-manage supplies).
- Personalization must obey §6 honesty rules: tailor with real user-entered data; never fabricate
  status.

---

## 9. How to use this file

When making any implementation decision, check it against:
1. **Is this value derived from real data?** If not, don't show it — prompt to collect the data.
2. **Can this be automated?** Every manual step (scan, entry, tap) is a point of abandonment.
3. **Does this require the user to open the app?** The most important alerts should reach them without it.
4. **Does this serve the moat** (eligibility timing → reorder → auto-tracking), or is it engineering theater?

Update this file when significant architectural decisions are made or new gaps are found.
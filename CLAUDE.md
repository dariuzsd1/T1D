@AGENTS.md
# CLAUDE.md — T1D Supply Hub

Source of truth for product decisions, priorities, and architecture.
**Read this at the start of every session.** This file stays lean and current-state only —
chronological history of what shipped when lives in `git log` and the auto-memory system
(`phase_progress.md`, `user-todo.md`). Update this file when a settled decision changes; don't let
it re-accumulate a status log.

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
**"refill-eligible Thursday — tap to reorder."** Nobody owns this. Keep building toward it.

---

## 1. Current state

MVP and the V2 "moat" roadmap are both shipped and live, not aspirational. Auth runs on
`@supabase/ssr` + server-side `getUser()` (never `getSession()` for authorization). Depletion math
is honest end-to-end (`src/lib/depletion.ts`): estimates never alarm, a safety buffer gates "reorder
soon," and every touchpoint (client, `/api/inventory`, the Edge Function) shares the same engine.
The "Calm Clinical" redesign (§5) is implemented app-wide, including a mobile bottom-nav. Barcode
scanning is real (browser Barcode Detection API + GS1 parsing) — the old mocked OCR/AI pipeline was
deleted entirely, not demoted. Push notifications (FCM) are deployed and verified working end to end
(daily `pg_cron` → Edge Function → FCM, confirmed by a real delivered notification). The app is
translated across every page in English, French, and Spanish. Caregiver sharing's consent gate is
verified: an invited-but-not-accepted caregiver has zero read access; accepting grants it. Device-aware
Quick Actions replaced the hardcoded Insulet/Dexcom quick-log buttons. Dark mode has both an OS-follow
default and a manual light/dark/system toggle in Settings (cookie-persisted, contrast-verified). An
optional per-device biometric app-lock (Face ID/Windows Hello/fingerprint via WebAuthn) is available,
opt-in only, with a reset-on-device safety net — never a forced auth factor. Wear-clock auto-depletion
(supplement model — manual logging always wins) fills the gap when a wearable's site/device change is
never logged by hand. TanStack Query covers Home, Supplies, Reorder, and Calendar (shared cache, one
`useInventory()` hook); the rest of the dashboard still uses the original `useEffect` + fetch pattern.
The insurance refill engine models two real per-plan rule shapes (eligible at X% of days-supply used,
or N days before run-out), editable per supply. Reorder is still a hand-off to a supplier's site (no
vendor API), but the app now tracks it: a self-reported "Mark as ordered" note quiets the proactive
nags (banner + push) for a grace window without ever hiding a true stockout. All routes build clean;
the test suite is green (170+ tests as of 2026-07-09).

**Known still-open, non-urgent (check `user-todo.md` memory for anything actively in flight):**
- Expanding TanStack Query beyond Home/Supplies/Reorder/Calendar to the rest of the dashboard.
- No route/component/E2E test coverage (unit tests only, though CI now also runs `eslint` on every
  push) — the remaining technical gap identified by the 2026-07-08 re-audit.
- Success-metric instrumentation (e.g. reorder-cycle completion rate) — not yet built.
- True one-tap reorder via a supplier/DME API (real Edgepark/Byram/CCS integration) — needs a vendor
  partnership, not just code; today's self-reported order tracking is the honest interim step.
- Device-driven auto-depletion (Dexcom/Omnipod/Tandem session → auto-decrement) — blocked on vendor
  OAuth access, not something to build speculatively.
- Predictive/sick-day usage modeling and the B2B/HIPAA-BAA tier are V3, blocked on funding/legal.
- **Prescription-photo intake is intentionally on hold** — see §4, a legal-review gate, not a backlog item.

---

## 2. Tech stack (settled)

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **Supabase** (managed Postgres) for auth + DB — the right backend, keep it (see §3)
- **zustand** client store
- **Tailwind** UI
- Barcode/GTIN scanning is the intake path (`src/lib/gs1.ts`, `src/components/scan/BarcodeScanner.tsx`).
  The earlier OCR/fuzzy-match pipeline was fully removed — do not resurrect that approach.

---

## 3. Architecture decisions (settled)

**Backend: stay on Supabase (managed Postgres). Do NOT migrate to Firebase.** The data is relational
and PHI-regulated (catalogs ↔ prescriptions ↔ inventory ↔ insurance rules) — Postgres's home turf,
Firestore's weak spot. Supabase is portable Postgres (pg_dump exit), has RLS for PHI isolation, and
native search. **Firebase's only role is FCM for push notifications** — a component, not the backend.

- **Auth:** Supabase Auth via `@supabase/ssr`, server-side checks via `getUser()` only.
- **Data:** normalized schema — `products`, `prescriptions`, `medical_devices`,
  `device_consumables` (join), `supplies` (inventory, FK→products), `site_changes`,
  `insurance_rules`, `appointments`, `caregiver_shares`. **Row-Level Security on every PHI table,
  keyed by `user_id`** (cross-account caregiver reads are additive policies gated on
  `status = 'accepted'`, never a default-open share).
- **Search:** Postgres `pg_trgm` + `tsvector` if/when typo-tolerant search is needed; no client-side
  fuzzy matching library.
- **Refill reminders:** `pg_cron` eligibility scan → Supabase Edge Function → FCM push (email/SMS via
  Resend/Twilio would be additive channels, not yet built).
- **Cross-platform:** Next.js web now; React Native/Expo later would share the same Supabase client.
- **Compliance:** Supabase paid tier + a BAA are required before handling real PHI at scale; never
  advertise compliance claims ("HIPAA Compliant," "End-to-End Encryption") that aren't true.

---

## 4. Deferred feature: prescription photo intake (legal hold, do not build)

Letting a user photograph a prescription/receipt for auto-categorization is a **real planned
feature**, deliberately scoped down **pending a legal review of health-data handling** (a
prescription image is PHI). **Do not build the auto-categorization, OCR of the script, or any
clinic-messaging/pharmacy trigger from this feature until that review is done.** This note exists
only to preserve the intent — nothing should be implemented from it now.

---

## 5. Visual design system: "Calm Clinical" (settled, implemented app-wide)

Light-first, calm-clinical: neutral canvas, one accent for action, semantic color used sparingly.
Red is reserved for a true stockout/emergency; routine low-stock uses amber. Plain, supportive
language ("Your supplies," "Running low," "Reorder soon" — never "Triage," "Critical Shortage").
Type: base 16px min, headings 600–700, `font-black` reserved for the single hero number, sentence
case, uppercase only ≥12px and rare. Scale: 28/22/18/16/14/12.

Palette (light-first, dual mode — dark-mode values are specified but not yet wired, see §1):
```
Canvas    bg #F6F8FB  surface #FFFFFF  surface-2 #EEF2F7  border #DCE3EC
Text      ink #16202E  muted #51606F  faint #6B7A89   (all AA+ on white)
Brand     primary #1E6FE0  primary-deep #134FA3  accent-teal #0E9384
Semantic  success #1F8F4E/#E7F6EC   caution #B26B00/#FBF1DF   urgent #C8341F/#FBE9E6
Dark mode base #0F172A (slate, NOT pure black)  surface #1B2638  text #E6ECF3
```

Accessibility checklist for any new UI: all text ≥4.5:1 (≥3:1 large); never status-by-color-alone
(pair color + icon + word); `aria-label` on all icon-only controls; accessible toasts/dialogs
(`role="status"`/`role="alertdialog"`, focus-trapped, never a raw `alert()`); visible
`focus-visible:ring-2`; respect `prefers-reduced-motion`; touch targets ≥44×44px; label inputs with
`htmlFor`.

Mobile: bottom tab bar (Home / Rotate / Add / Calendar), thumb-reachable, labeled, ≥44px targets;
secondary pages reachable via the "More" sheet in `AppNav`.

---

## 6. How to use this file

When making any implementation decision, check it against:
1. **Is this value derived from real data?** If not, don't show it — prompt to collect the data.
2. **Can this be automated?** Every manual step (scan, entry, tap) is a point of abandonment.
3. **Does this require the user to open the app?** The most important alerts should reach them without it.
4. **Does this serve the moat** (eligibility timing → reorder → auto-tracking), or is it engineering theater?

Update this file when a settled architectural or design decision changes, or a new hard constraint
(like §4's legal hold) is discovered. For "what shipped when" and in-flight work, check
`phase_progress.md` / `user-todo.md` in the auto-memory system instead of logging it here.

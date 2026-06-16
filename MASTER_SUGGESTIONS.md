# T1D Supply Hub — Master Suggestion File

> Consolidated findings from five expert audits of the T1D Supply Hub codebase
> (Next.js 16 / React 19 / Supabase / zustand / Tailwind).
> Compiled 2026-06-16. Source audits: Technical, Domain/Product, Strategy, Architecture, Visual Design.

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [The Through-Line: Six Recurring Themes](#2-the-through-line-six-recurring-themes)
3. [Audit 1 — Technical & Architecture](#3-audit-1--technical--architecture)
4. [Audit 2 — T1D Domain & Product](#4-audit-2--t1d-domain--product)
5. [Audit 3 — Product Strategy](#5-audit-3--product-strategy)
6. [Audit 4 — Backend Architecture (Firebase?)](#6-audit-4--backend-architecture-firebase)
7. [Audit 5 — UX / Visual Design](#7-audit-5--ux--visual-design)
8. [Unified Prioritized Roadmap](#8-unified-prioritized-roadmap)
9. [Master Feature Ranking](#9-master-feature-ranking)

---

## 1. Executive Summary

The T1D Supply Hub aims to take the logistical load off people with Type 1 Diabetes — tracking supplies (pods, sensors, insulin, infusion sets), forecasting run-out, and managing refills. **It is pointed at a genuinely underserved problem** (diabetes *logistics*, not glucose), and the visual craft and the "production pipeline" code show real ambition.

But across all five audits, one diagnosis repeats: **the project builds the impressive-looking 20% and skips the valuable 80%.** The scan UI is mocked while a real pipeline sits unreachable; the app *warns* about shortages but can't *do* anything about them; the design optimizes for looking clinical rather than feeling reassuring; and the auth/compliance posture makes claims it can't back up.

**Production readiness: not yet.** Two feature pages don't compile, authorization is spoofable, and the numbers shown to patients are not trustworthy — a cardinal sin for a medical tool. The good news: the bones are right, and the path to indispensability is clear and concrete (Sections 8–9).

**The one-sentence strategy:** *Ship cheap credibility now (trustworthy counts + proactive alerts), then build the one thing competitors won't — insurance-eligibility-aware, auto-tracked, one-tap reordering — deeply, for a single device ecosystem, before going broad.*

---

## 2. The Through-Line: Six Recurring Themes

These appeared in **multiple** audits and should drive prioritization:

| # | Theme | Audits raising it | Core action |
|---|---|---|---|
| T1 | **Mock-vs-real disconnect** — scan UI is faked; the real pipeline is dead/duplicated/unreachable | Technical, Strategy | Wire UI to a real (simpler) backend; delete the dead duplicate logic |
| T2 | **Trust & honesty** — false "HIPAA / E2E / openFDA" claims; alarmist tone; spoofable auth | Technical, Domain, Design | Remove false claims; fix auth; earn trust through calm accuracy |
| T3 | **Trustworthy counts** — depletion math is wrong/defaulted; actions don't recompute days | Technical, Domain, Strategy | Make the headline number correct & honest before anything else |
| T4 | **Insurance refill-window engine** — the real unmet need and the product's moat | Domain, Strategy, Architecture | Model refill-eligibility dates, not just run-out dates |
| T5 | **Proactive, off-device, effortless** — alerts must reach users (push/SMS); tracking must be automatic | Domain, Strategy, Architecture | FCM/SMS alerts + device-driven auto-depletion |
| T6 | **Calm-clinical experience** — light, glanceable, supportive; mobile-first | Domain, Design | Redesign tone, palette, type, and navigation for a frightened new user |

---

## 3. Audit 1 — Technical & Architecture

### Critical
- **C1 — `src/app/calendar/page.tsx` won't compile.** Missing `useStore` / `addDays` imports; references undefined `FORECAST_EVENTS` (the variable is `forecastEvents`); a dead `'warning'` urgency branch.
- **C2 — `src/app/site-tracker/page.tsx` won't compile.** Missing `useStore` and `AnimatePresence` imports. (Both pages are commented out of `AppNav` with a "fix missing imports" TODO.)
- **C3 — `/api/scan/match/route.ts` missing `await`** on the async `executeAPIMatch`, so it returns `undefined` fields.
- **C4 — The scan UI is fully mocked.** `scan/page.tsx` hardcodes a result behind a 4s timer; the entire pipeline (`ocrExtractor`, `apiMatcher`, `durationEstimator`, `runPipeline`, and the analyze/match/confirm/duration routes) is unreachable dead code. "Validated against openFDA" is false (8 hardcoded rows).
- **C5 — Spoofable authorization.** `getSession()` is used for authz in middleware, the inventory route, and `page.tsx`; Supabase requires `getUser()` for server-side trust.
- **C6 — False compliance claims** ("HIPAA Compliant", "End-to-End Encryption") on a PHI app.
- **C7 — A 5% `Math.random()` failure injector** shipped in the real matcher path (`apiMatcher.ts`).

### Medium
- Serverless-hostile module singletons: `logger` never clears **and leaks prior requests' logs into API responses**; `matchCache` never evicts.
- Forced-minimum confidence math (`Math.max(90/70, …)`) makes weak matches report high confidence.
- Duplicated, divergent business logic in `/lib` vs `/src/lib`; scripts import from both.
- "Use One" / "Pod Change" decrement quantity but don't recompute `remainingDays`.
- Client mutations swallow errors but the UI reports success.
- Hardcoded inventory category; deprecated `@supabase/auth-helpers-nextjs` (→ `@supabase/ssr`); unbounded OCR input (DoS); PHI persisted to `localStorage`.

### Low
- Accessibility (contrast, `alert()`, unlabeled controls); no mobile nav; metadata still "Create Next App"; `Product` vs `InventoryItem` model drift; no tests/error boundaries/env validation; orphan root `index.html`.

---

## 4. Audit 2 — T1D Domain & Product

**Framing:** the app manages diabetes *logistics*, not the *disease*. It will never be opened reflexively like a CGM app — its path to relevance is being **proactive and nearly invisible**, not a dashboard to visit. **Clinical red flag:** the depletion numbers are currently untrustworthy (server default `remainingDays = 30`, actions don't recompute) — fatal for a medical tool until fixed.

**Per-feature usefulness:**
- **Triage dashboard** — right model, weekly use; ambiguous "days remaining" conflates stock / wear / expiry.
- **Scanner** — monthly burst (shipment day); should use **barcode/GTIN + manifest scan**, not OCR of marketing text.
- **Inventory "Use One"** — manual logging is the #1 adherence killer; infer from device sessions instead.
- **Site rotation tracker** — the one feature with real recurring pull (every 3-day change); make it 1-tap, tied to a pod change.
- **Refill calendar** — best latent value, but must show the **refill-eligible** date, not just "runs out."
- Alerts must move **off-device** (push/SMS).

**Missing QoL features (ranked):**
1. **Insurance refill-window engine** (the killer feature).
2. Close the reorder loop — real pharmacy/DME deep-links (Edgepark, Byram, CCS, US MED).
3. Auto-depletion via device sync (Dexcom / Libre / Omnipod / Tandem / Tidepool / Nightscout).
4. Expiration & lot tracking (FEFO; insulin 28-day in-use clock; glucagon expiry) — surface the dormant `expiration_date` field.
5. Prescription manager (prescriber, Rx#, days-supply, refills-left, Rx-expiry renewal nudges).
6. Emergency/travel mode (backup checklist, in-date glucagon, medical-ID card accessible without login, TSA letter).
7. Sick-day / disaster safety-stock buffer (alert against reserve, not zero).
8. Caregiver / share access (parents, partners).
9. Cost / savings layer (copay, manufacturer savings cards, deductible-aware year-end stock-up).
10. Appointment / endo cadence — the `Appointment` type already exists in `database.ts` with no UI.

---

## 5. Audit 3 — Product Strategy

**Core problem:** the "I'm out of supplies and can't do anything right now" crisis. The app solves the visible 20% (count + warn) and skips the valuable 80% (eligibility timing + reordering).

**The value chain that IS the product:** trustworthy counts → insurance-eligibility dates → proactive off-device alert → one-tap reorder. **Build it end-to-end for ONE ecosystem first** (Omnipod + Dexcom), deep before broad.

**Highest-value bets (all hard — which is exactly why they're the moat):** insurance refill-window engine; one-tap reorder/supplier hand-off; device-driven auto-depletion; proactive push/SMS alerts (cheap — ship first).

**Remove / cut:** the OCR "AI pipeline" (mocked, duplicated, unreachable → replace with barcode/GTIN + manifest scan); duplicate `/lib` + orphan `index.html`; confidence-badge / "openFDA" / telemetry theater; manual "Use One" as a *primary* flow (fallback only); don't "fix" the broken Calendar/Site-Tracker as-is — rebuild Calendar around eligibility, Site-Tracker as a 1-tap byproduct of a pod change (keep site rotation — it's the clinically sticky feature).

---

## 6. Audit 4 — Backend Architecture (Firebase?) — **Cost-Constrained Revision (<$50 total budget)**

> Revised under a hard constraint: **this project must cost as close to $0 as possible** (≤ $50 lifetime). The conclusion below supersedes the original "just stay on Supabase" framing with a cost-first lens.

### The key money insight
**At this app's scale, every option here is $0/month.** Supabase, Firebase, MongoDB Atlas, and Neon all have free tiers that comfortably cover a personal/MVP app with low traffic. **Switching backends does NOT save money — it costs developer time and a rewrite.** Cost is therefore *not* a valid reason to abandon the existing Supabase code. The right budget strategy is "stay on free tiers and avoid anything that can auto-bill," not "pick a different vendor."

> ⚠️ Free-tier limits change often — verify current numbers before relying on them. Figures below reflect general tiers as of the 2026 knowledge cutoff.

### Free-tier reality check
| Option | Free tier (approx.) | Budget footguns |
|---|---|---|
| **Supabase Free** | 500 MB DB, 50K MAU auth, 5 GB egress, 500K Edge fn calls, `pg_cron` included | ❗ Project **pauses after ~7 days of inactivity** (manual restore). No HIPAA/BAA on free. |
| **Firebase Spark (free)** | Firestore 1 GiB, ~50K reads / 20K writes per day; **FCM push: free & unlimited**; Auth free | ❗ **Cloud Functions require the Blaze (pay-as-you-go) plan + a credit card** → surprise-bill risk. No native search. |
| **MongoDB Atlas M0** | 512 MB, shared, no card required, basic Atlas Search | Adds a *second* datastore with no cost upside; weak relational fit. |
| **Neon Free (Postgres)** | ~0.5 GB, **auto-suspend + auto-resume** (~ms) | Best fix if Supabase's 7-day pause is intolerable; bring your own auth. |
| **Hosting** | Vercel Hobby / Cloudflare Pages — $0 | Vercel Hobby is non-commercial; fine for an MVP. |

### Where your instinct is partly right (and partly a trap)
- ✅ **Right:** Firebase's **FCM push is genuinely free and unlimited** — keep using it. And Supabase's **7-day inactivity pause** is a real annoyance Firebase/Mongo don't have.
- ❌ **Trap:** Moving the *database* to Firestore/Mongo to "save money" saves nothing (Supabase free = $0 too) while forcing a rewrite of auth, the relational model, RLS, and search. And Firebase's scheduled reminders need **Blaze (a credit card)** — the opposite of what a no-budget project wants.
- ❌ **Trap:** Splitting data across Firestore **+** Mongo **+** Supabase multiplies complexity, not savings. Use **one** datastore.

### Recommended cheapest viable stack (~$0/month)
- **Database + Auth:** **Stay on Supabase Free.** $0, no migration, gives RLS + SQL + search + `pg_cron`. Migrate auth to `@supabase/ssr` + `getUser()` (fixes Audit-1 C5).
  - *Mitigate the 7-day pause* one of three ways: (a) just restore it when you return; (b) a free GitHub Actions cron that pings it weekly to keep it warm; (c) if pausing is a dealbreaker, swap to **Neon Free** (auto-resume) + Auth.js.
- **Push notifications:** **Firebase FCM (free, unlimited)** — the one Firebase piece worth keeping.
- **Scheduled refill reminders WITHOUT paying for Blaze:** run the eligibility scan on **Supabase `pg_cron` → Edge Function → call FCM's HTTP API** (or a free **GitHub Actions / Cloudflare Workers cron**). This gets you free push *without* Firebase Cloud Functions / Blaze.
- **Email (optional):** Resend free tier (~3K/mo) or Supabase's built-in auth emails. **Avoid SMS/Twilio** — it bills per message; rely on push + email.
- **Search:** Postgres `pg_trgm` + `tsvector` (free, in-DB). Skip Algolia/Typesense until funded.
- **Hosting:** Vercel Hobby or Cloudflare Pages — $0.
- **Data model:** normalized — `products`, `prescriptions`, `medical_devices`, `device_consumables` (join), `supplies` (FK→products), `site_changes`, `insurance_rules`, `appointments`; RLS keyed by `user_id`.

### The compliance reality at this budget
**HIPAA/BAA is unaffordable here** (Supabase HIPAA add-on ≈ $599/mo; Google/Atlas BAAs need paid plans) — all far beyond $50. Therefore, while unfunded, treat this as a **personal/MVP project that must not store other people's real PHI.** Use your own data or synthetic data only. This reinforces Audit-1 C6: **remove the false "HIPAA Compliant / End-to-End Encryption" claims** — you legally cannot make them on free tiers.

**Net recommendation:** Keep Supabase Free as the single backend, use free FCM for push driven by free `pg_cron`/GitHub-Actions cron, avoid Firebase Blaze and Twilio, and defer HIPAA until the project is funded. Expected cost: **$0/month** (a domain name ~$12/yr is the only likely spend — well inside $50).

---

## 7. Audit 5 — UX / Visual Design

**Lead finding:** the interface is styled like an **ER triage console** (near-black `#050505`, pulsing red `animate-ping`, glowing shadows, "Triage Dashboard / Urgent Depletion / Critical Shortage" language) — but the user is often a newly diagnosed, frightened person. **A newly diagnosed T1D would not feel comfortable here**; it reads as "everything is an emergency, all the time."

**Dimension verdict:** Trust ⚠ (undercut by false claims + alarm + `alert()`); Readability ❌ (`text-[8/9/10px]` uppercase; low-contrast grays); Accessibility ❌ (fails WCAG AA; color-only status; unlabeled icons; no reduced-motion/focus rings); Color ⚠ (decorative not semantic; red overused); Hierarchy ⚠ (all-`font-black` flattens it); Mobile ❌ (fixed 256px sidebar, no drawer); Emotional ❌ (anxiety-forward; two clashing visual languages — React app vs `index.html`).

**Competitor research (Dexcom, Tandem, Libre, Nightscout, Tidepool) — common principles:** light/clean canvases dominate; one glanceable hero metric; strictly semantic, color-blind-safe color used sparingly; generous whitespace + sentence case; reassuring plain language; high contrast only where data matters. The current app inverts nearly all of them.

**Recommended "Calm Clinical" design system (light-first, dual mode):**
- **Palette:** bg `#F6F8FB`, surface `#FFFFFF`, border `#DCE3EC`; ink `#16202E`, muted `#51606F`; primary `#1E6FE0` / deep `#134FA3`, teal `#0E9384`; semantic (reserved, AA): success `#1F8F4E`, caution amber `#B26B00`, urgent red `#C8341F` (**true emergencies only** — routine low-stock = amber). Dark mode = slate `#0F172A`, not pure black.
- **Typography:** Geist/Inter; base **≥16px**; headings 600–700 (not 900); `font-black` reserved for the single hero number; sentence case; uppercase only ≥12px and rare; scale 28/22/18/16/14/12; tabular numerals.
- **Tone:** "Your Supplies" not "Triage Dashboard"; "Running low" / "Reorder soon" not "Urgent Depletion / Critical Shortage."
- **Navigation:** mobile **bottom tab bar** (Home / Rotate / Add / Calendar, ≥44px targets) replacing the desktop sidebar.
- **Accessibility:** ≥4.5:1 contrast; never color-alone (icon + word); `aria-label` on icon buttons; replace `alert()` with focus-trapped toasts; visible focus rings; respect `prefers-reduced-motion`; 44px targets; `htmlFor` labels; named SVG body-map buttons; unify the two visual languages.

---

## 8. Unified Prioritized Roadmap

This merges the technical fix-phases, the product MVP/V2/V3, the architecture plan, and the design rollout into one sequence.

### Phase 0 — Stop the Bleeding (days)
*Make it honest and make it run.*
- Fix or remove the two non-compiling pages (C1, C2); restore nav only after.
- Add the missing `await` in `/api/scan/match` (C3).
- Remove the 5% random-failure injector (C7).
- **Remove all false claims** — "HIPAA", "End-to-End Encryption", "Validated against openFDA" (C6, C4, T2).
- Delete dead weight: duplicate `/lib`, orphan `index.html`; fix root metadata.

### Phase 1 — Security & Trustworthy Counts (MVP foundation)
*Earn credibility cheaply. Themes T2, T3, T5.*
- **[DONE 2026-06-16 — Phase 0 carryover] Fixed the route shell + protected the restored pages.** Moved `/calendar` → `src/app/dashboard/calendar` and `/site-tracker` → `src/app/dashboard/site-tracker` and updated the nav `href`s, so they now inherit the dashboard layout (`AppNav` / `RiskAlertBanner` / `QuickActionHub`). Nesting under `/dashboard/*` also means the existing `middleware.ts` matcher (`/dashboard/:path*`) + `startsWith('/dashboard')` check **auto-protect them — no middleware edit was needed.** (Note: `/scan` shares the old top-level pattern and could get the same treatment for consistency — deferred.)
- Replace `getSession()` authz with `getUser()`; migrate to `@supabase/ssr`; verify/enable **RLS** on all PHI tables (C5, Audit 4).
- Stop persisting PHI to `localStorage`; add input size caps (DoS).
- **Fix the depletion model** — separate *stock-on-hand* vs *current-item-expiry* vs *expiration date*; recompute on every depletion action (T3).
- Add a **configurable safety buffer** (alert against reserve, not zero).
- Surface the dormant **expiration/lot** field with FEFO guidance.
- Add **proactive push alerts** via free `pg_cron`/GitHub-Actions cron → Edge Function → **free FCM** (cheapest high-impact win, T5). Email via Resend free tier; **avoid paid SMS/Twilio** while unfunded (see §6).
- Replace `alert()` with accessible inline toasts; begin the **Calm Clinical** palette/type/tone migration (T6).

### Phase 2 — Close the Loop & Make It Effortless (the moat)
*Stop warning, start doing. Themes T1, T4, T5.*
- **Insurance refill-window engine** — start with 2–3 common plan/DME rules; surface "refill-eligible" dates everywhere (T4).
- **One-tap reorder / supplier hand-off** — deep-links first, then real integration for **Omnipod + Dexcom** (T1).
- **Device-driven auto-depletion** (Tidepool/Nightscout/vendor APIs) → kills manual logging (T5).
- **Barcode/GTIN + manifest scan** replaces the OCR pipeline (T1).
- Rebuilt **eligibility-based calendar** + **1-tap site rotation** tied to pod changes.
- **Prescription manager** + renewal nudges; **emergency/travel mode** + medical-ID card; **caregiver share**.
- Server-side search via `pg_trgm`/`tsvector` (retire client-side Fuse.js).
- Ship the **mobile bottom-nav** and complete the Calm Clinical redesign (T6).

### Phase 3 — Platform & Outcomes (scale)
*Defensibility and real health impact.*
- Broaden device/insurer/DME coverage; **cost/copay/deductible** year-end stock-up.
- **Endo/appointment cadence** linking supplies ↔ prescriptions ↔ visits (wire the existing `Appointment` type).
- Predictive usage modeling (sick-day/seasonal/activity-adjusted burn rates).
- B2B: clinic/endo dashboards, manufacturer partnerships, and the **real HIPAA/BAA posture** the login currently only claims (this is the point at which the project must be *funded* — HIPAA tiers run hundreds/mo, far beyond the current $0 budget; until then, no third-party PHI — see §6).
- Add a real test runner, `error.tsx`/`loading.tsx`, env validation; unify `Product`/`InventoryItem`.

---

## 9. Master Feature Ranking

Scored 1–5 (5 = highest). "Effort" is inverted (5 = easy). "Daily" = everyday-burden removed; "Health" = impact on real outcomes (avoiding insulin gaps, scar tissue, dead-insulin lows).

| Feature | User Value | Effort (5=easy) | Daily-Life | Health | Phase |
|---|:--:|:--:|:--:|:--:|---|
| Insurance refill-window engine | 5 | 1 | 5 | 5 | P2 (moat) |
| One-tap reorder / supplier hand-off | 5 | 2 | 5 | 5 | P2 |
| Device-driven auto-depletion | 5 | 1 | 5 | 4 | P2 |
| Proactive push/SMS alerts | 5 | 4 | 5 | 4 | **P1 (cheap win)** |
| Trustworthy counts + safety buffer | 5 | 4 | 4 | 4 | **P1 (foundation)** |
| Expiration & lot tracking (FEFO) | 4 | 4 | 3 | 4 | **P1** |
| Refill calendar (eligibility-based) | 4 | 3 | 4 | 3 | P2 (rebuilt) |
| Site rotation tracker (1-tap) | 4 | 3 | 4 | 4 | P2 (keep) |
| Prescription manager + renewals | 4 | 3 | 3 | 4 | P2 |
| Emergency / travel mode + medical-ID | 4 | 4 | 2 | 4 | P2 |
| Caregiver / share access | 4 | 3 | 4 | 3 | P2 |
| Triage dashboard (retuned) | 3 | 4 | 3 | 2 | P0–P1 |
| Barcode/GTIN + manifest scan | 3 | 2 | 3 | 2 | P2 (replaces OCR) |
| Cost / savings / copay layer | 4 | 2 | 2 | 2 | P3 |
| Appointment / endo cadence | 3 | 4 | 2 | 3 | P3 |
| OCR "AI" pipeline (current) | 1 | 2 | 1 | 1 | **Remove** |

**Read of the table:** the four highest-value features are all hard (low effort-score) — that's precisely why they form a moat. The cheap, high-impact wins (push alerts, expiration field, medical-ID card) should ship first to buy credibility while the hard moat is built.

---

*End of master suggestion file. Each section traces to a standalone audit; the Unified Roadmap (§8) and Master Ranking (§9) are the recommended single source of truth for planning.*

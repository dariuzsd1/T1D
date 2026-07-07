# Backlog

Non-urgent, buildable work, each scoped enough to hand off with zero back-and-forth. Pick one, branch
off `main`, verify with `npx tsc --noEmit` + `npm test` + `npm run build`, push, leave for review — do
not merge without the user's say-so unless told otherwise.

For anything mid-flight or awaiting merge right now, check the `user-todo` memory file instead — this
file is stable planning, not a status log.

---

## Test coverage for untested pure-logic modules

Four exported functions have real branching logic and no tests, same pattern as the existing
`*.test.ts` suites:
- `src/lib/appointments.ts` → `appointmentTiming()` (upcoming/soon/past date-boundary logic) and
  `appointmentTypeLabel()` (fallback for an unrecognized type string).
- `src/lib/suppliers.ts` → `reorderTargetFor()` (brand/name → supplier deep-link matching; same shape
  of "match against fuzzy brand/name text" as `quickActions.test.ts` — mirror that test structure).
- `src/lib/devices.ts` → `deviceLabel()` (brand/model/nickname fallback chain).
- `src/lib/caregivers.ts` → `isValidEmail()` (a few valid/invalid cases).

**Out of scope:** the `rowToX`/`xToRow` mapping functions across these files — they're data-shape
converters with no branching, low value to test exhaustively.

**Acceptance:** one `*.test.ts` per module (or add to an existing one if it already exists), each
function covered for its real edge cases (boundary dates, unknown/missing brand, malformed email).

---

## Wire dark-mode tokens (spec already settled — see `CLAUDE.md` §5)

The dark palette is fully specified (`base #0F172A`, `surface #1B2638`, `text #E6ECF3`) but not wired
into Tailwind's dark-mode variant anywhere. This is UI-only, no data/logic risk.

**Acceptance:**
- Tailwind dark palette tokens added (mirroring the existing light `@theme` block in `globals.css`).
- Respects OS preference (`prefers-color-scheme`) — no manual toggle required for v1 unless the user
  asks for one separately.
- Spot-check the highest-traffic surfaces (dashboard home, ProductCard, RiskAlertBanner, AppNav) in
  both modes — contrast ratios still meet the §5 accessibility checklist in dark mode too.

**Out of scope:** a user-facing light/dark toggle in Settings (that's a separate, larger ask —
flag it as a follow-up if the user wants one, don't build it speculatively here).

---

## Wear-clock auto-depletion

Kills manual "Use One" logging for wearables by decrementing stock automatically from the catalog's
known wear rate + the last logged site/device change date, instead of waiting for a manual tap.

**Needs a scope decision before starting — do not build silently:** should this *replace* manual
logging (auto-decrement is the only source of truth) or *supplement* it (manual logging still works,
auto-depletion just fills the gap between taps)? The honesty rule in CLAUDE.md §6 ("never fabricate a
supply level") means an auto-decrement that's wrong is worse than no decrement — ask the user which
model they want before implementing.

**Acceptance (once scoped):**
- Pure helper in `src/lib/depletion.ts` or a new module, unit-tested, mirroring the existing
  `effectiveRunwayDays` honesty pattern (only decrements from real catalog wear-rate data, never a
  guess).
- Wired wherever site/device changes are logged (`site-tracker`, `devices` pages).
- Never decrements below 0, never contradicts a more-recent manual "Use One" tap.

---

## TanStack Query data layer

Standardize inventory/prescriptions/appointments/devices fetching on TanStack Query instead of the
current per-page `useEffect` + local `useState` pattern, for caching, refetch-on-focus, and one
canonical loading/error state shape.

**Needs a scope decision before starting:** this is a cross-cutting architecture change (new
dependency, touches every dashboard page). Confirm with the user before starting:
1. Is `@tanstack/react-query` an acceptable new dependency (the project has occasionally held a
   "zero new deps" line, lifted case-by-case — e.g. `firebase` was allowed)?
2. All pages at once, or one page first as a proof of concept (recommend: start with `/dashboard`
   home + supplies, the two highest-traffic pages, before converting the rest)?

**Acceptance (once scoped):** a `useInventory()` (and similar) hook per resource, `QueryClientProvider`
mounted once at the root, existing pages migrated without changing their visible behavior, tests still
green.

---

## Regenerate `types/database.ts`

Hand-maintained types can silently drift from what `supabase/setup.sql` actually creates.

**Blocked on the user:** requires the Supabase CLI (`supabase gen types typescript`) authenticated
against the live project — cannot be done headless from this environment. When the user is ready:
`supabase gen types typescript --project-id <ref> > src/types/database.ts`, then fix whatever it
breaks (expect optional-vs-required mismatches on columns added ad hoc over time).

---

## Accessibility sweep

A full pass wasn't done since the initial "Calm Clinical" redesign landed. Look for: missing
`aria-label` on icon-only buttons added in later features (medical-ID, visit-prep, costs, appointments
pages shipped after the original a11y pass), contrast regressions from newer semantic-color usage,
and any raw `alert()`/`confirm()` that crept back in (should always be the accessible
`Toast`/`ConfirmDialog` components).

**Acceptance:** grep-driven audit (`alert(`, `window.confirm(`, `<button` without an adjacent
`aria-label` or visible text, icon-only controls) across everything added since the original redesign;
fix what's found; no visual-only regressions (spot-check in a browser, not just tsc/build).

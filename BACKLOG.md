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

## Regenerate `types/database.ts`

Hand-maintained types can silently drift from what `supabase/setup.sql` actually creates.

**Blocked on the user:** requires the Supabase CLI (`supabase gen types typescript`) authenticated
against the live project — cannot be done headless from this environment. When the user is ready:
`supabase gen types typescript --project-id <ref> > src/types/database.ts`, then fix whatever it
breaks (expect optional-vs-required mismatches on columns added ad hoc over time).

---

## Possible next steps (not yet scoped)

Nothing is queued after the batch above. Candidates if more backlog work is wanted later:
- Expand TanStack Query from the Home/Supplies POC to the rest of the dashboard (needs a fresh
  scope decision — same two questions as before: full migration vs. more POC pages).
- A user-facing light/dark toggle in Settings (dark mode currently follows OS preference only).
- Wire `auto_depleted_through` visibility into the UI (e.g. a subtle "auto-updated" indicator on a
  ProductCard when the wear-clock — not a manual tap — was the source of the last decrement).

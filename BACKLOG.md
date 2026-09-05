# Backlog

Non-urgent, buildable engineering work, each scoped enough to hand off with zero back-and-forth. Pick
one, branch off `main`, verify with `npx tsc --noEmit` + `npm test` + `npm run build`, push, leave for
review — do not merge without the user's say-so unless told otherwise.

This file is stable planning for buildable code work only. For anything mid-flight, awaiting merge,
user-side action items, delegated work, or strategic decisions, the `user-todo` / `phase_progress`
auto-memory is the source of truth, not this file — check there instead of expecting a status log here.

---

## [Technical] Component render coverage

Route-handler tests cover the data-path routes: `/api/inventory` (GET + POST),
`/api/caregiver/[ownerId]/inventory` (GET + PATCH), `/api/scan/lookup` (GET), and
`/api/products/catalog` (GET) — all via the shared Supabase mock in
`src/lib/testUtils/supabaseServerMock.ts`.

The framework decision this item used to be blocked on is **made and built** (2026-08-23): jsdom +
@testing-library/react, wired up in `vitest.config.ts` and `vitest.setup.ts`, with the provider
wrapper in `src/lib/testUtils/renderWithProviders.tsx`. Two components are covered —
`ProductCard.test.tsx` (the on-hand vs day-count honesty rule) and `UpdateBanner.test.tsx`. So this is
no longer a tooling question, just remaining scope.

Two things to know before adding more, both learned the hard way:

- jsdom is **opt-in per file** via `// @vitest-environment jsdom`, so the pure engine and route tests
  stay fast. Without the pragma a component test renders into nothing.
- the wrapper calls `afterEach(cleanup)` **explicitly**, because Testing Library only auto-cleans when
  vitest runs with `globals: true` and this project does not set it. Without that, one test's DOM
  survives into the next and assertions quietly pass or fail against a stale render.

- **Remaining scope, highest value first:** the scan page's duplicate-restock panel and discontinued
  notice (the flagship flow, still entirely uncovered); `EditProductModal` (its scroll/close bug was
  user-reported and is currently guarded by nothing); the refill list's channel grouping; then a
  `/dashboard` smoke render against a mocked backend.
- **Acceptance:** CI fails on a broken route, a broken caregiver-access rule, or a broken render of any
  covered component. The first two are already true. Prove each new test by reintroducing the bug it
  guards and watching it fail — that is how the ProductCard and SQL-lint tests were validated.

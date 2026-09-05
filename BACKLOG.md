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

The scan page's duplicate-restock panel is now covered (`DuplicatePanel.test.tsx`, 12 tests). Extracting
it from the 1,238-line page first was the right move and is the pattern to repeat: mounting the whole
page exercises camera, router and network plumbing instead of the decision under test. The extracted
component derives its own flags from the unit-tested rules rather than taking booleans as props, so a
test cannot pass while the panel and the underlying merge disagree.

`EditProductModal` is now covered too (14 tests), including four that pin the LAYOUT — a capped height,
fields inside a scroll region, close and Save/Cancel outside it. Worth copying that idea: when the bug
was structural, assert the structure, not just the copy.

The scan flow is now covered: `DuplicatePanel`, `QuantityField` and `DiscontinuedNotice` all have tests,
and extracting each one shrank `src/app/scan/page.tsx` from 1,238 to ~1,100 lines along the way.

The refill list's grouping and its exported text are covered too (`src/lib/refillList.test.ts`), using
the real English dictionary rather than a stub translator — a stub that echoes keys lets a
wrong-but-plausible message pass.

- **Remaining scope:** a `/dashboard` smoke render against a mocked backend, which is the last
  significant uncovered surface. After that the gap is genuine end-to-end (Playwright), which is a
  separate tooling decision and not obviously worth it for a single-user app.
- **Acceptance:** CI fails on a broken route, a broken caregiver-access rule, or a broken render of any
  covered component. The first two are already true. Prove each new test by reintroducing the bug it
  guards and watching it fail — that is how the ProductCard and SQL-lint tests were validated.

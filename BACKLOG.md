# Backlog

Non-urgent, buildable engineering work, each scoped enough to hand off with zero back-and-forth. Pick
one, branch off `main`, verify with `npx tsc --noEmit` + `npm test` + `npm run build`, push, leave for
review — do not merge without the user's say-so unless told otherwise.

This file is stable planning for buildable code work only. For anything mid-flight, awaiting merge,
user-side action items, delegated work, or strategic decisions, the `user-todo` / `phase_progress`
auto-memory is the source of truth, not this file — check there instead of expecting a status log here.

---

## [Technical] Route/component test coverage

Route-handler tests now cover the data-path routes: `/api/inventory` (GET + POST),
`/api/caregiver/[ownerId]/inventory` (GET + PATCH), `/api/scan/lookup` (GET), and
`/api/products/catalog` (GET) — all via the shared Supabase mock in
`src/lib/testUtils/supabaseServerMock.ts`. The remaining gap is actual page/component *render*
coverage: no test mounts a page, so a broken render is still only caught by `tsc` + `next build`.

- **Remaining scope (the real open item):** a component/E2E smoke layer. This needs new tooling
  (jsdom + @testing-library/react for component render, or Playwright + a CI browser install for
  true E2E) — a framework decision, not a small addition, which is why it's still deferred. When
  picked up, start with the highest-value render: `/dashboard` against a seeded/mocked backend.
- **Acceptance:** CI fails on a broken route (wrong shape, missing auth check) or a broken
  caregiver-access rule — already true today; extend it to catch a broken page render.

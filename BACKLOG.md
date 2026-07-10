# Backlog

Non-urgent, buildable engineering work, each scoped enough to hand off with zero back-and-forth. Pick
one, branch off `main`, verify with `npx tsc --noEmit` + `npm test` + `npm run build`, push, leave for
review — do not merge without the user's say-so unless told otherwise.

This file is stable planning for buildable code work only. For anything mid-flight, awaiting merge,
user-side action items, delegated work, or strategic decisions, the `user-todo` / `phase_progress`
auto-memory is the source of truth, not this file — check there instead of expecting a status log here.

---

## [Technical] Route/component test coverage

All existing tests (`src/lib/**/*.test.ts`) are pure-logic unit tests. Nothing exercises an API route
handler or an actual page/component render, so a regression in the data path or a broken page wouldn't
be caught by CI — only `tsc` + `next build` would (and a build passing doesn't mean the page renders
correctly or the route returns the right shape at runtime).

- **Scope:** route-handler tests for `/api/inventory` (GET + POST) and the caregiver read/write route
  `/api/caregiver/[ownerId]/inventory` (GET + PATCH) — mock the Supabase client, assert the
  runway-shaped response and the auth/validation branches (401 unauthenticated, 403 no accepted share,
  400 bad PATCH body).
- **Optional, larger, separate decision:** a Playwright (or similar) smoke test that loads `/dashboard`
  against a seeded/mocked backend. This is a new test framework + CI runner + browser install, not a
  small addition — scope it as its own item if wanted, don't bundle it into the route-handler tests.
- **Acceptance:** CI fails on a broken inventory route (wrong shape, missing auth check) or a broken
  caregiver-access rule; existing tests stay green.

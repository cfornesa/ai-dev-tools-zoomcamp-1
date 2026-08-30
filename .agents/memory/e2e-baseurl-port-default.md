---
name: e2e-baseurl-port-default
description: RESOLVED — local Playwright default baseURL now matches the Vite dev server's pinned :5000 port; historical note on why the mismatch existed.
metadata:
  type: project
---

`frontend/playwright.config.ts` and `frontend/e2e/support/global-setup.ts`
used to fall back to `http://localhost:5173` when `E2E_BASE_URL` was unset,
even though the Vite dev server has been permanently pinned to port `5000`
(`strictPort: true`) since the OAuth-redirect port stabilization work. Fixed
2026-08-23 (backlog task 92 / [[../../docs/tasks.md]] / GitHub issue #123):
both fallback literals now read `http://localhost:5000`. Verified against a
real local PostgreSQL-backed Django + Vite stack: bare `npx playwright test`
with no `E2E_BASE_URL` override no longer hits `ERR_CONNECTION_REFUSED` or
self-skips.

**Why this note is kept:** the failure mode (issue #103's CI fix set
`E2E_BASE_URL` only in CI's `env:` block and didn't update the shared
default, so CI stayed green while local `make e2e` quietly broke) is a
pattern worth remembering — a per-environment override can mask a stale
shared default indefinitely.

**How to apply:** no workaround needed anymore; the documented bare
`make e2e` / `npx playwright test` command works locally. If a future change
touches either fallback literal or the Vite dev port, re-verify both stay in
sync. See also [[critical-actions.md]].

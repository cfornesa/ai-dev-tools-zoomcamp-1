---
name: E2E wrong Docker project
description: A healthy Docker stack on the expected port may still be an unrelated Compose project and must be validated through the app health/API probes before browser QA.
metadata:
  type: project
---

The local Docker daemon can have a different Compose project serving the expected
frontend port while its backend paths return the frontend shell. During the 2026-08-26
backlog session, port 5173 served an unrelated `ai-dev-tools-zoomcamp` SPA: `/health/`
and `/api/whoami/` returned HTML rather than this repository's Django responses.

How to apply: before treating browser failures as product evidence, verify the exact
application origin with `GET /health/` and anonymous `GET /api/whoami/`, and confirm
the frontend port matches this repository's documented startup path (`make dev` uses
Vite on port 5000). A healthy container list alone is insufficient.

## A more specific variant: this repo's own dev server, wrong backend (2026-08-28)

A subtler version of the same class: `frontend/vite.config.ts`'s `backendProxyTarget`
defaults to `http://localhost:8000` when `BROWSER_QA_BACKEND_URL` is unset. An unrelated
sibling project's dockerized backend (`ai-dev-tools-zoomcamp`, no `-1`) publishes its own
backend on that exact port. Several stray, long-running `vite --port 500X` processes for
*this* repo (left over from earlier sessions, never stopped) were therefore all silently
proxying `/api`/`/accounts`/`/health` to the sibling project's `uvicorn`-based backend —
this repo's own frontend code, correctly running, talking to the wrong backend by pure
port coincidence. `GET /health/` still returned 200 (the sibling app has its own health
route), so a lazy health check alone did not catch it; only the *body* differed
(`{"status":"ok","database":"ok"}` from this repo vs. the sibling's own shape/404s on
this repo's specific routes) and the response's `server: uvicorn` header was the
give-away (Django's dev server never sends that).

**Why:** `curl /health/` returning any 200 is not sufficient proof of talking to this
repo's own backend when a same-numbered port collision with unrelated infrastructure is
possible — check the actual response body/headers for a repo-specific fingerprint, and
check for and kill stray dev-server processes for this repo before assuming a fresh
`npm run dev`/`manage.py runserver` pair is clean.

**How to apply:** before running e2e, run `ps aux | grep vite` and `lsof -i :8000` (or
whatever `backendProxyTarget` currently defaults to) to rule out both stray same-repo
dev servers and a same-port collision with unrelated Docker infrastructure. If port 8000
is occupied by something else, start Django on a free port (e.g. 8001) and launch Vite
with `BROWSER_QA_BACKEND_URL=http://localhost:<that port>` rather than assuming the
default proxy target is safe. Confirm with the *body* of `GET /api/whoami/` (this repo's
exact `{"detail": "Authentication required."}` 401 shape), not just a 200/404 status
code.

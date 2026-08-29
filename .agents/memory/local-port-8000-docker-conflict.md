---
name: local-port-8000-docker-conflict
description: On this machine, Docker's backend proxy squats localhost:8000, breaking manual Django dev-server verification on that port.
metadata:
  type: project
---

Running `manage.py runserver 8000` on this development machine can appear
to succeed (no bind error, "Watching for file changes" logs normally) but
requests to it are actually answered by an unrelated `com.docker.backend`
process already listening on `:8000` (visible via `lsof -i :8000`) —
responses carry `server: uvicorn` and 307-redirect `/health/` to `/health`,
not Django's own dev-server signature. This produced misleading 404s
across every endpoint (`/health/`, `/api/whoami/`, `/admin/`) during a
2026-08-24 production-readiness verification pass, even though the app
itself was correct — confirmed by rerunning Django on a free port (8010)
and getting the expected `{"status": "ok", "database": "ok"}`.

**Why:** `frontend/vite.config.ts`'s dev-server proxy target is
intentionally hardcoded to `http://localhost:8000` (not configurable via
env) because Google OAuth's registered redirect URI depends on the
frontend's own fixed port 5000 talking to Django on a fixed port too — see
`AGENTS.md`'s "Frontend dev server port" section. So a real end-to-end
browser check through the Vite proxy needs Django on exactly `:8000`, not
an arbitrary free port.

**How to apply:** Before trusting a "Django is broken" signal while
verifying locally on this machine, run `lsof -i :8000` first. If
`com.docker.backend` (or another unrelated process) already holds it, that
is the actual cause, not application code — do not chase it as a
code-level bug. Free the port properly (stop the offending Docker
container/proxy) before relying on the Vite-proxied dev flow for
verification, or fall back to a direct Django-only check on a free port
(bypassing the Vite proxy, so `/accounts/*` login flows can't be exercised
that way, but `/health/`, `/api/whoami/`, and plain Django views can).

**Lower-friction workaround (2026-08-25, task 137/#169):** `manage.py
runserver`'s default IPv4-only `127.0.0.1:8000` and Docker's proxy
(bound on the IPv6 wildcard, `*:8000`/`irdmi`) can coexist on the same
port simultaneously — a client's "localhost" resolution just has to pick
IPv6 first to reach Docker's proxy instead of Django. Confirmed with
`curl http://localhost:8000/health/` (JSON `{"detail":"Not Found"}`,
`server: uvicorn`) vs. `curl http://127.0.0.1:8000/health/` (the real
`{"status": "ok", "database": "ok"}`, `server: WSGIServer/...`) against
the exact same running `manage.py runserver`, no process changes between
the two calls. This means a full Vite-proxied browser verification is
possible **without stopping Docker**: temporarily point
`frontend/vite.config.ts`'s three proxy targets at `http://127.0.0.1:8000`
instead of `http://localhost:8000`, restart the Vite dev server, do the
live verification (including `/accounts/*` login), then revert the
`vite.config.ts` edit before finishing — it is a sandbox/host-specific
workaround, not a real fix, and must not ship. The Browser tool's own
network path is independently subject to the same `localhost` ambiguity,
so this applies whether verifying via plain `curl` or through the Browser
tool's preview pane.

**Cleanest workaround, no file edit (2026-08-29, production-readiness
pass):** `vite.config.ts` now reads its backend proxy target from
`BROWSER_QA_BACKEND_URL` (defaulting to `http://localhost:8000` when
unset) — the "not configurable via env" claim above is stale as of
whenever that env var was added for `scripts/browser-qa.sh`'s own use.
Start Vite with `BROWSER_QA_BACKEND_URL=http://127.0.0.1:8000 npm run
dev` instead of editing `vite.config.ts` and remembering to revert it —
zero risk of an accidental workaround edit surviving into a commit. Hit
this again while running `make e2e`: the first full run failed on
essentially every server-dependent test (30s timeouts / 404s from
`{"detail":"Not Found"}`, `server: uvicorn`), which looked exactly like
a mass regression but was this same port conflict — confirmed via
`curl http://localhost:5000/api/whoami/` (404, wrong backend) vs.
`curl http://127.0.0.1:8000/api/whoami/` (401, correct backend) with
Django and Vite both already running. Restarting only Vite with the env
var above (no Django restart needed) fixed it: full suite went from
"everything server-dependent times out" to 133 passed/1 skipped/0
failed. **Always suspect this conflict first** when a from-scratch local
`make e2e`/browser-verification run fails broadly and uniformly (many
different specs, same timeout/404 shape) rather than in one specific
scenario — that pattern is much more consistent with "wrong backend
entirely" than with a real product regression.

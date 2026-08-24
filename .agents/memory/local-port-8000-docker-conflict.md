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

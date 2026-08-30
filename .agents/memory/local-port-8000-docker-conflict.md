---
name: local-port-8000-docker-conflict
description: RESOLVED — vite.config.ts's proxy target now defaults to 127.0.0.1:8000; historical note on the localhost/Docker IPv6 collision this fixes.
metadata:
  type: project
---

**RESOLVED (2026-08-30, issue filed via task-distillation during a /goal
session):** `frontend/vite.config.ts`'s `backendProxyTarget` now defaults
to `http://127.0.0.1:8000`, not `http://localhost:8000`. The repository
owner explicitly chose this over the env-var-workaround approach below
after this exact collision silently broke every API call the running app
made (`/api/whoami/`, project/version saves, AI generation) with zero
error surfaced anywhere — reported as "no thumbnails, no shapes in the
editor," which looked like a product bug but was entirely this
environment collision. `BROWSER_QA_BACKEND_URL` still overrides the
target for any environment that genuinely needs something other than
127.0.0.1. See [[vite-proxy-localhost-ipv6-port-collision]] if that
topic exists, or the git history of `frontend/vite.config.ts` for the
fix commit.

**If this resurfaces despite the fix:** something other than this
repo's own `vite.config.ts` default is providing `localhost:8000` again
(a stale build, an env var override left set in the shell, etc.) — re-run
`git blame`/`git log -p frontend/vite.config.ts` on the
`backendProxyTarget` line before assuming the underlying IPv6 collision
mechanism (below) has changed.

---

## Historical context (why this happened, kept for future diagnosis)

Running `manage.py runserver` on a machine that also has Docker Desktop
containers from an *entirely unrelated* project bound to port 8000 (their
container's port-forward listens on the IPv6 wildcard, `*:8000`) creates
a silent collision: Django's dev server binds IPv4-only
(`127.0.0.1:8000`), so both processes can listen on port 8000
simultaneously with no bind error. Whichever one `localhost` resolves to
first wins per-request — on this machine (and most macOS setups),
`localhost` resolves to `::1` (IPv6) before `127.0.0.1`, so requests
silently reach the *other* project's backend instead of Django. Responses
carry `server: uvicorn`/`{"detail":"Not Found"}` (or whatever the other
project's server signature is) instead of Django's
`server: WSGIServer/...`/real JSON — easy to mistake for an application
bug (misleading 404s across `/health/`, `/api/whoami/`, `/admin/`, and,
worse, through the Vite dev-server proxy, silently breaking the entire
running app with zero visible error).

**Diagnosis:** `curl http://127.0.0.1:8000/health/` (forces IPv4, reaches
the real Django) vs. `curl http://localhost:8000/health/` (may resolve
IPv6 first, reaching the wrong service) — a mismatch between the two
confirms this collision, and `lsof -i :8000` shows what else is bound.
**Always suspect this first** when a from-scratch local `make
e2e`/browser-verification run (or manual testing) fails broadly and
uniformly (many different endpoints/specs, same 404/timeout shape, no
application-level error) rather than in one specific scenario.

**Prior workaround history (superseded by the fix above, kept for
context on why three separate sessions treated this as "not a real
fix"):** for a long stretch this collision was worked around per-session
via `BROWSER_QA_BACKEND_URL=http://127.0.0.1:8000 npm run dev` rather
than changing `vite.config.ts`'s own default, on the reasoning that the
Docker collision was a personal/local-machine quirk not worth a
permanent code change. That reasoning was revisited and explicitly
overridden once the same collision was shown to silently break the
*entire app* for an ordinary user (not just verification tooling) with
no error at all — see the RESOLVED note above.

---
name: replit-production-frontend-serving
description: The published Replit deployment ran Vite's dev server (live HMR) in production; verify against the live URL, not just .replit/scripts source, before trusting a "which server is running" claim.
metadata:
  type: project
---

Confirmed by direct live investigation (2026-08-23, issue #133): the
published deployment at `https://animate.creatrweb.com` was serving raw
`/src/*.ts` files, `@fs/home/runner/workspace/...` paths, and
`node_modules/.vite/deps/*.js` — unambiguous signs of Vite's dev server
(`npm run dev`), not a built bundle — and its browser console logged `[vite]
connecting...`/`[vite] connected.` (a live HMR WebSocket). `.replit`'s
`[deployment].run` and `scripts/start.sh` both called `npm --prefix frontend
run dev` unconditionally, with no distinction between the interactive
Replit workspace (which legitimately wants HMR) and the actual autoscale
deployment (which should never run a dev server).

**Why this matters:** Vite's HMR client issues a full `location.reload()`
whenever its WebSocket disconnects/reconnects (an autoscale restart, a
redeploy, a transient network hiccup) or receives a full-reload HMR event —
a strong, previously-unconfirmed candidate for user reports of the editor
"reloading at random" in production. `manage.py check --deploy` and
`scripts/smoke-published.sh` passing does not catch this class of bug: they
check Django's own deploy-safety settings and basic route reachability, not
which frontend process is actually serving requests.

**How to apply:** Fixed via `scripts/start.sh`'s new `FRONTEND_SERVE_MODE`
env var (`dev` default; `preview` runs `vite preview` against
`frontend/dist/` instead) and a new `scripts/start-production.sh` wrapper
that `.replit`'s `[deployment].run` now points at, setting
`FRONTEND_SERVE_MODE=preview` before delegating to the shared launcher — see
[[replit-production-schema-publishing]] for the sibling lesson about what
else differs between the interactive workspace and a real deployment.
`vite preview`'s `preview.*` options (`proxy`, `host`, `strictPort`,
`allowedHosts`, etc.) default to their `server.*` counterparts except
`preview.port` (independent default `4173`, irrelevant here since the port
is always passed explicitly) — confirmed via Vite's own docs and a local
`vite preview` run showing `/health/` correctly proxied to Django on 8000
with a 502 (Django not running) rather than falling through to
`index.html`, so no `vite.config.ts` changes were needed for proxying to
keep working. When investigating a "which process/config is actually live"
question, a source-only read of `.replit`/scripts is not sufficient — the
live deployment's own network requests and console output are the ground
truth (Replit's `[deployment]` build/run commands are separate from what
the interactive workspace's `[workflows]` runs, and can silently drift
apart, as they had here for the run command since day one). Also: an
existing test (`test_replit_uses_repository_launcher_for_startup` in
`tests/test_startup_configuration.py`) forbids `bash -c` appearing anywhere
in `.replit`, from a prior fragile-startup fix — use a dedicated wrapper
script instead of an inline `bash -c` env-var prefix when `.replit` needs to
pass a deployment-only setting to a shared launcher script.

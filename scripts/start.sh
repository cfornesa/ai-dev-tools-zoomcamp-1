#!/usr/bin/env bash
#
# Start both services for Replit Preview and Publish.
#
# The web server is the externally visible process.  Django remains on 8000
# because Vite proxies the API, auth, and health paths to that port.
#
# Issue #133: FRONTEND_SERVE_MODE selects how the frontend process is
# started -- "dev" (default, used by the interactive Replit workflow) runs
# Vite's own dev server with live HMR; "preview" (set only by
# `.replit`'s `[deployment].run`) runs `vite preview` against the
# already-built `frontend/dist/` from `[deployment].build`'s `npm run
# build` step instead. Every connected browser holds a live HMR WebSocket
# to the dev server, and Vite's HMR client issues a full
# `location.reload()` when that socket disconnects/reconnects (an
# autoscale restart, a redeploy, a transient network hiccup) -- a strong
# match for the "editor reloads at random" symptom this issue reported,
# since the published deployment had no reason to ever run the dev
# server in the first place. `vite preview` has no HMR client at all, so
# it cannot trigger this class of reload; it also inherits
# `vite.config.ts`'s `server.proxy`/`allowedHosts`/`strictPort` settings
# by Vite's own documented default (each `preview.*` option falls back to
# its `server.*` counterpart except `preview.port`, which this script
# always passes explicitly anyway), so `/api`/`/accounts`/`/health`
# proxying to Django on 8000 is unchanged in either mode.
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_dir="$repo_root/backend"

frontend_serve_mode="${FRONTEND_SERVE_MODE:-dev}"
if [[ "$frontend_serve_mode" != "dev" && "$frontend_serve_mode" != "preview" ]]; then
  printf 'Invalid FRONTEND_SERVE_MODE: %s (must be "dev" or "preview")\n' \
    "$frontend_serve_mode" >&2
  exit 2
fi

frontend_port="${PORT:-5000}"
if [[ ! "$frontend_port" =~ ^[0-9]+$ ]] || (( frontend_port < 1 || frontend_port > 65535 )); then
  printf 'Invalid PORT: %s\n' "$frontend_port" >&2
  exit 2
fi

backend_serve_mode="${BACKEND_SERVE_MODE:-dev}"
if [[ "$backend_serve_mode" != "dev" && "$backend_serve_mode" != "asgi" ]]; then
  printf 'Invalid BACKEND_SERVE_MODE: %s (must be "dev" or "asgi")\n' \
    "$backend_serve_mode" >&2
  exit 2
fi

startup_timeout_seconds="${STARTUP_TIMEOUT_SECONDS:-60}"
if [[ ! "$startup_timeout_seconds" =~ ^[0-9]+$ ]] || (( startup_timeout_seconds < 1 )); then
  printf 'Invalid STARTUP_TIMEOUT_SECONDS: %s\n' "$startup_timeout_seconds" >&2
  exit 2
fi

django_pid=''
frontend_pid=''

cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$frontend_pid" ]] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill "$frontend_pid" 2>/dev/null || true
  fi
  if [[ -n "$django_pid" ]] && kill -0 "$django_pid" 2>/dev/null; then
    kill "$django_pid" 2>/dev/null || true
  fi
  # Deliberately no unconditional `wait` here. This trap can also fire
  # mid-loop on an incoming INT/TERM signal (e.g. an autoscale instance
  # being stopped) -- the main flow below has its own explicit
  # `wait "$django_pid"`/`wait "$frontend_pid"` calls to collect exit
  # status, and a bare `wait` here would race those: reaping a pid here
  # first makes the main flow's own explicit `wait` on the same pid fail
  # with "not a child of this shell" (bash returns 127 for that), which
  # was observed in production as a spurious "Startup process exited with
  # status 127" on ordinary autoscale stop/restart, not a real crash. The
  # process is exiting either way; the kernel reaps any remaining zombie
  # children once this shell exits, without needing an explicit wait here.
}
trap cleanup EXIT INT TERM

if [[ "${RUN_MIGRATIONS_ON_START:-false}" == "true" ]]; then
  printf 'Applying database migrations before starting Django\n'
  if ! (cd "$backend_dir" && uv run python manage.py migrate --noinput); then
    printf 'Database migrations failed; refusing to start the application\n' >&2
    exit 1
  fi
fi

if [[ "$backend_serve_mode" == "asgi" ]]; then
  (cd "$backend_dir" && exec uv run --with 'uvicorn==0.46.0' uvicorn backend.main:app \
    --host 0.0.0.0 --port 8000) &
else
  (cd "$backend_dir" && exec uv run python manage.py runserver 0.0.0.0:8000) &
fi
django_pid=$!

# Do not start Vite until Django can serve the same health endpoint that the
# published smoke check uses. Suppress curl's connection errors while Django
# is still binding its port; those are expected during normal startup.
startup_deadline=$((SECONDS + startup_timeout_seconds))
while true; do
  if ! kill -0 "$django_pid" 2>/dev/null; then
    if wait "$django_pid"; then
      django_status=$?
    else
      django_status=$?
    fi
    printf 'Django exited before becoming healthy (status %d)\n' \
      "$django_status" >&2
    exit 1
  fi
  if curl --silent --show-error --fail --max-time 2 \
    http://127.0.0.1:8000/health/ >/dev/null 2>&1; then
    printf 'Django health check passed; starting Vite (%s mode)\n' "$frontend_serve_mode"
    break
  fi
  if (( SECONDS >= startup_deadline )); then
    printf 'Django did not become healthy within %s seconds\n' \
      "$startup_timeout_seconds" >&2
    exit 1
  fi
  sleep 1
done

if [[ "$frontend_serve_mode" == "preview" ]]; then
  npm --prefix frontend run preview -- --host 0.0.0.0 --port "$frontend_port" &
else
  npm --prefix frontend run dev -- --host 0.0.0.0 --port "$frontend_port" &
fi
frontend_pid=$!

# Fail fast if either service exits, while EXIT cleanup stops its companion.
# The bash 4.3+ "wait" flag that blocks on the first of several pids isn't
# available on macOS's stock /bin/bash (3.2), so poll child liveness instead,
# matching the health-check loop above.
set +e
while true; do
  if ! kill -0 "$django_pid" 2>/dev/null; then
    wait "$django_pid"
    status=$?
    break
  fi
  if ! kill -0 "$frontend_pid" 2>/dev/null; then
    wait "$frontend_pid"
    status=$?
    break
  fi
  sleep 1
done
set -e

if (( status != 0 )); then
  printf 'Startup process exited with status %d\n' "$status" >&2
else
  printf 'Startup process exited unexpectedly\n' >&2
  status=1
fi
exit "$status"

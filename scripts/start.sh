#!/usr/bin/env bash
#
# Start both services for Replit Preview and Publish.
#
# The web server is the externally visible process.  Django remains on 8000
# because Vite proxies the API, auth, and health paths to that port.
set -Eeuo pipefail

frontend_port="${PORT:-5000}"
if [[ ! "$frontend_port" =~ ^[0-9]+$ ]] || (( frontend_port < 1 || frontend_port > 65535 )); then
  printf 'Invalid PORT: %s\n' "$frontend_port" >&2
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
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [[ "${RUN_MIGRATIONS_ON_START:-false}" == "true" ]]; then
  printf 'Applying database migrations before starting Django\n'
  if ! uv run python manage.py migrate --noinput; then
    printf 'Database migrations failed; refusing to start the application\n' >&2
    exit 1
  fi
fi

uv run python manage.py runserver 0.0.0.0:8000 &
django_pid=$!

# Do not start Vite until Django can serve the same health endpoint that the
# published smoke check uses. Suppress curl's connection errors while Django
# is still binding its port; those are expected during normal startup.
startup_deadline=$((SECONDS + startup_timeout_seconds))
while true; do
  django_state="$(ps -o stat= -p "$django_pid" 2>/dev/null || true)"
  if [[ -z "$django_state" || "$django_state" == Z* ]]; then
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
    printf 'Django health check passed; starting Vite\n'
    break
  fi
  if (( SECONDS >= startup_deadline )); then
    printf 'Django did not become healthy within %s seconds\n' \
      "$startup_timeout_seconds" >&2
    exit 1
  fi
  sleep 1
done

npm --prefix frontend run dev -- --host 0.0.0.0 --port "$frontend_port" &
frontend_pid=$!

# Fail fast if either service exits, while EXIT cleanup stops its companion.
# The bash 4.3+ "wait" flag that blocks on the first of several pids isn't
# available on macOS's stock /bin/bash (3.2), so poll each pid's process
# state instead, matching the health-check loop above.
set +e
while true; do
  django_state="$(ps -o stat= -p "$django_pid" 2>/dev/null || true)"
  if [[ -z "$django_state" || "$django_state" == Z* ]]; then
    wait "$django_pid"
    status=$?
    break
  fi
  frontend_state="$(ps -o stat= -p "$frontend_pid" 2>/dev/null || true)"
  if [[ -z "$frontend_state" || "$frontend_state" == Z* ]]; then
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
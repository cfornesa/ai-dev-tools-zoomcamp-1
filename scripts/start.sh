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

uv run python manage.py runserver 0.0.0.0:8000 &
django_pid=$!

npm --prefix frontend run dev -- --host 0.0.0.0 --port "$frontend_port" &
frontend_pid=$!

# Fail fast if either service exits, while EXIT cleanup stops its companion.
set +e
wait -n "$django_pid" "$frontend_pid"
status=$?
set -e

if (( status != 0 )); then
  printf 'Startup process exited with status %d\n' "$status" >&2
else
  printf 'Startup process exited unexpectedly\n' >&2
  status=1
fi
exit "$status"
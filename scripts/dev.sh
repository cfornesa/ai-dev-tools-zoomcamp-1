#!/usr/bin/env bash
# Task 89 (issue #91): start Postgres (if needed), the Django backend, and
# the Vite frontend together from one terminal, and make sure Ctrl+C
# actually stops all of them -- no leftover processes holding the ports
# for the next run. See README.md's "Run locally" section.
set -m
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MANAGED_CONTAINER="scenes-postgres-dev"
DEFAULT_DATABASE_URL="postgres://postgres:postgres@localhost:5432/postgres"
BACKEND_PORT=8000
FRONTEND_PORT=5000

BACKEND_PID=""
FRONTEND_PID=""

log() { echo "[dev] $*"; }

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    log "Port $port is already in use (PID(s): $pids) -- stopping it before starting."
    kill -9 $pids 2>/dev/null || true
    sleep 1
  fi
}

db_reachable() {
  DEV_DB_URL="$1" uv run python -c "
import os, socket, sys
from urllib.parse import urlparse
u = urlparse(os.environ['DEV_DB_URL'])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(1)
try:
    s.connect((u.hostname or 'localhost', u.port or 5432))
    sys.exit(0)
except OSError:
    sys.exit(1)
finally:
    s.close()
" 2>/dev/null
}

prefix() {
  local label="$1"
  while IFS= read -r line; do
    echo "[$label] $line"
  done
}

cleanup() {
  trap - EXIT INT TERM
  echo ""
  log "Stopping dev servers..."
  for pid in "$BACKEND_PID" "$FRONTEND_PID"; do
    [[ -n "$pid" ]] && kill -TERM -"$pid" 2>/dev/null
  done
  sleep 2
  for pid in "$BACKEND_PID" "$FRONTEND_PID"; do
    if [[ -n "$pid" ]] && kill -0 -"$pid" 2>/dev/null; then
      log "Force-stopping stubborn process group $pid..."
      kill -9 -"$pid" 2>/dev/null
    fi
  done
  # Belt and suspenders: guarantee the ports are actually free afterward.
  for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
    leftover="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    [[ -n "$leftover" ]] && kill -9 $leftover 2>/dev/null || true
  done
  wait 2>/dev/null
  log "Stopped. Ports $BACKEND_PORT and $FRONTEND_PORT are free."
}
trap cleanup EXIT INT TERM

# --- frontend/.env: create once, never overwrite an existing one ---
if [[ ! -f frontend/.env ]]; then
  log "No frontend/.env found -- creating one from frontend/.env.example."
  cp frontend/.env.example frontend/.env
fi

# --- .env: create once, never overwrite an existing one ---
if [[ ! -f .env ]]; then
  log "No .env found -- creating one from .env.example."
  cp .env.example .env
  SECRET_KEY="$(uv run python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")"
  DEV_SECRET_KEY="$SECRET_KEY" uv run python -c "
import os, pathlib
p = pathlib.Path('.env')
text = p.read_text()
text = text.replace(
    'DJANGO_SECRET_KEY=changeme-generate-a-real-secret-key',
    'DJANGO_SECRET_KEY=' + os.environ['DEV_SECRET_KEY'],
)
text = text.replace(
    'DATABASE_URL=postgres://gesture_studio:changeme@localhost:5432/gesture_studio',
    'DATABASE_URL=$DEFAULT_DATABASE_URL',
)
p.write_text(text)
"
  log "Generated a real DJANGO_SECRET_KEY and set DATABASE_URL to the managed local Postgres container."
fi

# --- Postgres: reuse whatever is already reachable, else manage our own ---
DB_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"
if db_reachable "$DB_URL"; then
  log "Postgres already reachable at the DATABASE_URL in .env -- using it as-is."
elif [[ "$DB_URL" == "$DEFAULT_DATABASE_URL" ]]; then
  log "Starting managed local Postgres container ($MANAGED_CONTAINER) on port 5432..."
  docker start "$MANAGED_CONTAINER" >/dev/null 2>&1 \
    || docker run --name "$MANAGED_CONTAINER" -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres >/dev/null
  log "Waiting for Postgres to accept connections..."
  until db_reachable "$DB_URL"; do sleep 1; done
else
  log "ERROR: DATABASE_URL in .env is not reachable, and it isn't the managed"
  log "default, so this script won't start a container for it. Either start"
  log "your own PostgreSQL server, or clear DATABASE_URL back to the default"
  log "to use the built-in managed container: $DEFAULT_DATABASE_URL"
  exit 1
fi

# --- Frontend dependencies: npm has no auto-install-on-run, unlike uv ---
if [[ ! -d frontend/node_modules ]]; then
  log "frontend/node_modules missing -- running npm install..."
  (cd frontend && npm install)
fi

# --- Migrate (retry: a freshly created Postgres container restarts itself
# once during first-time init, so the first connection attempt or two
# failing right after container startup is normal, not an error) ---
log "Applying migrations..."
until uv run --env-file .env python manage.py migrate; do sleep 1; done

# --- Make sure nothing leftover from a previous run is squatting on our
# ports (e.g. an interrupted prior run that didn't clean up) ---
free_port "$BACKEND_PORT"
free_port "$FRONTEND_PORT"

log "Starting backend on http://localhost:$BACKEND_PORT ..."
(uv run --env-file .env python manage.py runserver "$BACKEND_PORT" 2>&1 | prefix backend) &
BACKEND_PID=$!

log "Starting frontend on http://localhost:$FRONTEND_PORT ..."
(cd frontend && npm run dev 2>&1 | prefix frontend) &
FRONTEND_PID=$!

log "Both servers running. Press Ctrl+C to stop everything."
wait

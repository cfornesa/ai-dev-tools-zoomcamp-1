#!/usr/bin/env bash
# Run browser acceptance checks against an isolated, disposable local stack.
# This command owns PostgreSQL, Django/Vite, the fixture environment, and cleanup.
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
cd "$REPO_ROOT"

FRONTEND_PORT="${BROWSER_QA_FRONTEND_PORT:-}"
BACKEND_PORT="${BROWSER_QA_BACKEND_PORT:-}"
POSTGRES_IMAGE="${BROWSER_QA_POSTGRES_IMAGE:-postgres:16}"
RUN_FULL_E2E="${BROWSER_QA_FULL_E2E:-0}"
RUN_RUNTIME_BENCH="${BROWSER_QA_RUNTIME_BENCH:-0}"
E2E_SPEC="${BROWSER_QA_E2E_SPEC:-}"
PLAYWRIGHT_PROJECT="${BROWSER_QA_PLAYWRIGHT_PROJECT:-}"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/creatrweb-browser-qa.XXXXXX")"
ENV_FILE="$WORK_DIR/.env"
POSTGRES_CONTAINER="creatrweb-browser-qa-$$"
BACKEND_LOG="$WORK_DIR/django.log"
FRONTEND_LOG="$WORK_DIR/vite.log"
DB_PORT=""
BACKEND_PID=""
FRONTEND_PID=""

log() { printf '[browser-qa] %s\n' "$*"; }
fail() { printf '[browser-qa] ERROR: %s\n' "$*" >&2; exit 1; }

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  [[ -n "$FRONTEND_PID" ]] && wait "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID" ]] && wait "$BACKEND_PID" 2>/dev/null || true
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -Fxq "$POSTGRES_CONTAINER"; then
    docker rm -f "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
  fi
  if (( status != 0 )) || [[ "${BROWSER_QA_KEEP_LOGS:-0}" == "1" ]]; then
    log "Logs retained in $WORK_DIR (exit status $status)"
    for log_file in "$BACKEND_LOG" "$FRONTEND_LOG"; do
      if [[ -f "$log_file" ]]; then
        log "Last 40 lines of $(basename "$log_file")"
        tail -40 "$log_file" >&2 || true
      fi
    done
  else
    rm -rf "$WORK_DIR"
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

command -v docker >/dev/null || fail "docker is required"
docker info >/dev/null 2>&1 || fail "Docker daemon is unavailable; start Docker and retry"
command -v curl >/dev/null || fail "curl is required"
command -v uv >/dev/null || fail "uv is required"
command -v npm >/dev/null || fail "npm is required"
command -v lsof >/dev/null || fail "lsof is required"
[[ -x frontend/node_modules/.bin/playwright ]] || fail "run 'npm --prefix frontend ci' first"
[[ "$RUN_FULL_E2E" == 0 || "$RUN_FULL_E2E" == 1 ]] || fail "BROWSER_QA_FULL_E2E must be 0 or 1"
[[ "$RUN_RUNTIME_BENCH" == 0 || "$RUN_RUNTIME_BENCH" == 1 ]] || fail "BROWSER_QA_RUNTIME_BENCH must be 0 or 1"
if [[ -n "$E2E_SPEC" && "$E2E_SPEC" == -* ]]; then
  fail "BROWSER_QA_E2E_SPEC must be a Playwright spec path, not an option"
fi
if [[ -n "$PLAYWRIGHT_PROJECT" && "$PLAYWRIGHT_PROJECT" != chromium && "$PLAYWRIGHT_PROJECT" != firefox && "$PLAYWRIGHT_PROJECT" != webkit ]]; then
  fail "BROWSER_QA_PLAYWRIGHT_PROJECT must be chromium, firefox, or webkit"
fi

if [[ -z "$FRONTEND_PORT" ]]; then
  for candidate in {5000..5099}; do
    if ! lsof -nP -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; then
      FRONTEND_PORT="$candidate"
      break
    fi
  done
fi
[[ -n "$FRONTEND_PORT" ]] || fail "could not find a free frontend port in 5000-5099"
if lsof -nP -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  fail "requested frontend port $FRONTEND_PORT is already in use"
fi
if [[ -z "$BACKEND_PORT" ]]; then
  for candidate in {8000..8099}; do
    if ! lsof -nP -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; then
      BACKEND_PORT="$candidate"
      break
    fi
  done
fi
[[ -n "$BACKEND_PORT" ]] || fail "could not find a free backend port in 8000-8099"
if lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  fail "backend port $BACKEND_PORT is already in use"
fi

log "Starting disposable PostgreSQL container $POSTGRES_CONTAINER"
docker run --rm -d --name "$POSTGRES_CONTAINER" \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=creatrweb_browser_qa -p 127.0.0.1::5432 "$POSTGRES_IMAGE" >/dev/null
DB_PORT="$(docker port "$POSTGRES_CONTAINER" 5432/tcp | sed -n 's/.*:\([0-9][0-9]*\)$/\1/p' | head -1)"
[[ -n "$DB_PORT" ]] || fail "could not determine disposable PostgreSQL port"

log "Waiting for PostgreSQL on 127.0.0.1:$DB_PORT"
for _ in {1..60}; do
  if docker exec "$POSTGRES_CONTAINER" pg_isready -U postgres -d creatrweb_browser_qa >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$POSTGRES_CONTAINER" pg_isready -U postgres -d creatrweb_browser_qa >/dev/null 2>&1 \
  || fail "disposable PostgreSQL did not become ready"

cat > "$ENV_FILE" <<EOF
DJANGO_SECRET_KEY=browser-qa-only-secret-key
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:$DB_PORT/creatrweb_browser_qa
GOOGLE_OAUTH_CLIENT_ID=browser-qa.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=browser-qa-only-oauth-secret
MISTRAL_CREDENTIAL_ENCRYPTION_KEY=hDmcNCp7WCvpOjI3tmEd0-foRjnnjh_-OgVogBK30V4=
AI_PROVIDER=fake
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://localhost:$FRONTEND_PORT,http://127.0.0.1:$FRONTEND_PORT
EOF

log "Applying migrations"
(cd "$BACKEND_DIR" && uv run --env-file "$ENV_FILE" python manage.py migrate --noinput)
log "Starting Django and Vite"
(cd "$BACKEND_DIR" && uv run --env-file "$ENV_FILE" python manage.py runserver 0.0.0.0:"$BACKEND_PORT") >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
(cd frontend && BROWSER_QA_BACKEND_URL="http://127.0.0.1:$BACKEND_PORT" \
  npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT") >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

for _ in {1..60}; do
  if curl -fsS --max-time 2 "http://127.0.0.1:$BACKEND_PORT/health/" >/dev/null \
    && curl -fsS --max-time 2 "http://127.0.0.1:$FRONTEND_PORT/health/" >/dev/null; then break; fi
  sleep 1
done
health_body="$(curl -fsS --max-time 3 "http://127.0.0.1:$FRONTEND_PORT/health/")" \
  || fail "health probe failed; see $BACKEND_LOG and $FRONTEND_LOG"
grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' <<<"$health_body" \
  || fail "health response was not this repository's healthy Django response: $health_body"
whoami_status="$(curl -sS --max-time 3 -o "$WORK_DIR/whoami.json" -w '%{http_code}' \
  "http://127.0.0.1:$FRONTEND_PORT/api/whoami/")"
[[ "$whoami_status" == 401 ]] || fail "repository identity probe expected /api/whoami/=401, got $whoami_status"

export E2E_BASE_URL="http://127.0.0.1:$FRONTEND_PORT"
export E2E_ENV_FILE="$ENV_FILE"
export UV_CACHE_DIR="${UV_CACHE_DIR:-$WORK_DIR/uv-cache}"
log "Running Layers browser acceptance suite against $E2E_BASE_URL"
if [[ -n "$E2E_SPEC" ]]; then
  log "Running selected browser acceptance spec: $E2E_SPEC"
  if [[ -n "$PLAYWRIGHT_PROJECT" ]]; then
    (cd frontend && npx playwright test "$E2E_SPEC" --project="$PLAYWRIGHT_PROJECT")
  else
    (cd frontend && npx playwright test "$E2E_SPEC")
  fi
else
  if [[ -n "$PLAYWRIGHT_PROJECT" ]]; then
    (cd frontend && npx playwright test e2e/layersPanel.spec.ts --project="$PLAYWRIGHT_PROJECT")
  else
    (cd frontend && npx playwright test e2e/layersPanel.spec.ts)
  fi
fi
if [[ "$RUN_FULL_E2E" == 1 ]]; then
  log "Running full browser acceptance suite"
  (cd frontend && npm run test:e2e)
fi
if [[ "$RUN_RUNTIME_BENCH" == 1 ]]; then
  log "Running runtime benchmark"
  (cd frontend && npm run bench:runtime)
fi
log "Browser QA passed; isolated services will now be removed"

#!/usr/bin/env bash
#
# Local/external non-production smoke check. It creates deterministic fixture
# users in the configured database, logs in one user, and always cleans them
# up. The optional disposable-staging mode is only for the isolated staging
# deployment workflow; never point either mode at production or shared data.
set -Eeuo pipefail

base_url="${BASE_URL:-http://localhost:5000}"
timeout_seconds="${SMOKE_TIMEOUT_SECONDS:-15}"
staging_smoke="${STAGING_SMOKE:-0}"
cookie_jar="$(mktemp)"
fixture_json="$(mktemp)"

if [[ "$staging_smoke" == "1" ]]; then
  if [[ "$base_url" != https://* ]]; then
    printf 'BASE_URL must be an https:// disposable staging URL\n' >&2
    exit 2
  fi
  staging_host="${STAGING_HOST:-}"
  actual_host="${base_url#https://}"
  actual_host="${actual_host%%/*}"
  if [[ -z "$staging_host" || "$actual_host" != "$staging_host" ]]; then
    printf 'BASE_URL must exactly match the deployment-status staging host\n' >&2
    exit 2
  fi
  # A staging URL must not be an obvious production/shared alias. The exact
  # deployment host check above is the primary isolation boundary.
  if [[ "$actual_host" =~ (^|[.-])(prod|production|shared|published)([.-]|$) ]]; then
    printf 'BASE_URL points at a production or shared deployment\n' >&2
    exit 2
  fi
elif [[ "$base_url" != http://* ]]; then
  printf 'BASE_URL must be an http:// local/non-production URL\n' >&2
  exit 2
elif [[ -n "${STAGING_HOST:-}" ]]; then
  printf 'STAGING_HOST is only valid with STAGING_SMOKE=1\n' >&2
  exit 2
fi
if [[ ! "$timeout_seconds" =~ ^[0-9]+$ ]] || (( timeout_seconds < 1 )); then
  printf 'Invalid SMOKE_TIMEOUT_SECONDS: %s\n' "$timeout_seconds" >&2
  exit 2
fi

# Install cleanup only after all target-safety checks have passed. In
# particular, rejecting a production/shared URL must never run a management
# command against that database.
trap 'rm -f "$cookie_jar" "$fixture_json"; uv run --env-file .env python manage.py e2e_fixtures cleanup --json >/dev/null 2>&1 || true' EXIT

get() {
  local path="$1" expected="$2"
  local status
  status="$(curl --silent --show-error --location --max-time "$timeout_seconds" \
    --cookie-jar "$cookie_jar" --cookie "$cookie_jar" \
    --output /tmp/smoke-body --write-out '%{http_code}' "$base_url$path")"
  [[ "$status" == "$expected" ]] || {
    printf 'FAIL: GET %s returned HTTP %s; expected %s\n' "$path" "$status" "$expected" >&2
    return 1
  }
  printf 'PASS: GET %s returned HTTP %s\n' "$path" "$status"
}

get /health/ 200
get /api/whoami/ 401
get /accounts/login/ 200

if [[ "$staging_smoke" == "1" ]]; then
  E2E_FIXTURE_ENVIRONMENT=disposable-staging uv run --env-file .env python manage.py e2e_fixtures create --json >"$fixture_json"
else
  uv run --env-file .env python manage.py e2e_fixtures create --json >"$fixture_json"
fi
email="$(uv run python -c 'import json,sys; print(json.load(open(sys.argv[1]))["owner"]["email"])' "$fixture_json")"
password="$(uv run python -c 'import json,sys; print(json.load(open(sys.argv[1]))["password"])' "$fixture_json")"
csrf="$(sed -n 's/.*name="csrfmiddlewaretoken" value="\([^"]*\)".*/\1/p' /tmp/smoke-body | head -1)"
[[ -n "$csrf" ]] || { echo "FAIL: login form did not provide a CSRF token" >&2; exit 1; }
status="$(curl --silent --show-error --location --max-time "$timeout_seconds" \
  --cookie "$cookie_jar" --cookie-jar "$cookie_jar" \
  --data-urlencode "csrfmiddlewaretoken=$csrf" \
  --data-urlencode "login=$email" --data-urlencode "password=$password" \
  --output /tmp/smoke-body --write-out '%{http_code}' "$base_url/accounts/login/")"
[[ "$status" == 2* || "$status" == 3* ]] || {
  printf 'FAIL: fixture login returned HTTP %s\n' "$status" >&2
  exit 1
}
get /api/whoami/ 200
printf 'Local authenticated smoke check passed: %s\n' "$base_url"
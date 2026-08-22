#!/usr/bin/env bash
#
# Local/external non-production smoke check. It creates deterministic fixture
# users in the configured database, logs in one user, and always cleans them
# up. Never point this at Replit production or a published URL.
set -Eeuo pipefail

base_url="${BASE_URL:-http://localhost:5000}"
timeout_seconds="${SMOKE_TIMEOUT_SECONDS:-15}"
cookie_jar="$(mktemp)"
fixture_json="$(mktemp)"
trap 'rm -f "$cookie_jar" "$fixture_json"; uv run --env-file .env python manage.py e2e_fixtures cleanup --json >/dev/null 2>&1 || true' EXIT

if [[ "$base_url" != http://* ]]; then
  printf 'BASE_URL must be an http:// local/non-production URL\n' >&2
  exit 2
fi
if [[ ! "$timeout_seconds" =~ ^[0-9]+$ ]] || (( timeout_seconds < 1 )); then
  printf 'Invalid SMOKE_TIMEOUT_SECONDS: %s\n' "$timeout_seconds" >&2
  exit 2
fi

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

uv run --env-file .env python manage.py e2e_fixtures create --json >"$fixture_json"
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
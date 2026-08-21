#!/usr/bin/env bash
#
# Verify routing on a published instance. This intentionally uses no cookies,
# credentials, or private headers: the anonymous whoami response is expected.
set -Eeuo pipefail

published_url="${PUBLISHED_APP_URL:-${1:-}}"
timeout_seconds="${SMOKE_TIMEOUT_SECONDS:-15}"

if [[ -z "$published_url" ]]; then
  printf 'Usage: PUBLISHED_APP_URL=https://published.example.com %s\n' "$0" >&2
  exit 2
fi

if [[ "$published_url" != http://* && "$published_url" != https://* ]]; then
  printf 'PUBLISHED_APP_URL must start with http:// or https://\n' >&2
  exit 2
fi

published_url="${published_url%/}"

if [[ ! "$timeout_seconds" =~ ^[0-9]+$ ]] || (( timeout_seconds < 1 )); then
  printf 'Invalid SMOKE_TIMEOUT_SECONDS: %s\n' "$timeout_seconds" >&2
  exit 2
fi

probe() {
  local path="$1"
  local expected="$2"
  local body_pattern="${3:-}"
  local body
  local status

  body="$(mktemp)"
  trap 'rm -f "$body"' RETURN

  if ! status="$(
    curl \
      --silent \
      --show-error \
      --location \
      --max-time "$timeout_seconds" \
      --output "$body" \
      --write-out '%{http_code}' \
      "${published_url}${path}"
  )"; then
    printf 'FAIL: Django proxy unavailable (GET %s could not be reached)\n' "$path" >&2
    return 1
  fi

  if [[ "$status" != "$expected" ]]; then
    printf 'FAIL: Django proxy unavailable (GET %s returned HTTP %s; expected %s)\n' \
      "$path" "$status" "$expected" >&2
    return 1
  fi
  if [[ -n "$body_pattern" ]] && ! grep -Eiq "$body_pattern" "$body"; then
    printf 'FAIL: Django proxy unavailable (GET %s returned an unexpected response body)\n' \
      "$path" >&2
    return 1
  fi

  printf 'PASS: GET %s returned HTTP %s\n' "$path" "$status"
}

probe_health() {
  local body
  local status
  body="$(mktemp)"
  trap 'rm -f "$body"' RETURN

  if ! status="$(
    curl \
      --silent \
      --show-error \
      --location \
      --max-time "$timeout_seconds" \
      --output "$body" \
      --write-out '%{http_code}' \
      "${published_url}/health/"
  )"; then
    printf 'FAIL: Django proxy unavailable (GET /health/ could not be reached)\n' >&2
    return 1
  fi
  if [[ "$status" != "200" ]] || ! grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "$body"; then
    printf 'FAIL: Django proxy unavailable (GET /health/ returned HTTP %s or a non-ok health payload)\n' \
      "$status" >&2
    return 1
  fi
  printf 'PASS: GET /health/ returned HTTP 200 with status=ok\n'
}

# Deployment status can arrive just before the externally visible process is
# ready. Wait for the backend health response through Vite before probing any
# browser-facing or auth routes, so transient startup failures do not make the
# acceptance result ambiguous.
health_deadline=$((SECONDS + timeout_seconds))
while true; do
  if probe_health; then
    break
  fi
  if (( SECONDS >= health_deadline )); then
    printf 'FAIL: published services did not become healthy within %s seconds\n' \
      "$timeout_seconds" >&2
    exit 1
  fi
  sleep 1
done

root_body="$(mktemp)"
trap 'rm -f "$root_body"' EXIT
if ! root_status="$(
  curl \
    --silent \
    --show-error \
    --location \
    --max-time "$timeout_seconds" \
    --output "$root_body" \
    --write-out '%{http_code}' \
    "$published_url/"
)"; then
  printf 'FAIL: published web process unavailable (GET / could not be reached)\n' >&2
  exit 1
fi

if [[ "$root_status" != 2* ]]; then
  printf 'FAIL: published web process unavailable (GET / returned HTTP %s)\n' "$root_status" >&2
  exit 1
fi
printf 'PASS: GET / returned HTTP %s\n' "$root_status"

probe "/api/whoami/" "401"
probe "/accounts/login/" "200" '<form|csrfmiddlewaretoken'
printf 'Published routing smoke check passed: %s\n' "$published_url"
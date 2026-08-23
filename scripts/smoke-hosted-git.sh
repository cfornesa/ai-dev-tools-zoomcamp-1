#!/usr/bin/env bash
#
# Verify the guarded push against a disposable hosted GitHub repository.
# This is intentionally opt-in: normal CI must never create repositories.
set -Eeuo pipefail

if [[ "${HOSTED_GIT_SMOKE:-}" != "1" ]]; then
  printf 'SKIP: hosted Git smoke check is not enabled\n'
  exit 0
fi

if [[ -z "${GIT_URL:-}" ]]; then
  printf 'SKIP: hosted Git smoke check has no GIT_URL credential\n'
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  printf 'SKIP: hosted Git smoke check requires the GitHub CLI\n'
  exit 0
fi

repository_owner="${HOSTED_GIT_OWNER:-${GITHUB_REPOSITORY_OWNER:-}}"
if [[ -z "$repository_owner" ]]; then
  printf 'SKIP: hosted Git smoke check has no repository owner\n'
  exit 0
fi

repository_name="safe-push-smoke-${GITHUB_RUN_ID:-local}-$$"
repository="${repository_owner}/${repository_name}"
workdir="$(mktemp -d "${TMPDIR:-/tmp}/git-safe-hosted.XXXXXX")"
remote_url=''
credential_url=''
credential_helper=''

cleanup() {
  if [[ -n "$repository" ]]; then
    gh repo delete "$repository" --yes >/dev/null 2>&1 || true
  fi
  [[ -z "$credential_helper" ]] || rm -f "$credential_helper"
  rm -rf "$workdir"
}
trap cleanup EXIT

# Extract credentials only into an environment variable consumed by gh and
# the safe-push helper. Neither the URL nor the token is printed or persisted.
credential_url="$(python3 - <<'PY'
import os
from urllib.parse import urlsplit, urlunsplit

url = os.environ["GIT_URL"]
parts = urlsplit(url)
if parts.scheme not in {"http", "https"} or not parts.username or not parts.password:
    raise SystemExit(2)
print(urlunsplit((parts.scheme, parts.netloc, "", "", "")))
PY
)" || {
  printf 'SKIP: GIT_URL must be an authenticated HTTPS URL\n'
  exit 0
}
export GH_TOKEN
GH_TOKEN="$(python3 - <<'PY'
import os
from urllib.parse import unquote, urlsplit

parts = urlsplit(os.environ["GIT_URL"])
print(unquote(parts.password or ""))
PY
)"

if ! gh repo create "$repository" --private >/dev/null 2>&1; then
  printf 'FAIL: could not create disposable hosted Git repository\n' >&2
  exit 1
fi

git_host="$(python3 - <<'PY'
import os
from urllib.parse import urlsplit

print(urlsplit(os.environ["GIT_URL"]).netloc.split("@")[-1])
PY
)"
remote_url="https://${git_host}/${repository}.git"
credential_helper="$(mktemp "${TMPDIR:-/tmp}/git-safe-hosted-credential.XXXXXX")"
cat >"$credential_helper" <<'HELPER'
#!/usr/bin/env python3
import os
import sys
from urllib.parse import unquote, urlsplit

if len(sys.argv) >= 2 and sys.argv[1] == "get":
    parts = urlsplit(os.environ.get("GIT_URL", ""))
    if parts.username and parts.password:
        print(f"username={unquote(parts.username)}")
        print(f"password={unquote(parts.password)}")
HELPER
chmod 700 "$credential_helper"
mkdir "$workdir/local"
git -C "$workdir/local" init -b main >/dev/null
git -C "$workdir/local" config user.email "safe-push-smoke@example.invalid"
git -C "$workdir/local" config user.name "Safe push smoke"
printf 'initial\n' >"$workdir/local/state"
git -C "$workdir/local" add state
git -C "$workdir/local" commit -m initial >/dev/null
git -C "$workdir/local" remote add origin "$remote_url"

GIT_URL="${credential_url}${remote_url#https://}" \
  bash scripts/git-safe-push.sh >/dev/null

printf 'local change\n' >"$workdir/local/state"
git -C "$workdir/local" commit -am "local change" >/dev/null

GIT_URL="$credential_url" git -c "credential.helper=!$credential_helper" \
  clone --quiet --branch main "$remote_url" "$workdir/competitor"
git -C "$workdir/competitor" config user.email "safe-push-race@example.invalid"
git -C "$workdir/competitor" config user.name "Safe push race"
printf 'competing remote change\n' >"$workdir/competitor/state"
git -C "$workdir/competitor" commit -am "competing remote change" >/dev/null
competing_tip="$(git -C "$workdir/competitor" rev-parse HEAD)"
GIT_URL="$credential_url" git -C "$workdir/competitor" \
  -c "credential.helper=!$credential_helper" push origin main >/dev/null

if GIT_URL="${credential_url}${remote_url#https://}" \
  bash scripts/git-safe-push.sh >/dev/null 2>&1; then
  printf 'FAIL: safe push accepted a competing remote commit\n' >&2
  exit 1
fi

remote_tip="$(GIT_URL="$credential_url" git -c "credential.helper=!$credential_helper" \
  ls-remote "$remote_url" refs/heads/main | awk '{print $1}')"
if [[ "$remote_tip" != "$competing_tip" ]]; then
  printf 'FAIL: competing remote commit was overwritten\n' >&2
  exit 1
fi
printf 'OK: hosted safe-push race was rejected without overwriting the remote\n'
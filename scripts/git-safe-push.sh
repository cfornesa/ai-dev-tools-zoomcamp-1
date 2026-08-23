#!/usr/bin/env bash
#
# Push local main without confusing authentication failures with stale refs.
# The helper is deliberately repository-local: it never changes a Git config
# file, and its temporary file contains no credential.
set -Eeuo pipefail

remote="${GIT_PUSH_REMOTE:-origin}"
branch="${GIT_PUSH_BRANCH:-main}"

usage() {
  printf 'Usage: GIT_URL=... %s [remote] [branch]\n' "$0" >&2
}

if (($# > 2)); then
  usage
  exit 2
fi
remote="${1:-$remote}"
branch="${2:-$branch}"

if [[ "$branch" != "main" ]]; then
  printf 'FAIL: safe push only permits the main branch (requested %s)\n' "$branch" >&2
  exit 2
fi
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  printf 'FAIL: current directory is not a Git repository with a commit\n' >&2
  exit 2
fi

helper=''
cleanup() {
  [[ -z "$helper" ]] || rm -f "$helper"
}
trap cleanup EXIT

make_credential_helper() {
  # GIT_URL remains in the process environment. The helper source itself is
  # safe to persist briefly, and is removed before this script exits.
  helper="$(mktemp "${TMPDIR:-/tmp}/git-safe-credential.XXXXXX")"
  cat >"$helper" <<'HELPER'
#!/usr/bin/env python3
import os
import sys
from urllib.parse import unquote, urlsplit

if len(sys.argv) < 2 or sys.argv[1] != "get":
    raise SystemExit(0)
parts = urlsplit(os.environ.get("GIT_URL", ""))
if parts.username is None or parts.password is None:
    raise SystemExit(0)
print(f"username={unquote(parts.username)}")
print(f"password={unquote(parts.password)}")
HELPER
  chmod 700 "$helper"
}

sanitize() {
  local message="$1"
  if [[ -n "${GIT_URL:-}" ]]; then
    message="${message//"$GIT_URL"/'[credential redacted]'}"
  fi
  # Avoid leaking credentials if a Git implementation echoes a URL variant.
  message="$(printf '%s' "$message" | sed -E \
    -e 's#(https?://)[^/@[:space:]]+@#\1[credential redacted]@#g' \
    -e 's#(password|token|secret)[=:][^[:space:]]+#\1=[credential redacted]#gi')"
  printf '%s' "$message"
}

git_output() {
  local output_file="$1"
  shift
  if ! git "$@" >"$output_file" 2>&1; then
    return 1
  fi
}

is_auth_failure() {
  local output
  output="$(cat "$1")"
  [[ "$output" =~ [Aa]uthentication ]] ||
    [[ "$output" =~ [Aa]uthori[sz]ation ]] ||
    [[ "$output" =~ [Pp]ermission[[:space:]]denied ]] ||
    [[ "$output" =~ [Ii]nvalid[[:space:]](username|token|credentials?) ]] ||
    [[ "$output" =~ [Aa]ccess[[:space:]]denied ]] ||
    [[ "$output" =~ [Cc]ould[[:space:]]not[[:space:]]read[[:space:]][Uu]sername ]] ||
    [[ "$output" =~ (HTTP|http)[[:space:]](401|403) ]] ||
    [[ "$output" =~ [Rr]ejected.*(access|permission) ]]
}

make_credential_helper
export GIT_TERMINAL_PROMPT=0
fetch_output="$(mktemp "${TMPDIR:-/tmp}/git-safe-fetch.XXXXXX")"
push_output="$(mktemp "${TMPDIR:-/tmp}/git-safe-push.XXXXXX")"
trap 'rm -f "$fetch_output" "$push_output"; cleanup' EXIT

git_args=(-c "credential.helper=!$helper")
if ! git_output "$fetch_output" "${git_args[@]}" fetch --prune "$remote" \
  "refs/heads/$branch:refs/remotes/$remote/$branch"; then
  if is_auth_failure "$fetch_output"; then
    printf 'FAIL: Git authentication/authorization failed while refreshing %s/%s. ' \
      "$remote" "$branch" >&2
    printf 'Check the active GIT_URL credential and repository write permission.\n' >&2
  else
    printf 'FAIL: could not refresh %s/%s: %s\n' "$remote" "$branch" \
      "$(sanitize "$(cat "$fetch_output")")" >&2
  fi
  exit 1
fi

local_ref="$(git rev-parse HEAD)"
remote_ref="$(git rev-parse "refs/remotes/$remote/$branch")"
if [[ "$local_ref" == "$remote_ref" ]]; then
  printf 'OK: %s/%s is already up to date (%s)\n' "$remote" "$branch" "$local_ref"
  exit 0
fi

if git merge-base --is-ancestor "$remote_ref" "$local_ref"; then
  if ! git_output "$push_output" "${git_args[@]}" push "$remote" \
    "HEAD:refs/heads/$branch"; then
    if is_auth_failure "$push_output"; then
      printf 'FAIL: Git authentication/authorization failed while pushing %s/%s. ' \
        "$remote" "$branch" >&2
      printf 'Check the active GIT_URL credential and repository write permission.\n' >&2
    else
      printf 'FAIL: safe fast-forward push failed for %s/%s: %s\n' "$remote" "$branch" \
        "$(sanitize "$(cat "$push_output")")" >&2
    fi
    exit 1
  fi
  printf 'OK: fast-forwarded %s/%s to %s\n' "$remote" "$branch" "$local_ref"
  exit 0
fi

if git merge-base --is-ancestor "$local_ref" "$remote_ref"; then
  printf 'FAIL: %s/%s is ahead of this checkout; pull/rebase the remote commits before pushing.\n' \
    "$remote" "$branch" >&2
  exit 1
fi

printf 'FAIL: %s/%s has diverged from this checkout; reconcile both histories safely, ' \
  "$remote" "$branch" >&2
printf 'then push normally. No force-push or overwrite was attempted.\n' >&2
exit 1
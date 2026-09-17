#!/usr/bin/env bash
set -euo pipefail

# This check runs only against the Replit Development database from the
# post-merge workflow. Production must continue to use the Publish schema-diff
# path and must never be migrated by this script.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_dir="$repo_root/backend"

if ! migration_plan="$(cd "$backend_dir" && uv run python manage.py showmigrations --plan 2>&1)"; then
  printf '%s\n' "$migration_plan"
  printf '%s\n' 'Development migration verification failed: showmigrations could not complete.' >&2
  exit 1
fi

printf '%s\n' "$migration_plan"

unapplied="$(printf '%s\n' "$migration_plan" | awk '/^\[ \]/ { print }')"
if [[ -n "$unapplied" ]]; then
  printf '%s\n' 'Development migration verification failed: unapplied migrations remain:' >&2
  printf '%s\n' "$unapplied" >&2
  exit 1
fi

printf '%s\n' 'Development migration verification passed: all migrations are applied.'

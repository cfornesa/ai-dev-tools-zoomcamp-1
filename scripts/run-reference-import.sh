#!/usr/bin/env bash
#
# Run the owner-scoped reference import from the published runtime only when
# the production startup wrapper explicitly enables it. Preview is the safe
# default for an enabled invocation; writes require REFERENCE_IMPORT_MODE=write.
set -Eeuo pipefail

reference_import_mode="${REFERENCE_IMPORT_MODE:-preview}"
case "$reference_import_mode" in
  preview|write) ;;
  *)
    printf 'Invalid REFERENCE_IMPORT_MODE: %s (must be "preview" or "write")\n' \
      "$reference_import_mode" >&2
    exit 2
    ;;
esac

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
reference_import_args=(
  import_reference_pieces import
  --handle "${REFERENCE_IMPORT_HANDLE:-cfornesa}"
  --allow-production --json
)
if [[ "$reference_import_mode" == "preview" ]]; then
  reference_import_args+=(--dry-run)
fi
if [[ -n "${REFERENCE_IMPORT_USERNAME:-}" ]]; then
  reference_import_args+=(--username "${REFERENCE_IMPORT_USERNAME}")
fi
if [[ -n "${REFERENCE_IMPORT_EMAIL:-}" ]]; then
  reference_import_args+=(--email "${REFERENCE_IMPORT_EMAIL}")
fi

cd "$repo_root/backend"
exec uv run python manage.py "${reference_import_args[@]}"

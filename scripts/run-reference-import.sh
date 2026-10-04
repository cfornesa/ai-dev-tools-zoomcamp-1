#!/usr/bin/env bash
#
# Run the owner-scoped reference import from the published runtime only when
# the production startup wrapper explicitly enables it. Preview is the safe
# default for an enabled invocation; writes require REFERENCE_IMPORT_MODE=write
# and an explicit comma-separated REFERENCE_IMPORT_SOURCE_IDS allowlist.
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
if [[ -z "${REFERENCE_IMPORT_SOURCE_IDS:-}" ]]; then
  printf 'REFERENCE_IMPORT_SOURCE_IDS is required for a production reference import.\n' >&2
  exit 2
fi
reference_import_args=(
  import_reference_pieces import
  --handle "${REFERENCE_IMPORT_HANDLE:-cfornesa}"
  --allow-production --json
)
IFS=',' read -r -a reference_import_source_ids <<< "$REFERENCE_IMPORT_SOURCE_IDS"
for source_id in "${reference_import_source_ids[@]}"; do
  if [[ -z "$source_id" ]]; then
    printf 'REFERENCE_IMPORT_SOURCE_IDS cannot contain an empty source ID.\n' >&2
    exit 2
  fi
  reference_import_args+=(--source-id "$source_id")
done
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

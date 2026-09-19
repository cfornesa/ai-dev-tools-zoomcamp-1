#!/usr/bin/env bash
#
# Issue #133: the deployment-only entry point for `.replit`'s
# `[deployment].run`. A thin wrapper (not an inline `bash -c` in `.replit`
# itself -- see tests/test_startup_configuration.py's
# test_replit_uses_repository_launcher_for_startup, which guards against
# reintroducing that fragile pattern) that sets FRONTEND_SERVE_MODE=preview
# before delegating to the same managed launcher the interactive Replit
# workflow uses, so the deployed process serves the already-built
# frontend/dist/ via `vite preview` instead of Vite's dev server.
set -Eeuo pipefail

export FRONTEND_SERVE_MODE=preview
export BACKEND_SERVE_MODE=asgi
# Production schema changes are applied by Replit's publish/schema-diff flow.
# Running migrations on every autoscale instance delays port availability and
# can create overlapping startup work during scale-out.
export RUN_MIGRATIONS_ON_START=false

# Issue #633: allow one explicitly enabled, owner-scoped reference fixture
# import to run inside the published runtime, where DATABASE_URL is the
# production database. This is disabled by default and is removed from the
# production userenv immediately after the approved fixture import is verified.
if [[ "${RUN_REFERENCE_IMPORT_ON_START:-false}" == "true" ]]; then
  reference_import_args=(
    import_reference_pieces import
    --handle "${REFERENCE_IMPORT_HANDLE:-cfornesa}"
    --email "${REFERENCE_IMPORT_EMAIL:-cfornesa@outlook.com}"
    --allow-production --json
  )
  if [[ -n "${REFERENCE_IMPORT_USERNAME:-}" ]]; then
    reference_import_args+=(--username "${REFERENCE_IMPORT_USERNAME}")
  fi
  (cd "$(dirname "${BASH_SOURCE[0]}")/../backend" && uv run python manage.py "${reference_import_args[@]}")
fi

exec "$(dirname "${BASH_SOURCE[0]}")/start.sh"

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
# Production schema changes are applied by Replit's publish/schema-diff flow.
# Running migrations on every autoscale instance delays port availability and
# can create overlapping startup work during scale-out.
export RUN_MIGRATIONS_ON_START=false
exec "$(dirname "${BASH_SOURCE[0]}")/start.sh"

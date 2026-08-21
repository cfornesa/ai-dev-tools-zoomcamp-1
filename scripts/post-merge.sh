#!/usr/bin/env bash
set -euo pipefail

# Keep post-merge setup deterministic and non-interactive. The script runs from
# the repository root with the Replit-managed database and secrets available.
uv sync --locked
npm --prefix frontend ci
uv run python manage.py migrate --noinput
npm --prefix frontend run build
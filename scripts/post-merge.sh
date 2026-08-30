#!/usr/bin/env bash
set -euo pipefail

# Keep post-merge setup deterministic and non-interactive. The script runs from
# the repository root with the Replit-managed database and secrets available.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_dir="$repo_root/backend"

(cd "$backend_dir" && uv sync --locked)
npm --prefix frontend ci
(cd "$backend_dir" && uv run python manage.py migrate --noinput)
npm --prefix frontend run build
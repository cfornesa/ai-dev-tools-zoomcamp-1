#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
verify_script="$repo_root/scripts/verify-development-migrations.sh"
fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT

printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'case "${UV_MOCK_MODE:-all}" in' \
  '  all)' \
  "    printf '%s\\n' '[X] scenes.0078_project_content_seo_config'" \
  '    ;;' \
  '  unapplied)' \
  "    printf '%s\\n' '[ ] scenes.0078_project_content_seo_config'" \
  '    ;;' \
  '  failure)' \
  "    printf '%s\\n' 'database connection failed' >&2" \
  '    exit 1' \
  '    ;;' \
  'esac' > "$fixture_dir/uv"
chmod +x "$fixture_dir/uv"

run_case() {
  local mode="$1"
  local expected_status="$2"
  local expected_text="$3"
  local output
  local status

  set +e
  output="$(UV_MOCK_MODE="$mode" PATH="$fixture_dir:$PATH" "$verify_script" 2>&1)"
  status=$?
  set -e

  if [[ "$status" -ne "$expected_status" || "$output" != *"$expected_text"* ]]; then
    printf 'FAIL: mode=%s status=%s output=%s\n' "$mode" "$status" "$output" >&2
    exit 1
  fi
  printf 'PASS: mode=%s\n' "$mode"
}

run_case all 0 'Development migration verification passed'
run_case unapplied 1 'scenes.0078_project_content_seo_config'
run_case failure 1 'showmigrations could not complete'

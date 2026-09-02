#!/usr/bin/env bash
# Verify that a running Docker Compose stack belongs to this repository and
# serves this application before any browser/readiness scenario is allowed to
# use it. This script is deliberately read-only: it never starts, stops, or
# removes containers.
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
expected_project="${COMPOSE_PROJECT_NAME:-ai-dev-tools-zoomcamp-1}"
compose_file="${COMPOSE_FILE:-$repo_root/compose.yaml}"
base_url="${COMPOSE_QA_BASE_URL:-http://127.0.0.1:5000}"

fail() {
  printf '[compose-preflight] ERROR: %s\n' "$*" >&2
  exit 1
}

command -v docker >/dev/null || fail "docker is required"
docker info >/dev/null 2>&1 || fail "Docker daemon is unavailable; start Docker and retry"
[[ -f "$compose_file" ]] || fail "Compose file does not exist: $compose_file"

compose=(docker compose --project-name "$expected_project" --file "$compose_file")
config_services="$("${compose[@]}" config --services 2>&1)" \
  || fail "could not load Compose config $compose_file:\n$config_services"
for service in postgres backend frontend; do
  grep -Fxq "$service" <<<"$config_services" \
    || fail "Compose config is missing required service '$service': $compose_file"
done

expected_working_dir="$(cd "$(dirname "$compose_file")" && pwd)"
running_ids="$("${compose[@]}" ps --all --quiet 2>/dev/null || true)"
if [[ -z "$running_ids" ]]; then
  conflicting_projects="$(docker ps --format '{{.Label "com.docker.compose.project"}}' | awk 'NF && $0 != "'"$expected_project"'"' | sort -u | paste -sd ', ' -)"
  if [[ -n "$conflicting_projects" ]]; then
    fail "no containers belong to Compose project '$expected_project'; running conflicting Compose project(s): $conflicting_projects. Do not stop them. Start this repository with: docker compose --project-name '$expected_project' --file '$compose_file' up -d --build"
  fi
  fail "no containers belong to Compose project '$expected_project'. Start this repository stack with: docker compose --project-name '$expected_project' --file '$compose_file' up -d --build"
fi

while IFS= read -r container_id; do
  [[ -n "$container_id" ]] || continue
  metadata="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.project.working_dir"}}|{{index .Config.Labels "com.docker.compose.project.config_files"}}|{{.State.Status}}' "$container_id")"
  IFS='|' read -r project working_dir config_files status <<<"$metadata"
  [[ "$project" == "$expected_project" ]] \
    || fail "container $container_id belongs to Compose project '$project', not '$expected_project'; do not stop it. Start this repository with: docker compose --project-name '$expected_project' --file '$compose_file' up -d --build"
  [[ "$working_dir" == "$expected_working_dir" ]] \
    || fail "container $container_id has working directory '$working_dir', expected '$expected_working_dir'; do not stop it. Check COMPOSE_FILE and start this repository explicitly"
  case ",$config_files," in
    *,"$compose_file",*) ;;
    *) fail "container $container_id was not created from '$compose_file' (config files: $config_files); do not reuse it" ;;
  esac
  [[ "$status" == running ]] \
    || fail "repository Compose container $container_id is '$status'; start this repository stack with: docker compose --project-name '$expected_project' --file '$compose_file' up -d --build"
done <<<"$running_ids"

health_body="$(curl --silent --show-error --fail --max-time 5 "$base_url/health/")" \
  || fail "health probe failed at $base_url/health/; verify the repository Compose stack is running"
grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' <<<"$health_body" \
  || fail "health response at $base_url was not this repository's healthy Django response: $health_body"

root_body="$(curl --silent --show-error --fail --max-time 5 "$base_url/")" \
  || fail "root probe failed at $base_url/"
grep -Fq 'Creatrweb Animation Studio' <<<"$root_body" \
  || fail "served app identity is not 'Creatrweb Animation Studio'; inspect Docker Compose project labels before running browser tests"

whoami_status="$(curl --silent --max-time 5 -o /dev/null -w '%{http_code}' "$base_url/api/whoami/")"
[[ "$whoami_status" == 401 ]] \
  || fail "anonymous identity probe expected /api/whoami/=401, got $whoami_status"

printf '[compose-preflight] PASS: project=%s config=%s working_dir=%s app=%s\n' \
  "$expected_project" "$compose_file" "$expected_working_dir" "$base_url"

.PHONY: check backend-check frontend-check \
	lint format format-check typecheck test \
	backend-lint backend-format backend-format-check backend-typecheck backend-test \
frontend-lint frontend-format frontend-format-check frontend-typecheck frontend-test \
git-safe-push browser-qa \
e2e dev deploy-check migrate smoke-local smoke-hosted-git

# Run every backend and frontend check (same checks CI runs).
check: backend-check frontend-check

backend-check: backend-lint backend-format-check backend-typecheck backend-test

frontend-check: frontend-lint frontend-format-check frontend-typecheck frontend-test

# Convenience aggregates across both stacks.
lint: backend-lint frontend-lint
format: backend-format frontend-format
format-check: backend-format-check frontend-format-check
typecheck: backend-typecheck frontend-typecheck
test: backend-test frontend-test

backend-lint:
	uv run ruff check .

backend-format:
	uv run ruff format .

backend-format-check:
	uv run ruff format --check .

backend-typecheck:
	uv run mypy .

backend-test:
	uv run pytest

frontend-lint:
	cd frontend && npm run lint

frontend-format:
	cd frontend && npm run format

frontend-format-check:
	cd frontend && npm run format:check

frontend-typecheck:
	cd frontend && npm run typecheck

frontend-test:
	cd frontend && npm test

# Task 65 (issue #65): the Playwright project-lifecycle end-to-end suite.
# Deliberately NOT part of `check`/`test` above -- it needs a real,
# already-running PostgreSQL-backed Django dev server plus the Vite dev
# server (neither of which `check`/CI provisions) and Playwright's browser
# binaries. See AGENTS.md's "End-to-end tests (Playwright)" section before
# running this.
e2e:
	cd frontend && npm run test:e2e

# Provision a disposable PostgreSQL-backed Django/Vite stack, verify the
# origin is this repository, run the Layers browser suite, and clean up.
# Set BROWSER_QA_FULL_E2E=1 for all Playwright suites or
# BROWSER_QA_RUNTIME_BENCH=1 for the standalone runtime benchmark.
browser-qa:
	bash scripts/browser-qa.sh

# Task 89 (issue #91): start Postgres (if needed), the backend, and the
# frontend together from one terminal. Ctrl+C stops all of them cleanly.
dev:
	@bash scripts/dev.sh

# Production-like checks are intentionally separate from local development.
# Supply a non-production .env with explicit production settings.
deploy-check:
	uv run --env-file .env python manage.py check --deploy

migrate:
	uv run --env-file .env python manage.py migrate --noinput

smoke-local:
	BASE_URL=$${BASE_URL:-http://localhost:5000}; export BASE_URL; uv run --env-file .env python manage.py check --deploy && scripts/smoke-local.sh

smoke-hosted-git:
	HOSTED_GIT_SMOKE=$${HOSTED_GIT_SMOKE:-0} scripts/smoke-hosted-git.sh

# Refresh origin/main, classify history safely, and push only a fast-forward.
# GIT_URL is read by a temporary credential helper and is never persisted.
git-safe-push:
	GIT_URL=$${GIT_URL:-} scripts/git-safe-push.sh

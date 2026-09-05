.PHONY: check backend-check frontend-check \
	lint format format-check typecheck test \
	backend-lint backend-format backend-format-check backend-typecheck backend-test \
frontend-lint frontend-format frontend-format-check frontend-typecheck frontend-test \
git-safe-push browser-qa compose-preflight \
e2e webkit-fullscreen dev run deploy-check migrate smoke-local smoke-hosted-git \
check-live-provider-alert check-github-action-pins check-workflows \
install-git-hooks

# Run every backend and frontend check (same checks CI runs).
check: check-workflows check-live-provider-alert backend-check frontend-check

backend-check: backend-lint backend-format-check backend-typecheck backend-test

check-workflows: check-github-action-pins
	@if command -v actionlint >/dev/null 2>&1; then \
		actionlint; \
	elif command -v docker >/dev/null 2>&1; then \
		docker run --rm -v "$(CURDIR):/repo" -w /repo rhysd/actionlint:1.7.7; \
	else \
		echo "Workflow validation requires actionlint or Docker." >&2; \
		exit 1; \
	fi

check-live-provider-alert:
	python3 scripts/check-live-provider-alert.py

check-github-action-pins:
	python3 scripts/check-github-action-pins.py

frontend-check: frontend-lint frontend-format-check frontend-typecheck frontend-test

# Convenience aggregates across both stacks.
lint: backend-lint frontend-lint
format: backend-format frontend-format
format-check: backend-format-check frontend-format-check
typecheck: backend-typecheck frontend-typecheck
test: backend-test frontend-test

backend-lint:
	cd backend && uv run ruff check .

backend-format:
	cd backend && uv run ruff format .

backend-format-check:
	cd backend && uv run ruff format --check .

backend-typecheck:
	cd backend && uv run mypy .

backend-test:
	cd backend && uv run pytest

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

# Run the CI-isolated WebKit fullscreen/Escape regression against the local
# Django/Vite stack. WebKit itself must have been installed with --with-deps
# on a supported Ubuntu/Debian host; see AGENTS.md.
webkit-fullscreen:
	cd frontend && E2E_BASE_URL=$${E2E_BASE_URL:-http://localhost:5000} npm run test:e2e -- e2e/manual2dStageChrome.spec.ts --project=webkit --grep "keeps the fullscreen command synchronized after browser Escape"

# Provision a disposable PostgreSQL-backed Django/Vite stack, verify the
# origin is this repository, run the Layers browser suite, and clean up.
# Set BROWSER_QA_FULL_E2E=1 for all Playwright suites or
# BROWSER_QA_RUNTIME_BENCH=1 for the standalone runtime benchmark.
browser-qa:
	bash scripts/browser-qa.sh

# Issue #321: verify an already-running repository-owned Compose stack before
# using it for browser/readiness checks. This target is read-only and never
# starts or stops containers; use the printed command when the stack is absent.
compose-preflight:
	bash scripts/compose-preflight.sh

# Task 89 (issue #91): start Postgres (if needed), the backend, and the
# frontend together from one terminal. Ctrl+C stops all of them cleanly.
# This is the primary/proven local dev workflow -- it runs the backend via
# `manage.py runserver` (autoreload behavior this whole codebase's docs and
# history are built around) and owns Postgres/`.env` bootstrapping.
dev:
	@bash scripts/dev.sh

# Task 217 (issue #249): an additional, explicitly opt-in dev entry point
# that serves the backend through uvicorn against the new ASGI entry point
# (`backend/backend/main.py`, i.e. `backend.main:app`) instead of
# `manage.py runserver`. Decision: `dev`/scripts/dev.sh above stays the
# primary workflow -- it is the proven, autoreload-tested path referenced
# throughout AGENTS.md -- while `run` exists to exercise the uvicorn/ASGI
# path directly (e.g. to mirror how a production ASGI server would serve
# the app). `run` does not manage Postgres or generate `backend/.env` --
# run `make dev` once first, or create `backend/.env` by hand, before using
# it. Ctrl+C stops both processes. `uvicorn` is not a declared project
# dependency (AGENTS.md's Rules: don't add one without asking) -- `--with
# uvicorn` installs it into uv's ephemeral run environment on demand
# instead of touching pyproject.toml.
run:
	@( \
	  set -m; \
	  trap 'kill 0' EXIT INT TERM; \
	  (cd backend && uv run --with uvicorn --env-file .env uvicorn backend.main:app --reload --port 8091) & \
	  (cd frontend && npm run dev) & \
	  wait \
	)

# Production-like checks are intentionally separate from local development.
# Supply a non-production backend/.env with explicit production settings.
deploy-check:
	cd backend && uv run --env-file .env python manage.py check --deploy

migrate:
	cd backend && uv run --env-file .env python manage.py migrate --noinput

smoke-local:
	BASE_URL=$${BASE_URL:-http://localhost:5000}; export BASE_URL; cd backend && uv run --env-file .env python manage.py check --deploy && cd .. && scripts/smoke-local.sh

smoke-hosted-git:
	HOSTED_GIT_SMOKE=$${HOSTED_GIT_SMOKE:-0} scripts/smoke-hosted-git.sh

# Refresh origin/main, classify history safely, and push only a fast-forward.
# GIT_URL is read by a temporary credential helper and is never persisted.
git-safe-push: check-github-action-pins
	GIT_URL=$${GIT_URL:-} scripts/git-safe-push.sh

install-git-hooks:
	git config core.hooksPath .githooks
	printf 'Git hooks enabled from .githooks\n'

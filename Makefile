.PHONY: check backend-check frontend-check \
	lint format format-check typecheck test \
	backend-lint backend-format backend-format-check backend-typecheck backend-test \
	frontend-lint frontend-format frontend-format-check frontend-typecheck frontend-test \
	e2e

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

.PHONY: check backend-check frontend-check \
	lint format format-check typecheck test \
	backend-lint backend-format backend-format-check backend-typecheck backend-test \
	frontend-lint frontend-format frontend-format-check frontend-typecheck frontend-test

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

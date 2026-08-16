Layout

- Backend: Django project at the repo root (`manage.py`, `config/`, `tests/`)
- Frontend: React/TypeScript/Vite app in `frontend/`

Environment setup (clean checkout)

Django reads required settings (secret key, PostgreSQL `DATABASE_URL`)
from environment variables and fails fast, naming the missing or
malformed variable, if any are unset — see `config/settings.py`.
`.env.example` (repo root) and `frontend/.env.example` document every
variable Django, PostgreSQL, and the frontend use; neither example file
contains real credentials. `.env` files are gitignored and must never be
committed.

`DATABASE_URL` must point at a real, reachable PostgreSQL server — there
is no SQLite fallback outside the test suite. In Replit-deployed
environments Replit's managed PostgreSQL integration supplies
`DATABASE_URL` automatically, with development and production Repls each
getting their own separate database; for local development outside
Replit, point it at your own PostgreSQL server (see `.env.example`).

1. Install backend dependencies: `uv sync`
2. Create your local backend env file: `cp .env.example .env`, then edit
   `.env`:
   - Set `DJANGO_SECRET_KEY` to a real generated value:
     `uv run python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
   - Set `DATABASE_URL` to a real PostgreSQL connection URL.
3. Install frontend dependencies: `cd frontend && npm install`
4. Create your local frontend env file: `cp frontend/.env.example frontend/.env`
5. Apply database migrations: `uv run --env-file .env python manage.py migrate`
6. Start the backend dev server: `uv run --env-file .env python manage.py runserver`
7. In a second terminal, start the frontend dev server: `cd frontend && npm run dev`
8. Check application and database availability at any time:
   `GET /health/` (no connection details are exposed in the response).

`--env-file .env` (a built-in `uv run` flag, not an extra dependency)
loads `.env` into the process environment for that command. Vite loads
`frontend/.env` on its own, so `npm run dev`/`npm test`/`npm run build`
need no extra flag.

Commands

Quality checks (run from the repo root):

- `make check` - every backend and frontend check below, in one command;
  this is exactly what CI (`.github/workflows/ci.yml`) runs on every push
  and pull request
- `make lint` / `make format` / `make format-check` / `make typecheck` /
  `make test` - one check across both stacks
- `make backend-lint` / `make backend-format` / `make backend-format-check`
  / `make backend-typecheck` / `make backend-test` - one backend check
- `make frontend-lint` / `make frontend-format` / `make frontend-format-check`
  / `make frontend-typecheck` / `make frontend-test` - one frontend check

Backend (run from the repo root):

- `uv sync` - install dependencies
- `uv run ruff check .` - lint
- `uv run ruff format .` - format (add `--check` to only verify)
- `uv run mypy .` - type-check (uses `config/test_settings.py`'s safe
  defaults; no real `.env` needed)
- `uv run pytest` - the whole suite (runs offline, without a real `.env`,
  using safe test-only defaults from `config/test_settings.py`; SQLite
  backs `default`, and the small number of tests in `tests/test_health.py`
  that need real PostgreSQL semantics skip themselves unless
  `POSTGRES_TEST_DATABASE_URL` is set — see `.env.example`)
- `uv run pytest tests/test_home.py` - one test file
- `uv run --env-file .env python manage.py migrate` - apply DB migrations
- `uv run --env-file .env python manage.py runserver` - start the backend dev server

Frontend (run from `frontend/`):

- `npm install` - install dependencies
- `npm run lint` - lint (oxlint)
- `npm run format` - format with Prettier (add `:check` to only verify)
- `npm run typecheck` - type-check (`tsc -b`)
- `npm test` - the whole suite (`vitest run`)
- `npm run build` - type-check and production build
- `npm run dev` - start the frontend dev server

Rules

- Dependencies are added in `pyproject.toml`. Do not add one without asking

Documents

- `_docs/process.md` - how work is organized
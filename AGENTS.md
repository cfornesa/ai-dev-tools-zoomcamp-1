Layout

- Backend: Django project at the repo root (`manage.py`, `config/`, `tests/`)
- Frontend: React/TypeScript/Vite app in `frontend/`

Environment setup (clean checkout)

Django reads required settings (secret key, PostgreSQL connection details)
from environment variables and fails fast, naming the missing variable,
if any are unset — see `config/settings.py`. `.env.example` (repo root)
and `frontend/.env.example` document every variable Django, PostgreSQL,
and the frontend use; neither example file contains real credentials.
`.env` files are gitignored and must never be committed.

1. Install backend dependencies: `uv sync`
2. Create your local backend env file: `cp .env.example .env`, then edit
   `.env` and set `DJANGO_SECRET_KEY` to a real generated value:
   `uv run python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
3. Install frontend dependencies: `cd frontend && npm install`
4. Create your local frontend env file: `cp frontend/.env.example frontend/.env`
5. Apply database migrations (SQLite by default; see Task 3 for real
   PostgreSQL wiring): `uv run --env-file .env python manage.py migrate`
6. Start the backend dev server: `uv run --env-file .env python manage.py runserver`
7. In a second terminal, start the frontend dev server: `cd frontend && npm run dev`

`--env-file .env` (a built-in `uv run` flag, not an extra dependency)
loads `.env` into the process environment for that command. Vite loads
`frontend/.env` on its own, so `npm run dev`/`npm test`/`npm run build`
need no extra flag.

Commands

Backend (run from the repo root):

- `uv sync` - install dependencies
- `uv run pytest` - the whole suite (runs offline, without a real `.env`,
  using safe test-only defaults from `config/test_settings.py`)
- `uv run pytest tests/test_home.py` - one test file
- `uv run --env-file .env python manage.py migrate` - apply DB migrations
- `uv run --env-file .env python manage.py runserver` - start the backend dev server

Frontend (run from `frontend/`):

- `npm install` - install dependencies
- `npm test` - the whole suite (`vitest run`)
- `npm run build` - type-check and production build
- `npm run dev` - start the frontend dev server

Rules

- Dependencies are added in `pyproject.toml`. Do not add one without asking

Documents

- `_docs/process.md` - how work is organized
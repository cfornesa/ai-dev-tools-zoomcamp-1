# ai-dev-tools-zoomcamp-1

A Django + React/TypeScript app for building and editing "scenes" — a
canonical JSON-schema-backed scene domain with projects, versions,
drafts, templates, and an AI-assisted editing workflow. The backend is
a Django project at the repo root; the frontend is a Vite-based
React/TypeScript app in `frontend/`.

**[AGENTS.md](./AGENTS.md) is the authoritative reference** for exact
commands, environment variables, and repo layout. This README is a
short map to get a fresh checkout running — anything it doesn't cover,
AGENTS.md does.

## Run locally

1. Install backend dependencies: `uv sync`
2. Create your local backend env file: `cp .env.example .env`, then
   edit `.env` and set `DJANGO_SECRET_KEY`, `DATABASE_URL`, and
   `CSRF_TRUSTED_ORIGINS` (see `.env.example` for details and how to
   generate a secret key).
3. Install frontend dependencies: `cd frontend && npm install`
4. Create your local frontend env file:
   `cp frontend/.env.example frontend/.env`
5. Apply database migrations:
   `uv run --env-file .env python manage.py migrate`
6. Start the backend dev server:
   `uv run --env-file .env python manage.py runserver`
7. In a second terminal, start the frontend dev server:
   `cd frontend && npm run dev`

`DATABASE_URL` must point at a real, reachable PostgreSQL server —
there is no SQLite fallback outside the test suite. If you don't have
one running locally yet, one option (not the only one) is Docker:

```
docker run --name scenes-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

then point `DATABASE_URL` at that container (or use Homebrew/your own
PostgreSQL install instead).

Google sign-in will not work against real Google accounts with the
placeholder `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`
values from `.env.example` — everything else, including the full test
suite, works fine without real values. Replit-deployed environments
already have real OAuth credentials provisioned, so this only affects
a fresh local checkout.

## Run on Replit

Replit's managed PostgreSQL integration supplies `DATABASE_URL`
automatically — development and production Repls each get their own
separate database. That connection string is scoped to Replit's
internal network and is not reachable from outside Replit.

Inside a Replit workspace, start the backend and frontend dev servers
the same way as locally: `uv run --env-file .env python manage.py
runserver` and, in a second shell, `cd frontend && npm run dev`.

## Checks

`make check` runs every backend and frontend check — the same checks
CI runs on every push and pull request. See AGENTS.md's "Commands"
section for the full list of `make`/`npm` targets.

## Health check

`GET /health/` confirms the app and database are reachable (no
connection details are exposed in the response).

## End-to-end tests

A Playwright end-to-end suite covers the full project lifecycle,
interaction runtime, and AI/draft-recovery flows against a real
Postgres-backed stack. See AGENTS.md's "End-to-end tests (Playwright)"
section for the full setup sequence and `make e2e` to run it.

## License

MIT License — see [LICENSE](./LICENSE).

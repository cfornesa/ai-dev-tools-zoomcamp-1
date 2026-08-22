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

The two blocks below are exact, complete, copy-pasteable command
sequences — every command needed to go from a clean checkout to both
dev servers running, nothing left to fill in by hand. They assume you
don't already have PostgreSQL running locally: Terminal 1 starts a
disposable Docker Postgres container on the default port (5432) and
sets `.env`'s `DATABASE_URL`/`DJANGO_SECRET_KEY` to match it
automatically. If you already run PostgreSQL some other way (a
different port, Homebrew, Postgres.app, an existing container), delete
the `docker run` line and edit `DATABASE_URL` in `.env` to match your
setup instead before running the rest of the block.

Google sign-in will not work against real Google accounts with the
placeholder `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`
values from `.env.example` — everything else, including the full test
suite, works fine without real values. Replit-deployed environments
already have real OAuth credentials provisioned, so this only affects
a fresh local checkout. The frontend dev server always runs on port
5000 — see AGENTS.md's "Environment setup" section for how this port,
`CSRF_TRUSTED_ORIGINS`, and the Google OAuth redirect URI must stay in
sync. **On macOS, port 5000 is very likely already taken by AirPlay
Receiver** — if `npm run dev` below fails with "Port 5000 is already in
use", turn it off at System Settings → General → AirDrop & Handoff →
AirPlay Receiver and retry.

**Terminal 1 (backend):**

```bash
docker rm -f scenes-postgres 2>/dev/null
docker run --name scenes-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
uv sync
cp .env.example .env
export SECRET_KEY=$(uv run python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
uv run python -c "
import os, pathlib
p = pathlib.Path('.env')
text = p.read_text()
text = text.replace('DJANGO_SECRET_KEY=changeme-generate-a-real-secret-key', 'DJANGO_SECRET_KEY=' + os.environ['SECRET_KEY'])
text = text.replace('DATABASE_URL=postgres://gesture_studio:changeme@localhost:5432/gesture_studio', 'DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres')
p.write_text(text)
"
until uv run --env-file .env python manage.py migrate; do sleep 1; done
for pid in $(lsof -ti:8000 2>/dev/null); do kill -9 "$pid"; done
uv run --env-file .env python manage.py runserver
```

This block is safe to run more than once: it removes and recreates the
`scenes-postgres` container each time, retries `migrate` until Postgres
is actually ready to accept connections (the official Postgres image
restarts itself once internally right after a fresh container starts,
so the first connection attempt or two failing is normal, not an
error), and clears anything already bound to port 8000 before starting
the server — so re-pasting the whole block after an interrupted or
failed attempt just works.

**Terminal 2 (frontend):**

```bash
cd frontend && npm install
cp .env.example .env
npm run dev
```

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

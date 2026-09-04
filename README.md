# AI Dev Tools Zoomcamp Project 1: Creatrweb Animation Studio

I created this project as part of the Week 1 project for the AI Dev Tools Zoomcamp offered by <a href="https://datatalks.club" target="_blank">DataTalks Club</a>. The GitHub repository for this specific project details and associated assignment is located at <a href="https://github.com/DataTalksClub/ai-dev-tools-zoomcamp/tree/main" target="_blank">this link</a>.

This project is a Django + React/TypeScript app for building and editing "scenes", instantiated as JavaScript library animations. Each scene contains a
canonical JSON-schema-backed scene domain with projects, versions,
drafts, templates, and an AI-assisted editing workflow. The backend is
a Django project in `backend/`; the frontend is a Vite-based
React/TypeScript app in `frontend/`. This project is hosted at Replit and the live site can be found <a href="https://animate.creatrweb.com">here</a>.

**[AGENTS.md](./AGENTS.md) is the authoritative reference** for exact
commands, environment variables, and repo layout. This README is a
short map to get a fresh checkout running — anything it doesn't cover,
AGENTS.md does.

## Run locally

```bash
make dev
```

One command, one terminal. It creates `backend/.env`/`frontend/.env` from
their `.env.example` files the first time only (never overwrites one that
already exists), starts a managed local Postgres container if nothing
is already reachable at `backend/.env`'s `DATABASE_URL`, installs frontend
dependencies if `frontend/node_modules` is missing, applies migrations,
then runs the Django backend (port 8000) and the Vite frontend (port
5000) together, with each server's output prefixed `[backend]`/
`[frontend]`. **Ctrl+C stops everything it started** — both dev
servers and their child processes — and frees both ports before
returning control to your shell, so it's always safe to run again
right after, including after an interrupted or failed attempt. If a
managed step ever falls back to a non-default port, it prints that
port explicitly before serving from it. See `scripts/dev.sh` for what
it does step by step.

Google sign-in will not work against real Google accounts with the
placeholder `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`
values from `backend/.env.example` — everything else, including the full test
suite, works fine without real values. Replit-deployed environments
already have real OAuth credentials provisioned, so this only affects
a fresh local checkout. **On macOS, port 5000 is very likely already
taken by AirPlay Receiver** — if the frontend fails to start with
"Port 5000 is already in use", turn it off at System Settings →
General → AirDrop & Handoff → AirPlay Receiver and retry. See
AGENTS.md's "Environment setup" section for the full port ↔
`CSRF_TRUSTED_ORIGINS` ↔ Google OAuth redirect URI relationship.

### Run the servers manually

Prefer independent control over the backend and frontend (e.g. to
restart just one, or use your own already-running PostgreSQL setup)?
The two blocks below are exact, complete, copy-pasteable command
sequences for two separate terminals — everything `make dev` above
does automatically, spelled out by hand. They assume you don't already
have PostgreSQL running locally: Terminal 1 starts a disposable Docker
Postgres container on the default port (5432) and sets `backend/.env`'s
`DATABASE_URL`/`DJANGO_SECRET_KEY` to match it automatically. If you
already run PostgreSQL some other way (a different port, Homebrew,
Postgres.app, an existing container), delete the `docker run` line and
edit `DATABASE_URL` in `backend/.env` to match your setup instead before
running the rest of the block.

**Terminal 1 (backend):**

```bash
docker rm -f scenes-postgres 2>/dev/null
docker run --name scenes-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
cd backend
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
the same way as locally: `cd backend && uv run --env-file .env python
manage.py runserver` and, in a second shell, `cd frontend && npm run dev`.

## Checks

`make check` runs every backend and frontend check — the same checks
CI runs on every push and pull request. See AGENTS.md's "Commands"
section for the full list of `make`/`npm` targets.

## Local commit checks

The repository includes a local `pre-commit` hook that runs the same
offline GitHub Action pin check used by CI. Enable it once after cloning:

```bash
make install-git-hooks
```

The hook calls `make check-github-action-pins`; it does not contact GitHub
or duplicate the checker. The guarded push workflow also runs this target,
so `make git-safe-push` remains protected when the hook has not been enabled.

If the hook cannot run because local tooling is unavailable, run
`python scripts/check-github-action-pins.py` directly and fix any reported
mutable references before committing. To make one explicitly documented
exception while repairing the local setup, use
`SKIP_GITHUB_ACTION_PIN_CHECK=1 git commit ...`; this only skips the local
hook and does not bypass the CI check.

## Safe Git pushes

When pushing `main` from a Replit workspace, use the repository-local guarded
workflow rather than diagnosing a rejected push from a stale tracking ref:

```bash
make git-safe-push
```

In Replit, `GIT_URL` should be supplied by the workspace secret/environment
setup before running the command; do not paste a token into a shell command or
commit it to a file.

The command fetches `origin/main` first, then treats equal commits as already
complete and pushes only when the local branch is strictly ahead of the
refreshed remote. A remote-ahead branch and a truly diverged branch are
reported separately. Authentication or permission failures are reported as
credential problems, never as missing remote commits. The credential is read
only through a temporary helper and is not written to Git configuration,
command output, or a repository file.

For an external local deployment, safely reconcile a remote-ahead or diverged
branch by fetching, inspecting both histories, and rebasing or merging the
local work onto the remote `main` as appropriate. Resolve and test conflicts,
then run this command again. Never use `--force` or reset the remote to make
the check pass; preserve the remote history and choose explicitly which
commits to keep. Replit's native Git service remains the source of truth for
workspace synchronization; this helper is a safe repository-local fallback.

## Health check

`GET /health/` confirms the app and database are reachable (no
connection details are exposed in the response).

## End-to-end tests

A Playwright end-to-end suite covers the full project lifecycle,
interaction runtime, and AI/draft-recovery flows against a real
Postgres-backed stack. See AGENTS.md's "End-to-end tests (Playwright)"
section for the full setup sequence and `make e2e` to run it.

For repeatable browser acceptance checks without manually coordinating
services, run:

```bash
make browser-qa
```

This creates an isolated disposable PostgreSQL container and temporary
environment, applies migrations, starts Django and Vite, verifies that
`/health/` and anonymous `/api/whoami/` identify this repository, runs the
Layers desktop/narrow Chromium suite, and removes every process/container on
exit. It never reads or writes the developer `backend/.env` database. Use
`BROWSER_QA_FULL_E2E=1 make browser-qa` for the complete Playwright suite or
`BROWSER_QA_RUNTIME_BENCH=1 make browser-qa` for the runtime benchmark. Failed
runs retain temporary logs and print their paths so a browser or service
failure is actionable.

When using Docker Compose, start only this repository's explicitly named
project and verify it before browser testing:

```bash
docker compose --project-name ai-dev-tools-zoomcamp-1 --file compose.yaml up -d --build
make compose-preflight
```

`make compose-preflight` is read-only. It verifies the Compose project,
working directory, config file, served `Creatrweb Animation Studio` marker,
health response, and anonymous auth response; it reports unrelated running
Compose projects without stopping them. Native `make browser-qa` remains an
independent disposable-stack path.

## License

MIT License — see [LICENSE](./LICENSE).

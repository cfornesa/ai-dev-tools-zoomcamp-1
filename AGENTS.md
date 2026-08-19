Layout

- Backend: Django project at the repo root (`manage.py`, `config/`, `tests/`)
- Frontend: React/TypeScript/Vite app in `frontend/`
- `scenes/`: Django app for the canonical scene domain — `validation.py`
  (Tasks 5-7), `models.py` (Tasks 8-10), `permissions.py` (Task 11), the
  single authorization service every project/version/draft/template
  endpoint must go through.
- `schema/`: the canonical scene JSON Schema, complexity/payload limits,
  and shared fixtures — the single contract both `scenes/validation.py`
  and `frontend/src/validation/scene.ts` validate against. See
  `schema/README.md`.
- `frontend/src/api/`: typed fetch wrappers for the Django API
  (`client.ts` handles the session cookie + CSRF header; `auth.ts`,
  `projects.ts` are the per-resource calls). Requests use relative paths
  (`/api/...`) — `vite.config.ts` proxies them to Django in dev so the
  browser sees everything as same-origin (no CORS/SameSite cookie
  configuration needed).
- `frontend/src/auth/`: `AuthProvider`/`useAuth` — who, if anyone, is
  signed in, checked once via `GET /api/whoami/`.
- `frontend/src/pages/`, `frontend/src/components/`: routed pages
  (`Gallery`, `ProjectMetadataForm`, `EditorPlaceholder`, `Home`) and
  shared UI (`ProjectCard`, `Layout`) — see `App.tsx` for the route table.

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
   - Set `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` to a real
     Google OAuth client (see `.env.example`); Google sign-in doesn't work
     against real accounts with the placeholder values, but everything
     else — including the whole test suite — works fine without them
     until [issue #75](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/75) provisions real ones.
3. Install frontend dependencies: `cd frontend && npm install`
4. Create your local frontend env file: `cp frontend/.env.example frontend/.env`
5. Apply database migrations: `uv run --env-file .env python manage.py migrate`
6. Start the backend dev server: `uv run --env-file .env python manage.py runserver`
7. In a second terminal, start the frontend dev server: `cd frontend && npm run dev`
8. Check application and database availability at any time:
   `GET /health/` (no connection details are exposed in the response).
9. Sign in with Google at `/accounts/login/`; `GET /api/whoami/` is a
   minimal example of a login-required route.

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

End-to-end tests (Playwright)

Task 65 (issue #65) added a real-browser project-lifecycle end-to-end
suite (`frontend/e2e/`), covering blank/template project creation, shape
editing, save, version history, restore, and soft-delete against a real
Django + PostgreSQL stack. Task 66/issue #68 added a companion
interaction-runtime suite (`interactionRuntime.spec.ts`), and Task
66/issue #66 added a companion AI-proposal/draft-recovery suite
(`aiAndRecovery.spec.ts`) — same infrastructure, same conventions. All
three are deliberately **not** part of `make check`/`npm test`/CI: unlike
every other test in this repo they need a real, already-*running*
PostgreSQL-backed Django dev server and the Vite dev server, and
Playwright's own downloaded browser binaries. SQLite cannot satisfy this
suite — several scenarios exist specifically to prove
transaction/concurrency guarantees SQLite doesn't provide.

- `make e2e` (from the repo root) - run the whole suite; equivalent to
  `cd frontend && npm run test:e2e` (`playwright test`)
- `cd frontend && npx playwright test --list` - list every scenario
  without running a browser; useful to confirm the suite is syntactically
  valid and every test is discoverable with no server running at all
- `cd frontend && npx playwright install --with-deps chromium` - one-time
  download of the Chromium build Playwright drives (only needed once per
  machine, not before every run)

Before running `make e2e`, in order:

1. A real, reachable PostgreSQL server (see "Environment setup" above —
   this suite does not work against SQLite).
2. `uv run --env-file .env python manage.py migrate`
3. `AI_PROVIDER=fake uv run --env-file .env python manage.py runserver`
   (leave running) — `AI_PROVIDER=fake` swaps every AI endpoint
   (`scenes/ai_api.py`'s `get_ai_provider`) to a deterministic, network-free
   fake provider (`ai_provider/e2e_provider.py`) instead of the real
   Mistral client, so `frontend/e2e/aiAndRecovery.spec.ts` (Task 66,
   issue #66) never needs a real `MISTRAL_API_KEY`. Every other suite
   (`projectLifecycle.spec.ts`, `interactionRuntime.spec.ts`) runs the
   same either way — this only affects the three AI endpoints. Omitting
   it just makes `aiAndRecovery.spec.ts` self-skip its AI scenarios with
   an actionable message; nothing else is affected.
4. `cd frontend && npm run dev` (leave running, in another terminal)

The suite signs in through the real `/accounts/login/` allauth
email/password form (not Google OAuth, which needs real third-party
credentials — see issue #75 above) as two deterministic fixture users a
Playwright `globalSetup` hook creates via `uv run --env-file .env python
manage.py e2e_fixtures create --json`
(`scenes/management/commands/e2e_fixtures.py`) before the suite runs, and
removes via `e2e_fixtures cleanup` after it finishes, along with every
project/version they created — no fixture data or browser storage
(cookies/localStorage/IndexedDB) survives past one run. If the dev
server's `/health/` check isn't reachable when the suite starts, every
scenario self-skips with an actionable message instead of failing, the
same convention `config/test_settings.py`'s `POSTGRES_TEST_DATABASE_URL`
gate already uses for backend-only PostgreSQL tests. Set `E2E_BASE_URL`
to point the suite at a different origin than the default
`http://localhost:5173`.

Rules

- Dependencies are added in `pyproject.toml`. Do not add one without asking

Documents

- `_docs/process.md` - how work is organized
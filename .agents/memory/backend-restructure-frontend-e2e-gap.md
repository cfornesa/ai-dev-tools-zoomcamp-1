# Backend restructure left frontend/e2e's globalSetup stale (Task 217 / issue #249)

Task 217 (issue #249) moved the Django backend from the repo root into
`backend/`: `manage.py`, `pyproject.toml`/`uv.lock`, `.env`/`.env.example`,
`scenes/`, `ai_provider/`, `templates/`, and `tests/` all moved under
`backend/`, and the former `config/` settings package was renamed to
`backend/backend/` (module path `backend.settings` etc). `_docs/` was
renamed to `docs/`. `schema/` stayed at the repo root.

Everything under `frontend/` was deliberately left untouched by that
restructure — the task explicitly scoped frontend as "unchanged, do not
touch its internals." That leaves one real, confirmed gap:

**`frontend/e2e/support/global-setup.ts`'s fixture-seeding shell-out is now
broken.** It computes `REPO_ROOT` as three directories up from its own file
(`frontend/e2e/support/` -> repo root), which still correctly resolves to
the true repo root since `frontend/` didn't move — but it then does:

```ts
execFileSync('uv', ['run', ...ENV_FILE_ARGS, 'python', 'manage.py', 'e2e_fixtures', 'create', '--json'],
  { cwd: REPO_ROOT, ... })
```

`manage.py` and `pyproject.toml` no longer live at `REPO_ROOT` — they're
under `backend/` now, so `uv run` there fails to find the project. The
`.env` fallback lookup (`ENV_FILE_ARGS`, used when `E2E_ENV_FILE` isn't
set) also defaults to `REPO_ROOT/.env`, which no longer exists (`.env`
moved to `backend/.env`).

**Blast radius:** only the fixture-seeding step of a real end-to-end run.
`npx playwright test --list` (pure static discovery, no `globalSetup`
execution) is unaffected. Every other backend/docs/scripts/CI path fixed by
the restructure (see `docs/tasks.md` task 217) verifies clean on its own —
this is purely a `frontend/`-internal follow-up.

**Fix (not yet applied — needs its own frontend-scoped change):** update
`global-setup.ts`'s `cwd` for the `execFileSync` call to `path.join(REPO_ROOT, 'backend')`
(or equivalent), and either point `ENV_FILE_ARGS`'s fallback at
`backend/.env` or keep relying on `E2E_ENV_FILE` being set explicitly (CI's
e2e-browser job in `.github/workflows/ci.yml` already writes its disposable
env to `backend/.env`).

See also: `AGENTS.md`'s "End-to-end tests (Playwright)" section, which
carries a pointer back to this note.

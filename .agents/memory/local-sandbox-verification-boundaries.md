# Local sandbox verification boundaries

The managed macOS Codex workspace may prevent the repository's subprocess and
localhost-socket tests from completing, even when the implementation is
correct. In this environment `make check` can fail in
`tests/test_startup_configuration.py` with launcher subprocess timeouts and in
`tests/test_git_safe_push.py` with `PermissionError: [Errno 1] Operation not
permitted` while binding `127.0.0.1`. The default uv cache may also be
read-only; use a task-scoped writable `UV_CACHE_DIR` for diagnostic runs.

Treat these as verification boundaries unless reproduced in an approved CI or
deployment environment. Do not weaken product code or tests to accommodate
the sandbox; rerun the full gate where subprocesses and loopback binds are
allowed.

**No `backend/.env`/PostgreSQL sandbox (Claude Code CLI):** a distinct,
separately-observed boundary in the Claude Code CLI environment (not the
managed-macOS-Codex case above): no `backend/.env` file exists and no
PostgreSQL server is configured, so `manage.py runserver`/`npm run dev`
can't be started at all — `make check` (offline SQLite-backed pytest +
oxlint/prettier/tsc/vitest) still runs and passes fully, but any live
browser check of the rendered app (Playwright E2E, or a manual
click-through) is categorically unavailable, not just flaky. Observed
repeatedly during the 2026-08-31 backlog session (tasks 224/#256,
229/#261, 230/#262 in `docs/tasks.md`) — each was completed with
`make check` green and recorded a verification boundary rather than
claiming a live-UI check that never happened. Do not fabricate or imply
browser verification when this boundary applies; state it explicitly in
the QA comment/task entry and name the exact next action (a human, or an
agent in an environment with real credentials/PostgreSQL, does the live
check).

/**
 * Task 65 (issue #65): Playwright `globalSetup` for the project-lifecycle
 * end-to-end suite.
 *
 * Two things happen here, in order:
 *
 * 1. A `GET /health/` probe against the configured base URL. If it
 *    doesn't respond `ok`, none of this suite's prerequisites (a running
 *    `manage.py runserver` backed by real PostgreSQL, and `npm run dev`
 *    proxying to it -- see AGENTS.md) are met, so this writes
 *    `{ available: false, reason }` and returns *without* throwing.
 *    Throwing here would abort the whole Playwright run with a raw
 *    Node stack trace; writing `available: false` instead lets every
 *    spec file's own `beforeAll` call `test.skip(...)` with a clear,
 *    actionable message, matching this repo's existing
 *    `POSTGRES_TEST_DATABASE_URL`-gated backend-test skip convention
 *    (see `config/test_settings.py`) rather than a hard crash.
 * 2. If the health probe succeeds, seed the two deterministic fixture
 *    users (`scenes/management/commands/e2e_fixtures.py`) by shelling out
 *    to the exact `manage.py` invocation AGENTS.md documents
 *    (`uv run --env-file .env python manage.py ...`), and record their
 *    credentials in the same state file for every spec's `beforeAll` to
 *    read via `readE2EState()`.
 *
 * A failure in step 2 (e.g. migrations not applied yet) is caught the
 * same way -- recorded as `available: false` with the command's own error
 * output folded into the actionable message, never thrown.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { FullConfig } from '@playwright/test';

import { writeE2EState } from './state.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const ENV_FILE_ARGS = fs.existsSync(path.join(REPO_ROOT, '.env')) ? ['--env-file', '.env'] : [];

const PREREQUISITES_HINT =
  'This suite requires, in order: (1) a real reachable PostgreSQL server ' +
  "(AGENTS.md's DATABASE_URL setup -- SQLite cannot satisfy Task 65), " +
  '(2) migrations applied via `uv run --env-file .env python manage.py migrate`, ' +
  '(3) the Django dev server running via ' +
  '`uv run --env-file .env python manage.py runserver`, and ' +
  '(4) the Vite dev server running via `npm run dev` in frontend/ (it proxies ' +
  '/api, /accounts, and /health to Django -- see frontend/vite.config.ts). ' +
  'Start all four, then run `make e2e` from the repo root.';

async function probeHealth(baseURL: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(`${baseURL}/health/`, { signal: AbortSignal.timeout(5_000) });
    return { ok: response.ok, detail: `GET /health/ returned ${response.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: `GET /health/ failed: ${message}` };
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    config.projects[0]?.use?.baseURL ?? process.env.E2E_BASE_URL ?? 'http://localhost:5000';

  const health = await probeHealth(baseURL);
  if (!health.ok) {
    writeE2EState({
      available: false,
      reason: `${baseURL} is not reachable and ready (${health.detail}). ${PREREQUISITES_HINT}`,
    });
    return;
  }

  try {
    const output = execFileSync(
      'uv',
      ['run', ...ENV_FILE_ARGS, 'python', 'manage.py', 'e2e_fixtures', 'create', '--json'],
      { cwd: REPO_ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const lastLine = output.trim().split('\n').at(-1);
    if (!lastLine) {
      throw new Error('e2e_fixtures create --json produced no output');
    }
    const fixtures = JSON.parse(lastLine) as {
      available: true;
      password: string;
      owner: { username: string; email: string };
      other: { username: string; email: string };
    };
    writeE2EState(fixtures);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    writeE2EState({
      available: false,
      reason:
        `${baseURL} answered /health/, but seeding deterministic E2E fixture users failed ` +
        `(uv run manage.py e2e_fixtures create --json): ${message}. Confirm migrations are ` +
        `applied against the real PostgreSQL database this server is using. ${PREREQUISITES_HINT}`,
    });
  }
}

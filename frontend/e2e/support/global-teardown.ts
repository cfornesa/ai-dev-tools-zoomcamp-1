/**
 * Task 65 (issue #65): Playwright `globalTeardown` counterpart to
 * `global-setup.ts` -- removes the deterministic fixture users (and,
 * transitively, every project/version/draft they created during the run
 * -- see `scenes/management/commands/e2e_fixtures.py`'s cascade-delete
 * note) so a finished run leaves no cross-run database records, and
 * deletes the local state file so a stale `available: true` can never be
 * read by a future run that starts without `globalSetup` re-populating it.
 *
 * Runs unconditionally, even if the suite's tests failed or the prior
 * `globalSetup` recorded `available: false` (in which case there is
 * nothing to clean up, and the cleanup command is skipped entirely --
 * calling it against a server that was never confirmed reachable would
 * just replace one actionable failure with a confusing second one).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { clearE2EState, readE2EState } from './state.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const configuredEnvFile = process.env.E2E_ENV_FILE;
const ENV_FILE_ARGS = configuredEnvFile
  ? ['--env-file', configuredEnvFile]
  : fs.existsSync(path.join(REPO_ROOT, '.env'))
    ? ['--env-file', '.env']
    : [];

export default async function globalTeardown(): Promise<void> {
  const state = readE2EState();

  if (state.available) {
    try {
      execFileSync(
        'uv',
        ['run', ...ENV_FILE_ARGS, 'python', 'manage.py', 'e2e_fixtures', 'cleanup', '--json'],
        { cwd: REPO_ROOT, stdio: 'ignore' },
      );
    } catch (err) {
      // Best-effort: teardown must not mask the suite's actual pass/fail
      // result. Surface the failure to the console so a human notices
      // leftover e2e_owner/e2e_other data needs manual cleanup, but never
      // throw from here.
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[e2e globalTeardown] Failed to clean up fixture users/projects: ${message}. ` +
          'Run `uv run --env-file .env python manage.py e2e_fixtures cleanup` by hand.',
      );
    }
  }

  clearE2EState();
}

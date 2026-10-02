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
import { runFixtureCommand } from './fixtureCommand.js';
import { clearE2EState, readE2EState } from './state.js';

export default async function globalTeardown(): Promise<void> {
  const state = readE2EState();

  if (state.available) {
    try {
      runFixtureCommand('cleanup', state.databaseFingerprint);
    } catch (err) {
      // Best-effort: teardown must not mask the suite's actual pass/fail
      // result. Surface the failure to the console so a human notices
      // leftover e2e_owner/e2e_other data needs manual cleanup, but never
      // throw from here.
      const message = err instanceof Error ? err.message : String(err);
      const stderr =
        err && typeof err === 'object' && 'stderr' in err
          ? String((err as { stderr?: Buffer | string }).stderr ?? '')
          : '';
      if (
        /Fixture mutation (?:refused|requires)|Disposable staging fixtures require/i.test(stderr)
      ) {
        throw new Error(
          `Unsafe E2E teardown target rejected; no cleanup was performed: ${stderr || message}`,
        );
      }
      console.error(
        `[e2e globalTeardown] Failed to clean up fixture users/projects: ${message}. ` +
          'Re-run Playwright with the same E2E_FIXTURE_ENVIRONMENT and E2E_ENV_FILE used during setup.',
      );
    }
  }

  clearE2EState();
}

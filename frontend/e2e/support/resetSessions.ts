/**
 * Issue #505: a per-spec-file reset for the fixture users' server-side
 * Django sessions.
 *
 * `global-setup.ts`/`global-teardown.ts` already reset the *user* rows
 * once per run, but every spec that signs a fixture user in through the
 * real `/accounts/login/` form (`loginViaUI`) leaves a server-side
 * `Session`/`SessionMetadata` row behind -- closing a `BrowserContext`
 * only drops the client's cookie jar, it never signs the session out.
 * In a serial full-matrix run the ~17 spec files that execute before
 * `accountSessions.spec.ts` each leave one or more owner sessions, so
 * that file's first count assertion (`toHaveCount(2)`) observes ~8
 * listitems instead (observed on CI 2026-09-09, chromium and firefox).
 *
 * Specs that assert on exact session counts call this once in their
 * `beforeAll` (after `requireE2EFixtures()` has confirmed the server is
 * up) so their own first test starts from zero regardless of what the
 * same run's earlier specs left behind. It shells out to the same
 * `manage.py e2e_fixtures` path `global-setup.ts` already uses -- the
 * database is a network resource the Playwright worker process cannot
 * reach directly.
 */
import { runFixtureCommand } from './fixtureCommand.js';

export function resetFixtureSessions(): void {
  runFixtureCommand('reset-sessions');
}

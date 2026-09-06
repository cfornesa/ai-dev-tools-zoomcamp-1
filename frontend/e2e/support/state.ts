/**
 * Task 65 (issue #65): the tiny JSON file `global-setup.ts` writes and
 * every spec file's `beforeAll` reads, recording whether this run's
 * prerequisites (a reachable dev server backed by real PostgreSQL, plus
 * the deterministic fixture users) are actually available.
 *
 * A file rather than an environment variable because `globalSetup` runs
 * in a separate Node process from the worker processes that run each
 * spec file, so `process.env` mutations in one are never visible in the
 * other -- Playwright's own documented pattern for passing globalSetup
 * output to tests.
 */
import fs from 'node:fs';
import path from 'node:path';

export const STATE_FILE = path.join(import.meta.dirname, '..', '.e2e-state.json');

export type FixtureUser = {
  username: string;
  email: string;
};

export type E2EState =
  | {
      available: true;
      password: string;
      owner: FixtureUser;
      other: FixtureUser;
      empty: FixtureUser;
      admin: FixtureUser;
      deletable: FixtureUser;
    }
  | {
      available: false;
      reason: string;
    };

export function writeE2EState(state: E2EState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function readE2EState(): E2EState {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw) as E2EState;
  } catch {
    return {
      available: false,
      reason:
        "No e2e/.e2e-state.json was found. This means Playwright's globalSetup " +
        'either has not run yet or failed before it could write its result -- run ' +
        'the suite through `make e2e` (or `npx playwright test` from frontend/), ' +
        'never a bare test runner invocation that skips globalSetup.',
    };
  }
}

export function clearE2EState(): void {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {
    // Already gone -- nothing to clean up.
  }
}

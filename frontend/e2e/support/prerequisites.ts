/**
 * Task 65 (issue #65): call at the top of a `test.describe` (inside a
 * `test.beforeAll`) to self-skip an entire spec file when this run's
 * prerequisites -- a reachable PostgreSQL-backed dev server and the
 * deterministic fixture users `global-setup.ts` seeds -- were not
 * available. Mirrors the backend's own `POSTGRES_TEST_DATABASE_URL`-gated
 * skip convention (`config/test_settings.py`, `tests/test_health.py`)
 * adapted to Playwright's `test.skip(condition, reason)`.
 *
 * Returns the fixture credentials on success so callers don't need a
 * second, separately-typed read of the state file.
 */
import { test } from '@playwright/test';

import { readE2EState, type E2EState } from './state.js';

export function requireE2EFixtures(): Extract<E2EState, { available: true }> {
  const state = readE2EState();
  test.skip(!state.available, !state.available ? state.reason : undefined);
  // `test.skip` throws when its condition is true, so this line is only
  // reached once `available` is narrowed to `true` by TypeScript's control
  // flow analysis on the line above -- but TS can't see that across the
  // library call, hence the explicit assertion below.
  return state as Extract<E2EState, { available: true }>;
}

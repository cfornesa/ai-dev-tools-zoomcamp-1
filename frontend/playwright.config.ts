/**
 * Task 65 (issue #65): Playwright config for the project-lifecycle
 * end-to-end suite (`frontend/e2e/`).
 *
 * This suite is deliberately NOT part of `npm test`/`make check` — see
 * AGENTS.md's "End-to-end tests (Playwright)" section for why: it needs a
 * real PostgreSQL-backed Django server and the Vite dev server both
 * already running, which the offline `make check` pipeline never
 * provisions. Run it with `make e2e` (or `npx playwright test` from this
 * directory) after starting both servers per AGENTS.md's local-dev setup.
 *
 * `globalSetup`/`globalTeardown` seed and remove the two deterministic
 * fixture users (`scenes/management/commands/e2e_fixtures.py`) the suite
 * signs in as, and record in `.e2e-state.json` whether the target server
 * was reachable at all — every spec file reads that state in its own
 * `beforeAll` and self-skips with an actionable message when it wasn't,
 * mirroring this repo's own `POSTGRES_TEST_DATABASE_URL`-gated backend
 * test convention (see `config/test_settings.py`) rather than failing
 * `npx playwright test --list`, which never runs `globalSetup` at all and
 * so stays usable for pure syntax/discoverability checks even with no
 * server running anywhere.
 */
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  // Task 70 (issue #70): the runtime-limits benchmark lives under
  // e2e/benchmark/ and runs via its own playwright.bench.config.ts (no
  // Django/PostgreSQL/globalSetup needed) — excluded here so `make e2e`/
  // plain `npx playwright test` never tries to run it against this
  // config's Django-backed globalSetup.
  testIgnore: ['**/benchmark/**'],
  // Deterministic, isolated fixtures per acceptance criterion: every
  // scenario creates its own project(s) under the fixed e2e_owner/
  // e2e_other users and nothing here shares mutable state across test
  // files, but running serially keeps the *authorization* and
  // *concurrency* scenarios (which reason about exact version counts and
  // sequence numbers on a project) trivially easy to reason about and
  // keeps output easy to read when the suite fails in an environment that
  // does have PostgreSQL. Flip to true once a project-per-file convention
  // is proven not to need it.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/support/global-setup.ts',
  globalTeardown: './e2e/support/global-teardown.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Every scenario logs in explicitly through the real /accounts/login/
    // form (see e2e/support/auth.ts) rather than relying on a shared
    // storageState, so no browser storage carries over between tests --
    // acceptance criterion "leaves no cross-test... browser storage".
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

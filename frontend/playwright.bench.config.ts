/**
 * Task 70 (issue #70): Playwright config for the runtime-limits benchmark
 * (`e2e/benchmark/runtimeLimits.bench.ts`) — deliberately separate from
 * `playwright.config.ts` (Task 65's project-lifecycle end-to-end suite):
 * this benchmark needs no Django server, no PostgreSQL, no Vite dev
 * server, and no fixture-user `globalSetup`/`globalTeardown` at all — the
 * runtime/render modules it measures are pure client-side TypeScript,
 * bundled with Vite library mode and loaded directly into an isolated
 * `about:blank` Chromium page (see `e2e/benchmark/bundleHarness.ts`,
 * reusing `e2e/support/exportHarness.ts`'s Task 69 bundling technique).
 *
 * Not part of `make check`/`npm test`/`make e2e`: it's a manual/on-demand
 * benchmark, not a pass/fail correctness suite (see `_docs/benchmarks.md`
 * for the full rationale on why no hardcoded CI gate is wired up against
 * this machine's specific numbers). Run it with
 * `npm run bench:runtime` from `frontend/`.
 *
 * `--enable-precise-memory-info` is passed so `performance.memory` is
 * populated in this Chromium build — without it, `usedJSHeapSize` reads as
 * a coarsely-bucketed or absent value in some Chromium versions. See
 * `_docs/benchmarks.md`'s "Memory measurement" section for what this
 * flag does and does not guarantee.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/benchmark',
  testMatch: '**/*.bench.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--enable-precise-memory-info'],
        },
      },
    },
  ],
});

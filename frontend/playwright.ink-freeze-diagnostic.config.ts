import os from 'node:os';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5000';
const browserChannel = process.env.PLAYWRIGHT_CHANNEL;
const outputDir =
  process.env.CI1347_RESULTS_DIR ?? path.join(os.tmpdir(), 'ci-1347-ink-freeze-results');

export default defineConfig({
  testDir: './diagnostics',
  testMatch: 'inkFreezeDiagnostic.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  globalTimeout: 25 * 60 * 1000,
  reporter: [['list']],
  outputDir,
  globalSetup: './e2e/support/global-setup.ts',
  globalTeardown: './e2e/support/global-teardown.ts',
  use: {
    actionTimeout: 10_000,
    baseURL,
    navigationTimeout: 20_000,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel === 'chrome' ? { channel: 'chrome' } : {}),
      },
    },
  ],
});

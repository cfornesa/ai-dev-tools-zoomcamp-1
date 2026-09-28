import fs from 'node:fs';

import { strFromU8, unzipSync } from 'fflate';
import { expect, test } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Complete account ZIP export (#945)', () => {
  const fixture = requireE2EFixtures();

  test('shows the prepared size and delivers account metadata plus validated piece packages', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    const project = await apiPost(context, '/api/projects/blank/', {});
    expect(project.status()).toBe(201);

    await page.goto('/account/settings/export');
    await page.getByRole('button', { name: 'Prepare complete ZIP' }).click();
    await expect(page.getByRole('region', { name: 'Complete ZIP export ready' })).toBeVisible({
      timeout: 120000,
    });
    await expect(page.getByText(/ZIP ready: .* bytes, .* piece packages/)).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download everything (ZIP)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('account-export-complete.zip');
    const path = await download.path();
    const entries = unzipSync(fs.readFileSync(path!));
    const manifest = JSON.parse(strFromU8(entries['manifest.json'])) as {
      partial: boolean;
      account: { path: string; sha256: string };
      packages: Array<{ path: string | null; sha256: string | null }>;
    };
    expect(manifest.partial).toBe(false);
    expect(entries[manifest.account.path]).toBeDefined();
    const packageEntry = manifest.packages.find((item) => item.path);
    expect(packageEntry?.path).toBeTruthy();
    expect(entries[packageEntry!.path!]).toBeDefined();
    expect(packageEntry!.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

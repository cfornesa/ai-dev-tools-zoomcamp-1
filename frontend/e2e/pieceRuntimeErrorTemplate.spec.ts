import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Generated runtime error/ready template (#801)', () => {
  const e2eFixtures = requireE2EFixtures();

  test('reports a throwing SVG online and in the extracted ZIP', async ({ page, context }) => {
    test.setTimeout(90_000);
    await loginViaUI(page, e2eFixtures.owner.email, e2eFixtures.password);
    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data?.source === 'art-piece-sandbox' && event.data.status === 'ready') {
          (window as Window & { __runtimeReady?: boolean }).__runtimeReady = true;
        }
      });
    });
    const profileResponse = await apiGet(context, '/api/account/profile/');
    expect(profileResponse.ok()).toBe(true);
    const profile = (await profileResponse.json()) as Record<string, unknown>;
    const handle = `e2e-runtime-${Date.now().toString(36)}`;
    const updatedProfile = await apiPatch(context, '/api/account/profile/', {
      ...profile,
      handle,
      display_name: 'Runtime Template Fixture',
      is_public: true,
    });
    expect(updatedProfile.ok()).toBe(true);

    const source =
      '<svg id="runtime-error-svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#172554"/></svg>' +
      '<script>setTimeout(() => { throw new Error("runtime fixture failed"); }, 0);</script>';
    const created = await apiPost(context, '/api/art-pieces/', {
      title: 'Runtime error fixture',
      description: 'A deterministic runtime failure fixture.',
      prompt: 'A runtime failure fixture',
      engine: 'svg',
      public_slug: 'runtime-error-fixture',
      capabilities: { screenshot: true, fullscreen: true, download: true },
      source,
    });
    expect(created.status()).toBe(201);
    const piece = (await created.json()) as { public_id: string };
    const published = await apiPatch(context, `/api/art-pieces/${piece.public_id}/`, {
      status: 'published',
    });
    expect(published.status()).toBe(200);

    await page.goto(`/users/@${handle}/pieces/runtime-error-fixture`);
    await expect(page.locator('iframe[title="Art piece preview"]')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/runtime fixture failed/i, {
      timeout: 10_000,
    });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Open download menu' }).click();
    await page.getByRole('menuitem', { name: 'Download Full ZIP' }).click();
    const download = await downloadPromise;
    const zip = await JSZip.loadAsync(fs.readFileSync((await download.path())!));
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-template-'));
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const target = path.join(root, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, await entry.async('nodebuffer'));
    }
    try {
      await page.goto(`file://${path.join(root, 'index.html')}`);
      await expect(page.locator('#art-piece-runtime-error')).toContainText(
        /runtime fixture failed/i,
        { timeout: 10_000 },
      );
      await expect(page.locator('#art-piece-runtime-ready')).toBeHidden();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }

    const validCreated = await apiPost(context, '/api/art-pieces/', {
      title: 'Runtime ready fixture',
      description: 'A deterministic runtime ready fixture.',
      prompt: 'A runtime ready fixture',
      engine: 'svg',
      public_slug: 'runtime-ready-fixture',
      capabilities: { screenshot: true, fullscreen: true },
      source:
        '<svg id="runtime-ready-svg" viewBox="0 0 320 240"><circle cx="160" cy="120" r="40"/></svg>',
    });
    expect(validCreated.status()).toBe(201);
    const validPiece = (await validCreated.json()) as { public_id: string };
    const validPublished = await apiPatch(context, `/api/art-pieces/${validPiece.public_id}/`, {
      status: 'published',
    });
    expect(validPublished.status()).toBe(200);
    await page.goto(`/users/@${handle}/pieces/runtime-ready-fixture`);
    await expect(page.locator('iframe[title="Art piece preview"]')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => (window as Window & { __runtimeReady?: boolean }).__runtimeReady),
      )
      .toBe(true);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SOURCE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="teal"/></svg>';

test.describe('server-backed generated piece package export (#967)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`exports generated history at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const profileResponse = await apiGet(page.context(), '/api/account/profile/');
      expect(profileResponse.ok()).toBe(true);
      const profile = (await profileResponse.json()) as { handle: string };
      const slug = `e2e-generated-package-${viewport.width}-${Date.now().toString(36)}`;
      const created = await apiPost(page.context(), '/api/art-pieces/', {
        title: 'Generated package fixture',
        description: 'Generated package export fixture.',
        prompt: 'Create a generated package fixture',
        engine: 'svg',
        public_slug: slug,
        capabilities: { screenshot: true, download: true },
        source: SOURCE,
      });
      expect(created.status()).toBe(201);
      const piece = (await created.json()) as { public_id: string };
      const version = await apiPost(
        page.context(),
        `/api/art-pieces/${piece.public_id}/versions/`,
        {
          source: SOURCE.replace('teal', 'navy'),
          generation_metadata: { prompt: 'second fixture version' },
        },
      );
      expect(version.status()).toBe(201);
      const published = await apiPatch(page.context(), `/api/art-pieces/${piece.public_id}/`, {
        status: 'published',
      });
      expect(published.status()).toBe(200);

      await page.goto(`/users/@${profile.handle}/edit/${slug}`);
      await expect(page.getByRole('button', { name: 'Export piece package' })).toBeVisible();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export piece package' }).press('Enter');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('generated-package-fixture-package.zip');
      const path = await download.path();
      expect(path).not.toBeNull();
      const archive = await JSZip.loadAsync(await readFile(path!));
      const manifest = JSON.parse(await archive.file('manifest.json')!.async('text')) as {
        kind: string;
        records: Array<{ index: number }>;
        source: { engine: string; currentVersionId: number };
        sonic: unknown;
      };
      expect(manifest.kind).toBe('generated');
      expect(manifest.records).toHaveLength(2);
      expect(manifest.source.engine).toBe('svg');
      expect(manifest.source.currentVersionId).toBeGreaterThan(0);
      expect(manifest.sonic).toBeNull();
      const unchanged = await apiGet(page.context(), `/api/art-pieces/${piece.public_id}/`);
      expect(unchanged.status()).toBe(200);
      expect((await unchanged.json()).current_version.sequence).toBe(2);
      await page.screenshot({
        path: testInfo.outputPath('generated-piece-package-export.png'),
        fullPage: true,
      });
    });
  }
});

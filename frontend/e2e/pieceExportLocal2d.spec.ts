import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';
import { expect, test, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Local 2D piece package export (#956)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`exports a checksum-verifiable package at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/create');
      await page.getByRole('button', { name: 'Create a new 2D project', exact: true }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);
      await expect(page.getByRole('heading', { name: 'Untitled animation' })).toBeVisible();

      await page.getByRole('button', { name: 'Prepare piece package' }).click();
      await expect(page.getByRole('region', { name: 'Piece package export' })).toBeVisible();
      await expect(page.getByText(/Package size:/)).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      await page
        .getByRole('button', { name: /Download piece package|Export without missing media/ })
        .click();
      const download = await downloadPromise;
      const path = await download.path();
      expect(path).not.toBeNull();
      const archive = await JSZip.loadAsync(await readFile(path!));
      const manifest = JSON.parse(await archive.file('manifest.json')!.async('text')) as {
        kind: string;
        metadata: { title: string };
        records: unknown[];
      };
      expect(manifest.kind).toBe('2d');
      expect(manifest.metadata.title).toBe('Untitled animation');
      expect(manifest.records).toHaveLength(1);
      expect(archive.file('files/0.json')).not.toBeNull();
      await page.screenshot({
        path: testInfo.outputPath('local-piece-export.png'),
        fullPage: true,
      });
    });
  }
});

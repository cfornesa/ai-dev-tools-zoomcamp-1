import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';
import { expect, test, type TestInfo } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { openEditScene } from './support/openEditScene.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Server-backed 2D piece package export (#966)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`exports a validated package at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const created = await apiPost(page.context(), '/api/projects/blank/', {
        renderer: 'canvas2d',
      });
      expect(created.status()).toBe(201);
      const { id: projectId } = (await created.json()) as { id: string };
      await page.goto(`/ai-projects/${projectId}`);

      await openEditScene(page);

      await page.getByRole('button', { name: 'File', exact: true }).click();
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: 'Export piece package' }).click();
      const download = await downloadPromise;
      const path = await download.path();
      expect(path).not.toBeNull();
      expect(download.suggestedFilename()).toMatch(/-package\.zip$/);

      const archive = await JSZip.loadAsync(await readFile(path!));
      const manifest = JSON.parse(await archive.file('manifest.json')!.async('text')) as {
        kind: string;
        records: unknown[];
        files: Array<{ sha256: string; path: string }>;
      };
      expect(manifest.kind).toBe('2d');
      expect(manifest.records.length).toBeGreaterThan(0);
      expect(archive.file('files/0.json')).not.toBeNull();
      expect(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath('server-2d-piece-export.png'),
        fullPage: true,
      });
    });
  }
});

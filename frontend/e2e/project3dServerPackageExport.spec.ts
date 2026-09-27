import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';
import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SCENE = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'server-3d-package-fixture',
  scene: { backgroundColor: '#101018' },
  camera: {
    position: { x: 0, y: 5, z: 10 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,
    near: 0.1,
    far: 1000,
  },
  lights: [{ id: 'ambient', type: 'ambient', color: '#ffffff', intensity: 1 }],
  groups: [],
  objects: [],
  randomness: { seed: 1, enabled: false },
};

test.describe('server-backed 3D piece package export (#968)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`exports complete 3D history at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/');
      await page.getByRole('button', { name: 'More creation options' }).click();
      const created = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/projects3d/',
      );
      await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
      const project = (await (await created).json()) as { id: string };

      const first = await apiPost(page.context(), `/api/projects3d/${project.id}/versions/`, {
        scene_json: SCENE,
        origin: 'manual',
      });
      expect(first.status()).toBe(201);
      const second = await apiPost(page.context(), `/api/projects3d/${project.id}/versions/`, {
        scene_json: { ...SCENE, id: 'server-3d-package-fixture-v2' },
        origin: 'manual',
      });
      expect(second.status()).toBe(201);

      await page.goto(`/projects3d/${project.id}`);
      await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
      const exportButton = page.getByRole('button', { name: 'Export piece package' });
      await expect(exportButton).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      await exportButton.press('Enter');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('untitled-3d-scene-package.zip');
      const downloadPath = await download.path();
      expect(downloadPath).not.toBeNull();
      const archive = await JSZip.loadAsync(await readFile(downloadPath!));
      const manifest = JSON.parse(await archive.file('manifest.json')!.async('text')) as {
        kind: string;
        records: Array<{ index: number; fileIndex: number }>;
        source: { currentVersionId: number; renderer: unknown };
      };
      expect(manifest.kind).toBe('3d');
      expect(manifest.records).toHaveLength(3);
      expect(manifest.records.map((record) => record.index)).toEqual([0, 1, 2]);
      expect(manifest.source.currentVersionId).toBeGreaterThan(0);
      expect(manifest.source.renderer).toMatchObject({ preferred: 'threejs' });

      const unchanged = await apiGet(page.context(), `/api/projects3d/${project.id}/`);
      expect(unchanged.status()).toBe(200);
      expect((await unchanged.json()).current_version.sequence).toBe(3);
      await page.screenshot({
        path: testInfo.outputPath('3d-piece-package-export.png'),
        fullPage: true,
      });
    });
  }
});

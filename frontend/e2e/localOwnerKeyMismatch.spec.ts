import { expect, test, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

const fixtures = requireE2EFixtures();

async function seedLegacyHandleProject(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    const request = indexedDB.open('creatrart-local-projects');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (db.version !== 6) throw new Error(`Expected local DB v6, received v${db.version}`);
    const tx = db.transaction(['projects', 'scenes'], 'readwrite');
    tx.objectStore('projects').put({
      id: 'legacy-split-project',
      ownerId: 'e2e_split_artist',
      title: 'Legacy handle-keyed project',
      sceneOrder: ['legacy-split-scene'],
      activeSceneId: 'legacy-split-scene',
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T00:00:00.000Z',
      kind: '2d',
      versionOrder: [],
      currentVersionId: null,
    });
    tx.objectStore('scenes').put({
      id: 'legacy-split-scene',
      projectId: 'legacy-split-project',
      name: 'Scene 1',
      position: 0,
      sceneJson: {
        schemaVersion: 1,
        id: 'legacy-split-scene',
        canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
        renderer: { preferred: 'p5' },
        layers: [{ id: 'legacy-layer', name: 'Layer 1', order: 0, visible: true, locked: false }],
        shapes: [],
        groups: [],
        bindings: [],
        graph: { nodes: [], connections: [] },
        accessibility: { reducedMotion: 'auto' },
        randomness: { seed: 0, enabled: false },
      },
      updatedAt: '2026-10-06T00:00:00.000Z',
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
}

async function expectOwnerKey(page: import('@playwright/test').Page, id: string): Promise<void> {
  const ownerId = await page.evaluate(async (projectId) => {
    const request = indexedDB.open('creatrart-local-projects');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('projects', 'readonly');
    const project = await new Promise<{ ownerId: string }>((resolve, reject) => {
      const read = tx.objectStore('projects').get(projectId);
      read.onsuccess = () => resolve(read.result as { ownerId: string });
      read.onerror = () => reject(read.error);
    });
    db.close();
    return project.ownerId;
  }, id);
  expect(ownerId).toBe('e2e_split');
}

test.describe('local-first owner key mismatch (#1282)', () => {
  for (const viewport of VIEWPORTS) {
    test(`creates, lists, reopens and recovers local pieces at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.split.email, fixtures.password);
      await page.goto('/studio');
      await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();

      await seedLegacyHandleProject(page);
      await page.goto('/local-projects/legacy-split-project');
      await expect(
        page.getByRole('heading', { name: 'Legacy handle-keyed project' }),
      ).toBeVisible();
      await expect(page.getByLabel('Scene', { exact: true })).toHaveValue('legacy-split-scene');
      await expectOwnerKey(page, 'legacy-split-project');
      await page.goto('/studio');
      await expect(
        page.getByRole('heading', { name: 'Legacy handle-keyed project' }),
      ).toBeVisible();

      const forbiddenServerWrites: string[] = [];
      page.on('request', (request) => {
        if (request.method() !== 'GET' && new URL(request.url()).pathname.startsWith('/api/')) {
          forbiddenServerWrites.push(new URL(request.url()).pathname);
        }
      });

      await page.goto('/create');
      await page.getByRole('button', { name: 'Create a new 2D project', exact: true }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);
      await expect(page.getByRole('heading', { name: 'Untitled animation' })).toBeVisible();
      const twoDId = new URL(page.url()).pathname.split('/').at(-1)!;
      await expectOwnerKey(page, twoDId);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Untitled animation' })).toBeVisible();
      await page.goto('/studio');
      await expect(page.getByRole('heading', { name: 'Untitled animation' })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`studio-after-2d-${viewport.width}.png`),
        fullPage: true,
      });

      await page.goto('/create');
      await page.getByRole('button', { name: 'Create a new 3D project', exact: true }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);
      await expect(page.getByRole('heading', { name: 'Untitled 3D scene' })).toBeVisible();
      const threeDId = new URL(page.url()).pathname.split('/').at(-1)!;
      await expectOwnerKey(page, threeDId);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Untitled 3D scene' })).toBeVisible();
      await page.goto('/studio');
      await expect(page.getByRole('heading', { name: 'Untitled 3D scene' })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`studio-after-3d-${viewport.width}.png`),
        fullPage: true,
      });

      await page.goto('/create');
      await page
        .getByRole('button', { name: 'Create a local generated piece', exact: true })
        .click();
      await page.waitForURL(/\/local-generated\/[^/]+$/);
      await expect(page.getByRole('heading', { name: 'Local generated SVG' })).toBeVisible();
      const generatedId = new URL(page.url()).pathname.split('/').at(-1)!;
      await expectOwnerKey(page, generatedId);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Local generated SVG' })).toBeVisible();
      await page.goto('/studio');
      await expect(page.getByRole('heading', { name: 'Local generated SVG' })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`studio-after-generated-${viewport.width}.png`),
        fullPage: true,
      });

      await expect(
        page.getByRole('heading', { name: 'Legacy handle-keyed project' }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Untitled animation' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Untitled 3D scene' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Local generated SVG' })).toBeVisible();
      expect(forbiddenServerWrites).toEqual([]);
    });
  }
});

import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

type LocalSnapshot = {
  project: { id: string; title: string; kind: string };
  scenes: Array<{ position: number; sceneJson: unknown }>;
  media: Array<{ filename: string; checksum: string; byteSize: number }>;
};

async function readLocalSnapshot(page: import('@playwright/test').Page, projectId: string) {
  return page.evaluate(async (id): Promise<LocalSnapshot> => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('creatrart-local-projects');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const read = <T>(store: string, key?: IDBValidKey) =>
      new Promise<T>((resolve, reject) => {
        const request = db.transaction(store, 'readonly').objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      });
    const all = <T>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const request = db.transaction(store, 'readonly').objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });
    const project = await read<LocalSnapshot['project']>('projects', id);
    const scenes = (
      await all<{ projectId: string; position: number; sceneJson: unknown }>('scenes')
    )
      .filter((scene) => scene.projectId === id)
      .sort((left, right) => left.position - right.position)
      .map(({ position, sceneJson }) => ({ position, sceneJson }));
    const media = (
      await all<{ projectId: string; filename: string; checksum: string; byteSize: number }>(
        'mediaAssets',
      )
    )
      .filter((asset) => asset.projectId === id)
      .map(({ filename, checksum, byteSize }) => ({ filename, checksum, byteSize }));
    db.close();
    return { project, scenes, media };
  }, projectId);
}

test.describe('Per-piece local package import (#936)', () => {
  const fixtures = requireE2EFixtures();

  test('exports in one browser context and imports into a fresh context with equivalent content', async ({
    browser,
  }, testInfo) => {
    const sourceContext = await browser.newContext();
    const sourcePage = await sourceContext.newPage();
    await loginViaUI(sourcePage, fixtures.owner.email, fixtures.password);
    await sourcePage.goto('/create');
    await sourcePage.getByRole('button', { name: 'Create a new 2D project', exact: true }).click();
    await sourcePage.waitForURL(/\/local-projects\/[^/]+$/);
    const sourceId = new URL(sourcePage.url()).pathname.split('/').at(-1)!;
    const sourceSnapshot = await readLocalSnapshot(sourcePage, sourceId);

    await sourcePage.getByRole('button', { name: 'Prepare piece package' }).click();
    await expect(sourcePage.getByRole('region', { name: 'Piece package export' })).toBeVisible();
    const downloadPromise = sourcePage.waitForEvent('download');
    await sourcePage.getByRole('button', { name: 'Download piece package' }).click();
    const download = await downloadPromise;
    const packagePath = testInfo.outputPath('portable-piece.zip');
    await download.saveAs(packagePath);
    expect((await readFile(packagePath)).byteLength).toBeGreaterThan(0);
    await sourceContext.close();

    const importContext = await browser.newContext();
    const importPage = await importContext.newPage();
    await loginViaUI(importPage, fixtures.owner.email, fixtures.password);
    await importPage.getByRole('button', { name: 'More creation options' }).click();
    await expect(importPage.getByRole('menu', { name: 'Create a new project' })).toBeVisible();
    const chooser = importPage.waitForEvent('filechooser');
    await importPage.getByRole('menuitem', { name: 'Import a piece package' }).click();
    await (await chooser).setFiles(packagePath);
    await importPage.waitForURL(/\/local-projects\/[^/]+$/);
    const importedId = new URL(importPage.url()).pathname.split('/').at(-1)!;
    const importedSnapshot = await readLocalSnapshot(importPage, importedId);

    expect(importedSnapshot.project.id).not.toBe(sourceSnapshot.project.id);
    expect(importedSnapshot.project.title).toBe(sourceSnapshot.project.title);
    expect(importedSnapshot.project.kind).toBe('2d');
    expect(importedSnapshot.scenes).toEqual(sourceSnapshot.scenes);
    expect(importedSnapshot.media).toEqual(sourceSnapshot.media);
    await importContext.close();
  });
});

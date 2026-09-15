import { expect, test, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

async function seedLocalProject(page: import('@playwright/test').Page, ownerId: string) {
  return page.evaluate(async (owner) => {
    const repository = (await new Function(
      'return import("/src/storage/localProjectRepository.ts")',
    )()) as {
      openLocalProjectDatabase(): Promise<IDBDatabase>;
      createProject(
        db: IDBDatabase,
        input: { ownerId: string; title: string },
      ): Promise<{ id: string }>;
      createScene(
        db: IDBDatabase,
        ownerId: string,
        input: { projectId: string; name: string; sceneJson: Record<string, unknown> },
      ): Promise<unknown>;
    };
    const db = await repository.openLocalProjectDatabase();
    const project = await repository.createProject(db, {
      ownerId: owner,
      title: 'Durable Save Project',
    });
    await repository.createScene(db, owner, {
      projectId: project.id,
      name: 'Original scene',
      sceneJson: { schema_version: 1, objects: [{ id: 'shape-1', type: 'circle' }] },
    });
    db.close();
    return project.id;
  }, ownerId);
}

async function writeGrantedFolderCheckpoint(
  page: import('@playwright/test').Page,
  projectId: string,
  ownerId: string,
) {
  return page.evaluate(
    async ({ projectId, ownerId }) => {
      const repository = (await new Function(
        'return import("/src/storage/localProjectRepository.ts")',
      )()) as { openLocalProjectDatabase(): Promise<IDBDatabase> };
      const archiveModule = (await new Function(
        'return import("/src/storage/localDatabaseArchive.ts")',
      )()) as {
        exportDatabaseArchive(
          db: IDBDatabase,
          ownerId: string,
          options: { projectIds: string[] },
        ): Promise<{ blob: Blob }>;
      };
      const bridge = (await new Function(
        'return import("/src/storage/folderArchiveBridge.ts")',
      )()) as {
        writeArchiveFile(handle: unknown, filename: string, blob: Blob): Promise<void>;
        readArchiveFile(handle: unknown, filename: string): Promise<Uint8Array>;
      };
      const db = await repository.openLocalProjectDatabase();
      const result = await archiveModule.exportDatabaseArchive(db, ownerId, {
        projectIds: [projectId],
      });
      db.close();
      let stored = new Blob(['old-checkpoint'], { type: 'application/zip' });
      const file = {
        kind: 'file' as const,
        name: 'Durable_Save_Project.zip',
        async getFile() {
          return new File([stored], 'Durable_Save_Project.zip', { type: 'application/zip' });
        },
        async createWritable() {
          return {
            async write(next: Blob) {
              stored = next;
            },
            async close() {},
          };
        },
      };
      const handle = {
        kind: 'directory' as const,
        async queryPermission() {
          return 'granted' as const;
        },
        async requestPermission() {
          return 'granted' as const;
        },
        async getFileHandle() {
          return file;
        },
        async *entries() {
          yield ['Durable_Save_Project.zip', file] as const;
        },
      };
      await bridge.writeArchiveFile(handle, 'Durable_Save_Project.zip', result.blob);
      const bytes = Array.from(await bridge.readArchiveFile(handle, 'Durable_Save_Project.zip'));
      return bytes;
    },
    { projectId, ownerId },
  );
}

test.describe('Local workspace durable save and reopen (#536)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`saves, reloads, exports, and reopens a validated checkpoint at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const projectId = await seedLocalProject(page, fixtures.owner.username);

      await page.goto(`/local-projects/${projectId}`);
      await expect(page.getByRole('heading', { name: 'Durable Save Project' })).toBeVisible();
      await page.getByLabel('Scene name').fill('Edited scene');
      await expect(page.getByRole('region', { name: 'Unsaved local changes' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Recover draft' })).toBeDisabled();
      await page.getByRole('button', { name: 'Save now' }).click();
      await expect(page.getByText('Saved local scene changes to this browser.')).toBeVisible();

      await page.reload();
      await expect(page.getByLabel('Scene name')).toHaveValue('Edited scene');
      await expect(page.getByText('A browser-local recovery draft is available.')).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Save durable checkpoint' }).click();
      const download = await downloadPromise;
      const archivePath = await download.path();
      expect(archivePath).not.toBeNull();

      await page.goto('/account/settings/storage');
      await page.locator('#restore-archive-input').setInputFiles(archivePath!);
      await expect(page.getByRole('heading', { name: 'Archive preview' })).toBeVisible();
      await expect(page.getByText(/1 project\(s\), 1 scene\(s\)/)).toBeVisible();
      await page.getByLabel('New workspace name').fill('Reopened checkpoint');
      await page.getByRole('button', { name: 'Restore selected projects' }).click();
      await expect(page.getByText(/Restored 1 project/)).toBeVisible();
      await page.getByRole('link', { name: 'Durable Save Project' }).last().click();
      await expect(page.getByLabel('Scene name')).toHaveValue('Edited scene');
      await page.screenshot({ path: testInfo.outputPath('local-workspace-reopened.png') });
    });

    test(`writes and reopens a granted-folder checkpoint at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const projectId = await seedLocalProject(page, fixtures.owner.username);
      await page.goto(`/local-projects/${projectId}`);
      await expect(page.getByRole('heading', { name: 'Durable Save Project' })).toBeVisible();
      await page.getByLabel('Scene name').fill('Folder checkpoint scene');
      await page.getByRole('button', { name: 'Save local changes' }).click();
      await expect(page.getByText('Saved local scene changes to this browser.')).toBeVisible();

      const archiveBytes = await writeGrantedFolderCheckpoint(
        page,
        projectId,
        fixtures.owner.username,
      );
      expect(archiveBytes.length).toBeGreaterThan(100);
      await page.goto('/account/settings/storage');
      await page.locator('#restore-archive-input').setInputFiles({
        name: 'Durable_Save_Project.zip',
        mimeType: 'application/zip',
        buffer: Buffer.from(archiveBytes),
      });
      await expect(page.getByRole('heading', { name: 'Archive preview' })).toBeVisible();
      await page.getByLabel('New workspace name').fill('Granted folder reopen');
      await page.getByRole('button', { name: 'Restore selected projects' }).click();
      await expect(page.getByText(/Restored 1 project/)).toBeVisible();
      await page.getByRole('link', { name: 'Durable Save Project' }).last().click();
      await expect(page.getByLabel('Scene name')).toHaveValue('Folder checkpoint scene');
    });
  }
});

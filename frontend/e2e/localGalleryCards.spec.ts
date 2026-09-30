import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Local project gallery cards (#1087)', () => {
  const fixtures = requireE2EFixtures();

  test('renders local metadata, thumbnails/fallbacks, and responsive cards', async ({
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const ids = await page.evaluate(async (owner) => {
      const repository = (await new Function(
        'return import("/src/storage/localProjectRepository.ts")',
      )()) as {
        openLocalProjectDatabase(): Promise<IDBDatabase>;
        createProject(
          db: IDBDatabase,
          input: { ownerId: string; title: string; description?: string; kind?: '2d' | '3d' },
        ): Promise<{ id: string }>;
        createScene(
          db: IDBDatabase,
          ownerId: string,
          input: { projectId: string; name: string; sceneJson: Record<string, unknown> },
        ): Promise<unknown>;
        updateProject(
          db: IDBDatabase,
          ownerId: string,
          projectId: string,
          patch: { thumbnail: Blob; thumbnailUpdatedAt: string },
        ): Promise<unknown>;
      };
      const db = await repository.openLocalProjectDatabase();
      const withThumbnail = await repository.createProject(db, {
        ownerId: owner,
        title: 'Local card with preview',
        description: 'A stored local description.',
      });
      await repository.createScene(db, owner, {
        projectId: withThumbnail.id,
        name: 'Scene',
        sceneJson: { schema_version: 1, objects: [] },
      });
      await repository.updateProject(db, owner, withThumbnail.id, {
        thumbnail: new Blob(
          [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><rect width="320" height="240" fill="#8b5cf6"/></svg>',
          ],
          { type: 'image/svg+xml' },
        ),
        thumbnailUpdatedAt: new Date().toISOString(),
      });
      const withoutThumbnail = await repository.createProject(db, {
        ownerId: owner,
        title: 'Local card without preview',
        description: '',
        kind: '3d',
      });
      db.close();
      return { withThumbnail: withThumbnail.id, withoutThumbnail: withoutThumbnail.id };
    }, fixtures.owner.username);

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/gallery');
      await expect(page.getByRole('heading', { name: 'Local card with preview' })).toBeVisible();
      await expect(page.getByText('A stored local description.')).toBeVisible();
      await expect(page.getByText('No preview available')).toBeVisible();
      await expect(page.getByText('Last updated')).toHaveCount(2);
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`local-gallery-cards-${viewport.width}.png`),
        fullPage: true,
      });
    }

    await page.getByLabel('Renderer').selectOption('3d');
    await expect(page.getByRole('heading', { name: 'Local card without preview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Local card with preview' })).not.toBeVisible();
    void ids;
  });
});

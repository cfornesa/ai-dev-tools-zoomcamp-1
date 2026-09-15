import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];
const PROJECT_ID = '3c1f43b0-6d75-4f51-9a88-53bbd0f0a545';

async function seedLocalProject(page: Page, ownerId: string): Promise<void> {
  await page.evaluate(
    async ({ ownerId, projectId }) => {
      const repository = (await new Function(
        'return import("/src/storage/localProjectRepository.ts")',
      )()) as {
        openLocalProjectDatabase(): Promise<IDBDatabase>;
        ensureProject(
          db: IDBDatabase,
          input: { id: string; ownerId: string; title: string },
        ): Promise<unknown>;
        createScene(
          db: IDBDatabase,
          ownerId: string,
          input: { projectId: string; name: string; sceneJson: Record<string, unknown> },
        ): Promise<unknown>;
      };
      const db = await repository.openLocalProjectDatabase();
      await repository.ensureProject(db, {
        id: projectId,
        ownerId,
        title: 'Ownership Recovery Fixture',
      });
      await repository.createScene(db, ownerId, {
        projectId,
        name: 'Initial scene',
        sceneJson: { shapes: [] },
      });
      db.close();
    },
    { ownerId, projectId: PROJECT_ID },
  );
}

test.describe('Offline mutation ownership recovery (#545)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`does not replay the owner queue after account switch at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await seedLocalProject(page, fixtures.owner.username);

      let requests = 0;
      await page.route(`**/api/projects/${PROJECT_ID}/sync/mutations/`, async (route) => {
        requests += 1;
        await route.abort('failed');
      });
      await page.goto(`/local-projects/${PROJECT_ID}`);
      await expect(page.getByRole('heading', { name: 'Ownership Recovery Fixture' })).toBeVisible();
      await page.getByLabel('Scene name').fill('Private offline edit');
      await page.getByRole('button', { name: 'Save local changes' }).click();
      await expect(page.getByText('Saved local scene changes to this browser.')).toBeVisible();
      expect(
        await page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('creatrart-local-projects', 3);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const rows = await new Promise<Array<{ projectId: string; sessionGeneration?: string }>>(
            (resolve, reject) => {
              const request = db
                .transaction('mutationOutbox', 'readonly')
                .objectStore('mutationOutbox')
                .getAll();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            },
          );
          db.close();
          return rows.find((row) => row.projectId === '3c1f43b0-6d75-4f51-9a88-53bbd0f0a545')
            ?.sessionGeneration;
        }),
      ).toMatch(/.+/);

      const mobileMenu = page.getByRole('button', { name: 'Open menu' });
      if (await mobileMenu.isVisible()) await mobileMenu.click();
      await page.getByRole('button', { name: 'Logout' }).click();
      await loginViaUI(page, fixtures.other.email, fixtures.password);
      await page.goto(`/local-projects/${PROJECT_ID}`);
      await expect(page.getByRole('heading', { name: 'Local project unavailable' })).toBeVisible();
      expect(requests).toBe(0);
    });

    test(`pauses expired authentication and offers explicit discard at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await seedLocalProject(page, fixtures.owner.username);
      await page.route(`**/api/projects/${PROJECT_ID}/sync/mutations/`, async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'authentication-required' }),
        });
      });
      await page.goto(`/local-projects/${PROJECT_ID}`);
      await page.getByLabel('Scene name').fill('Expired private edit');
      await page.getByRole('button', { name: 'Save local changes' }).click();
      await expect(page.getByText('Saved local scene changes to this browser.')).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Private sync paused' })).toBeVisible();
      await expect(page.getByText(/sign-in expired/i)).toBeVisible();
      await page.getByRole('button', { name: 'Discard queued mutation' }).click();
      await expect(
        page.getByText('Queued private mutation discarded; local artwork was preserved.'),
      ).toBeVisible();
    });

    test(`resumes the original owner's queue after authentication returns at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await seedLocalProject(page, fixtures.owner.username);
      let expired = true;
      await page.route(`**/api/projects/${PROJECT_ID}/sync/mutations/`, async (route) => {
        if (expired) {
          expired = false;
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'authentication-required' }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ acknowledged: true }),
        });
      });
      await page.goto(`/local-projects/${PROJECT_ID}`);
      await page.getByLabel('Scene name').fill('Re-authenticated private edit');
      await page.getByRole('button', { name: 'Save local changes' }).click();
      await expect(page.getByText('Saved local scene changes to this browser.')).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Private sync paused' })).toBeVisible();
      await page.getByRole('button', { name: 'Resume sync' }).click();
      await expect(
        page.getByText('Queued mutation resumed for authenticated replay.'),
      ).toBeVisible();
    });
  }
});

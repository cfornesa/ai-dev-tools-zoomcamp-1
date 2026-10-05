import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { localProjectDb } from './support/localProjectDb.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];
const PROJECT_ID = 'f7e1dc1d-e1df-40e1-ae66-0d7d9f57c994';

async function seedLocalProject(page: Page, ownerId: string): Promise<void> {
  await localProjectDb(page, {
    kind: 'seed',
    input: {
      ownerId,
      projectId: PROJECT_ID,
      title: 'Conflict Fixture',
      scene: { name: 'Initial scene', sceneJson: { objects: [{ id: 'shape-1', x: 10 }] } },
    },
  });
}

async function outboxKinds(page: Page): Promise<Array<{ state: string; type?: string }>> {
  const rows = await localProjectDb<
    Array<{
      state: string;
      projectId: string;
      clientSequence?: number;
      payload?: { type?: string };
    }>
  >(page, { kind: 'read-outbox', projectId: PROJECT_ID });
  return rows
    .sort((left, right) => (left.clientSequence ?? 0) - (right.clientSequence ?? 0))
    .map((row) => ({ state: row.state, type: row.payload?.type }));
}

test.describe('Offline conflict resolution (#544)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`pauses and explicitly resolves an overlapping edit at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await seedLocalProject(page, fixtures.owner.username);
      await page.route(`**/api/projects/${PROJECT_ID}/sync/mutations/`, async (route) => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'conflict',
            conflict: {
              conflicts: [
                {
                  path: 'objects[shape-1].x',
                  base: 10,
                  local: 20,
                  remote: 30,
                  affectedIdentities: ['shape-1'],
                  context: {
                    baseVersion: 'version-7',
                    localOperationIds: ['local-1'],
                    remoteOperationIds: ['remote-1'],
                  },
                },
              ],
              context: {
                baseVersion: 'version-7',
                localOperationIds: ['local-1'],
                remoteOperationIds: ['remote-1'],
              },
              localSnapshot: { objects: [{ id: 'shape-1', x: 20 }] },
              remoteSnapshot: { objects: [{ id: 'shape-1', x: 30 }] },
              mergedSnapshot: { objects: [{ id: 'shape-1', x: 25 }] },
            },
          }),
        });
      });

      await page.goto(`/local-projects/${PROJECT_ID}`);
      await page.getByLabel('Scene name').fill('Local conflicting edit');
      await page.getByRole('button', { name: 'Save local changes' }).click();
      await expect(page.getByText('Saved local scene changes to this browser.')).toBeVisible();
      await page.reload();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByText('objects[shape-1].x')).toBeVisible();
      await page.getByRole('button', { name: 'Keep local' }).click();
      await expect(
        page.getByText('Conflict resolution queued for deterministic replay.'),
      ).toBeVisible();
      await expect
        .poll(() => outboxKinds(page))
        .toEqual([
          { state: 'paused', type: undefined },
          { state: 'pending', type: 'conflict-resolution' },
        ]);
    });
  }
});

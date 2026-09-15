/**
 * Issue #543: durable outbox replay through a real Chromium page. The
 * mutation endpoint is made unavailable at the API boundary (the document
 * itself remains loadable so a reload is deterministic), then restored after
 * reload to model an offline editor reconnecting to the same test API.
 */
import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const PROJECT_ID = '7e4c9d1a-6f5e-4b1d-9f52-3c9d7a8e1b04';
const SCENE_ID = '9f8e7d6c-5b4a-3210-9abc-def012345678';

async function seedLocalProject(page: Page, ownerId: string): Promise<void> {
  await page.evaluate(
    ({ ownerId, projectId, sceneId }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('creatrart-local-projects', 3);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB fixture upgrade was blocked.'));
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('projects')) {
            const projects = db.createObjectStore('projects', { keyPath: 'id' });
            projects.createIndex('by_owner', 'ownerId');
          }
          if (!db.objectStoreNames.contains('scenes')) {
            const scenes = db.createObjectStore('scenes', { keyPath: 'id' });
            scenes.createIndex('by_project', 'projectId');
          }
          if (!db.objectStoreNames.contains('mediaAssets')) {
            const mediaAssets = db.createObjectStore('mediaAssets', { keyPath: 'id' });
            mediaAssets.createIndex('by_project', 'projectId');
          }
          if (!db.objectStoreNames.contains('mediaBlobs')) {
            db.createObjectStore('mediaBlobs', { keyPath: 'assetId' });
          }
          if (!db.objectStoreNames.contains('meta'))
            db.createObjectStore('meta', { keyPath: 'key' });
          if (!db.objectStoreNames.contains('recoveryDrafts')) {
            const drafts = db.createObjectStore('recoveryDrafts', { keyPath: 'id' });
            drafts.createIndex('by_project_saved_at', ['projectId', 'savedAt']);
          }
          if (!db.objectStoreNames.contains('mutationOutbox')) {
            const outbox = db.createObjectStore('mutationOutbox', { keyPath: 'operationId' });
            outbox.createIndex('by_owner_project', ['ownerId', 'projectId']);
            outbox.createIndex('by_owner_project_sequence', [
              'ownerId',
              'projectId',
              'clientSequence',
            ]);
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(
            [
              'projects',
              'scenes',
              'mediaAssets',
              'mediaBlobs',
              'meta',
              'recoveryDrafts',
              'mutationOutbox',
            ],
            'readwrite',
          );
          transaction.objectStore('projects').put({
            id: projectId,
            ownerId,
            title: 'Offline Sync Fixture',
            sceneOrder: [sceneId],
            activeSceneId: sceneId,
            createdAt: '2026-09-15T19:30:00.000Z',
            updatedAt: '2026-09-15T19:30:00.000Z',
          });
          transaction.objectStore('scenes').put({
            id: sceneId,
            projectId,
            name: 'Initial scene',
            position: 0,
            sceneJson: { shapes: [] },
            updatedAt: '2026-09-15T19:30:00.000Z',
          });
          transaction.objectStore('meta').put({ key: 'schemaVersion', value: 3 });
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    { ownerId, projectId: PROJECT_ID, sceneId: SCENE_ID },
  );
}

async function readOutboxStates(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ projectId }) =>
      new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open('creatrart-local-projects', 3);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db
            .transaction('mutationOutbox', 'readonly')
            .objectStore('mutationOutbox')
            .index('by_owner_project');
          const get = read.getAll();
          get.onsuccess = () => {
            db.close();
            resolve(
              (get.result as Array<{ projectId: string; state: string }>)
                .filter((row) => row.projectId === projectId)
                .map((row) => row.state),
            );
          };
          get.onerror = () => reject(get.error);
        };
      }),
    { projectId: PROJECT_ID },
  );
}

async function runOfflineReplay(page: Page, fixtures: Fixtures): Promise<void> {
  await loginViaUI(page, fixtures.owner.email, fixtures.password);
  await seedLocalProject(page, fixtures.owner.username);

  let apiAvailable = false;
  let mutationRequests = 0;
  await page.route(`**/api/projects/${PROJECT_ID}/sync/mutations/`, async (route) => {
    mutationRequests += 1;
    if (!apiAvailable) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        acknowledged: true,
        replayed: false,
        operation_id: '00000000-0000-0000-0000-000000000001',
        server_operation_id: '1',
        client_sequence: 1,
        payload_checksum: 'a'.repeat(64),
        acknowledged_at: '2026-09-15T19:30:00.000Z',
      }),
    });
  });

  await page.goto(`/local-projects/${PROJECT_ID}`);
  await expect(page.getByRole('heading', { name: 'Offline Sync Fixture' })).toBeVisible();
  await page.getByLabel('Scene name').fill('Edited while offline');
  await page.getByRole('button', { name: 'Save local changes' }).click();
  await expect(page.getByText('Saved local scene changes to this browser.')).toBeVisible();
  await expect.poll(() => readOutboxStates(page)).toEqual(['pending']);

  await page.reload();
  await expect(page.getByLabel('Scene name')).toHaveValue('Edited while offline');
  await expect.poll(() => readOutboxStates(page)).toEqual(['pending']);

  apiAvailable = true;
  // Failed delivery uses the deterministic one-second retry backoff. Wait
  // until that eligibility window opens before simulating reconnect.
  await page.waitForTimeout(1100);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => readOutboxStates(page), { timeout: 10000 }).toEqual(['acknowledged']);
  expect(mutationRequests).toBeGreaterThanOrEqual(2);
}

test.describe('Offline mutation replay', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('replays after API reconnect at desktop 1280x900', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await runOfflineReplay(page, fixtures);
  });

  test('replays after API reconnect at mobile 375x812', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await runOfflineReplay(page, fixtures);
  });
});

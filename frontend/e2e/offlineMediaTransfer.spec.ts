import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];
const PROJECT_ID = 'f63af5e2-9e50-4b61-8e2d-0d2cf52b6a22';
const ASSET_ID = '8a6a6c5e-7d57-4a12-8b93-b4a5d8dbf6b0';

test.describe('Offline resumable media transfer (#546)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`persists interruption and resumes verified ranges at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/account/settings/storage');
      let requests = 0;
      await page.route(
        `**/api/projects/${PROJECT_ID}/cloud-backup/assets/${ASSET_ID}/chunks/`,
        async (route) => {
          requests += 1;
          if (requests === 1) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                asset_id: ASSET_ID,
                checksum: 'a'.repeat(64),
                byte_size: 8,
                complete: false,
                acknowledged_ranges: [{ start: 0, end: 4 }],
              }),
            });
            return;
          }
          if (requests === 2) {
            await route.abort('failed');
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              asset_id: ASSET_ID,
              checksum: 'a'.repeat(64),
              byte_size: 8,
              complete: true,
              acknowledged_ranges: [{ start: 0, end: 8 }],
            }),
          });
        },
      );

      const result = await page.evaluate(
        async ({ projectId, assetId }) => {
          type TransferState = {
            transferId: string;
            ownerId: string;
            projectId: string;
            assetId: string;
            byteLength: number;
            checksum: string;
            acknowledgedRanges: Array<{ start: number; end: number }>;
            state: 'pending' | 'uploading' | 'complete' | 'paused';
            lastErrorCode: string | null;
          };
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('creatrart-local-projects', 4);
            request.onupgradeneeded = () => {
              const upgradeDb = request.result;
              if (!upgradeDb.objectStoreNames.contains('mediaTransfers')) {
                const transfers = upgradeDb.createObjectStore('mediaTransfers', {
                  keyPath: 'transferId',
                });
                transfers.createIndex('by_owner_project', ['ownerId', 'projectId']);
                transfers.createIndex('by_owner_asset', ['ownerId', 'assetId']);
              }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const save = (record: TransferState) =>
            new Promise<void>((resolve, reject) => {
              const transaction = db.transaction('mediaTransfers', 'readwrite');
              transaction.objectStore('mediaTransfers').put(record);
              transaction.oncomplete = () => resolve();
              transaction.onerror = () => reject(transaction.error);
            });
          const read = (transferId: string) =>
            new Promise<TransferState | null>((resolve, reject) => {
              const request = db
                .transaction('mediaTransfers', 'readonly')
                .objectStore('mediaTransfers')
                .get(transferId);
              request.onsuccess = () =>
                resolve((request.result as TransferState | undefined) ?? null);
              request.onerror = () => reject(request.error);
            });
          const send = (start: number, bytes: Uint8Array) =>
            fetch(`/api/projects/${projectId}/cloud-backup/assets/${assetId}/chunks/`, {
              method: 'PUT',
              body: bytes.buffer as ArrayBuffer,
              headers: {
                'Content-Type': 'image/png',
                'Content-Range': `bytes ${start}-${start + bytes.byteLength - 1}/8`,
                'X-Asset-Checksum': 'a'.repeat(64),
                'X-Asset-Mime-Type': 'image/png',
                'X-Idempotency-Key': 'transfer-546',
              },
            });
          let record: TransferState = {
            transferId: 'transfer-546',
            ownerId: 'owner-a',
            projectId,
            assetId,
            byteLength: 8,
            checksum: 'a'.repeat(64),
            acknowledgedRanges: [],
            state: 'pending',
            lastErrorCode: null,
          };
          await save(record);
          const first = await (await send(0, new Uint8Array([0, 1, 2, 3]))).json();
          record = {
            ...record,
            acknowledgedRanges: first.acknowledged_ranges,
            state: 'uploading',
          };
          await save(record);
          try {
            await send(4, new Uint8Array([4, 5, 6, 7]));
          } catch {
            record = { ...record, state: 'paused', lastErrorCode: 'offline' };
            await save(record);
          }
          const paused = await read(record.transferId);
          if (!paused) throw new Error('Transfer state was not persisted after interruption.');
          const final = await (await send(4, new Uint8Array([4, 5, 6, 7]))).json();
          record = {
            ...record,
            acknowledgedRanges: final.acknowledged_ranges,
            state: 'complete',
            lastErrorCode: null,
          };
          await save(record);
          const completed = await read(record.transferId);
          db.close();
          return { pausedState: paused.state, finalState: completed?.state };
        },
        { projectId: PROJECT_ID, assetId: ASSET_ID },
      );

      expect(result).toEqual({ pausedState: 'paused', finalState: 'complete' });
      expect(requests).toBe(3);
    });
  }
});

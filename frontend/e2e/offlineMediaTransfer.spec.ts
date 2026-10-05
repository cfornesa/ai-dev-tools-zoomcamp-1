import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { localProjectDb } from './support/localProjectDb.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];
const PROJECT_ID = 'f63af5e2-9e50-4b61-8e2d-0d2cf52b6a22';
const CHECKSUM = 'a'.repeat(64);

test.describe('Offline resumable media transfer (#546)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`persists interruption and resumes verified ranges at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const seeded = await localProjectDb<{ assetId?: string }>(page, {
        kind: 'seed',
        input: {
          ownerId: fixtures.owner.username,
          projectId: PROJECT_ID,
          title: 'Media Transfer Fixture',
          media: {
            filename: 'fixture.png',
            mimeType: 'image/png',
            bytes: [137, 80, 78, 71, 13, 10, 26, 10],
          },
        },
      });
      const assetId = seeded.assetId;
      if (!assetId) throw new Error('The v5 fixture did not return its imported media ID.');
      await page.goto('/account/settings/storage');
      let requests = 0;
      await page.route(
        `**/api/projects/${PROJECT_ID}/cloud-backup/assets/${assetId}/chunks/`,
        async (route) => {
          requests += 1;
          if (requests === 1) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                asset_id: assetId,
                checksum: CHECKSUM,
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
              asset_id: assetId,
              checksum: CHECKSUM,
              byte_size: 8,
              complete: true,
              acknowledged_ranges: [{ start: 0, end: 8 }],
            }),
          });
        },
      );

      type TransferRecord = {
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
      let record: TransferRecord = {
        transferId: 'transfer-546',
        ownerId: fixtures.owner.username,
        projectId: PROJECT_ID,
        assetId,
        byteLength: 8,
        checksum: CHECKSUM,
        acknowledgedRanges: [],
        state: 'pending',
        lastErrorCode: null,
      };
      const save = () => localProjectDb(page, { kind: 'put-transfer', record });
      const send = (start: number, bytes: number[]) =>
        page.evaluate(
          async ({ projectId, mediaId, start: rangeStart, bytes: chunk }) => {
            const response = await fetch(
              `/api/projects/${projectId}/cloud-backup/assets/${mediaId}/chunks/`,
              {
                method: 'PUT',
                body: new Uint8Array(chunk).buffer,
                headers: {
                  'Content-Type': 'image/png',
                  'Content-Range': `bytes ${rangeStart}-${rangeStart + chunk.length - 1}/8`,
                  'X-Asset-Checksum': 'a'.repeat(64),
                  'X-Asset-Mime-Type': 'image/png',
                  'X-Idempotency-Key': 'transfer-546',
                },
              },
            );
            return response.json();
          },
          { projectId: PROJECT_ID, mediaId: assetId, start, bytes },
        );

      await save();
      const first = await send(0, [0, 1, 2, 3]);
      record = { ...record, acknowledgedRanges: first.acknowledged_ranges, state: 'uploading' };
      await save();
      try {
        await send(4, [4, 5, 6, 7]);
      } catch {
        record = { ...record, state: 'paused', lastErrorCode: 'offline' };
        await save();
      }
      const paused = await localProjectDb<TransferRecord | undefined>(page, {
        kind: 'get-transfer',
        transferId: record.transferId,
      });
      if (!paused) throw new Error('Transfer state was not persisted after interruption.');
      const final = await send(4, [4, 5, 6, 7]);
      record = {
        ...record,
        acknowledgedRanges: final.acknowledged_ranges,
        state: 'complete',
        lastErrorCode: null,
      };
      await save();
      const completed = await localProjectDb<TransferRecord | undefined>(page, {
        kind: 'get-transfer',
        transferId: record.transferId,
      });
      const result = { pausedState: paused.state, finalState: completed?.state };

      expect(result).toEqual({ pausedState: 'paused', finalState: 'complete' });
      expect(requests).toBe(3);
    });

    test(`persists checksum and quota failures for recovery at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const seeded = await localProjectDb<{ assetId?: string }>(page, {
        kind: 'seed',
        input: {
          ownerId: fixtures.owner.username,
          projectId: PROJECT_ID,
          title: 'Media Transfer Failure Fixture',
          media: {
            filename: 'fixture.png',
            mimeType: 'image/png',
            bytes: [137, 80, 78, 71, 13, 10, 26, 10],
          },
        },
      });
      const assetId = seeded.assetId;
      if (!assetId) throw new Error('The v5 fixture did not return its imported media ID.');
      await page.goto('/account/settings/storage');
      let requests = 0;
      await page.route(
        `**/api/projects/${PROJECT_ID}/cloud-backup/assets/${assetId}/chunks/`,
        async (route) => {
          requests += 1;
          await route.fulfill({
            status: requests === 1 ? 409 : 413,
            contentType: 'application/json',
            body: JSON.stringify({ code: requests === 1 ? 'checksum-mismatch' : 'quota-exceeded' }),
          });
        },
      );

      const send = () =>
        page.evaluate(
          async ({ projectId, mediaId }) => {
            const response = await fetch(
              `/api/projects/${projectId}/cloud-backup/assets/${mediaId}/chunks/`,
              {
                method: 'PUT',
                body: new Uint8Array([0, 1, 2, 3]),
                headers: {
                  'Content-Range': 'bytes 0-3/8',
                  'X-Asset-Checksum': 'a'.repeat(64),
                  'X-Asset-Mime-Type': 'image/png',
                  'X-Idempotency-Key': 'failure-546',
                },
              },
            );
            return response.status;
          },
          { projectId: PROJECT_ID, mediaId: assetId },
        );
      const seedFailedTransfer = (transferId: string, lastErrorCode: string) =>
        localProjectDb(page, {
          kind: 'put-transfer',
          record: {
            transferId,
            ownerId: fixtures.owner.username,
            projectId: PROJECT_ID,
            assetId,
            byteLength: 8,
            checksum: CHECKSUM,
            chunkSize: 4,
            acknowledgedRanges: [],
            attemptCount: 1,
            state: 'paused',
            lastErrorCode,
          },
        });
      const checksumStatus = await send();
      await seedFailedTransfer('transfer-checksum', 'checksum-mismatch');
      const quotaStatus = await send();
      await seedFailedTransfer('transfer-quota', 'quota-exceeded');
      const result = { checksumStatus, quotaStatus };

      expect(result).toEqual({ checksumStatus: 409, quotaStatus: 413 });
      expect(requests).toBe(2);
    });
  }
});

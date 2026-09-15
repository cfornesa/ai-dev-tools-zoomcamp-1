import { expect, test, type Page } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { apiDelete, apiGet, apiPatch, apiPost } from './support/api.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

type ChunkResult = {
  status: number;
  body: Record<string, unknown> | null;
};

async function sha256(page: Page, bytes: number[]): Promise<string> {
  return page.evaluate(async (input: number[]) => {
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(input));
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  }, bytes);
}

test.describe('Live authenticated resumable media transfer (#546)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`persists and resumes real server ranges at ${viewport.width}x${viewport.height}`, async ({
      browser,
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/account/settings/storage');

      // The disposable E2E database keeps the cloud-sync kill switch closed
      // by default. Enable it through the existing admin contract for this
      // live transfer transaction, then restore the exact prior value.
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await loginViaUI(adminPage, fixtures.admin.email, fixtures.password);
      const settingsBefore = (await (
        await apiGet(adminContext, '/api/admin/settings/')
      ).json()) as {
        site_title: string;
        cloud_sync_enabled: boolean;
        revision: number;
      };
      const enableSync = await apiPatch(adminContext, '/api/admin/settings/', {
        site_title: settingsBefore.site_title,
        cloud_sync_enabled: true,
        revision: settingsBefore.revision,
      });
      expect(enableSync.status()).toBe(200);

      const projectResponse = await apiPost(page.context(), '/api/projects/blank/');
      expect(projectResponse.status()).toBe(201);
      const project = (await projectResponse.json()) as { id: string };
      const projectId = project.id;
      try {
        const enableResponse = await apiPost(
          page.context(),
          `/api/projects/${projectId}/cloud-backup/`,
          {
            action: 'enable',
          },
        );
        expect(enableResponse.status()).toBe(201);

        const bytes = [0, 1, 2, 3, 4, 5, 6, 7];
        const checksum = await sha256(page, bytes);
        const assetId = await page.evaluate(() => crypto.randomUUID());
        const putChunk = (start: number, input: number[], expectedChecksum = checksum) =>
          page.evaluate(
            async ({
              projectId: id,
              assetId: asset,
              start: offset,
              input: data,
              checksum: digest,
            }) => {
              const response = await fetch(
                `/api/projects/${id}/cloud-backup/assets/${asset}/chunks/`,
                {
                  method: 'PUT',
                  body: new Uint8Array(data),
                  headers: {
                    'Content-Type': 'image/png',
                    'Content-Range': `bytes ${offset}-${offset + data.length - 1}/8`,
                    'X-CSRFToken':
                      document.cookie
                        .split('; ')
                        .find((cookie) => cookie.startsWith('csrftoken='))
                        ?.split('=')[1] ?? '',
                    'X-Asset-Checksum': digest,
                    'X-Asset-Mime-Type': 'image/png',
                    'X-Idempotency-Key': `live-546-${asset}`,
                  },
                },
              );
              let body: Record<string, unknown> | null = null;
              try {
                body = (await response.json()) as Record<string, unknown>;
              } catch {
                // A failed request may not have a JSON response body.
              }
              return { status: response.status, body };
            },
            { projectId, assetId, start, input, checksum: expectedChecksum },
          );

        const first = (await putChunk(0, bytes.slice(0, 4))) as ChunkResult;
        expect(first).toMatchObject({
          status: 200,
          body: { complete: false, acknowledged_ranges: [{ start: 0, end: 4 }] },
        });

        await page.route(
          `**/api/projects/${projectId}/cloud-backup/assets/${assetId}/chunks/`,
          (route) => route.abort('failed'),
        );
        await expect
          .poll(async () => {
            try {
              return (await putChunk(4, bytes.slice(4))).status;
            } catch {
              return 0;
            }
          })
          .toBe(0);
        await page.unroute(`**/api/projects/${projectId}/cloud-backup/assets/${assetId}/chunks/`);

        const resumed = (await putChunk(4, bytes.slice(4))) as ChunkResult;
        expect(resumed).toMatchObject({
          status: 200,
          body: { complete: true, acknowledged_ranges: [{ start: 0, end: 8 }] },
        });

        const downloaded = await page.evaluate(
          async ({ projectId: id, assetId: asset }) => {
            const response = await fetch(`/api/projects/${id}/cloud-backup/assets/${asset}/`);
            return {
              status: response.status,
              checksum: response.headers.get('X-Asset-Checksum'),
              bytes: [...new Uint8Array(await response.arrayBuffer())],
            };
          },
          { projectId, assetId },
        );
        expect(downloaded).toEqual({ status: 200, checksum, bytes });

        const checksumFailure = (await putChunk(
          0,
          bytes.slice(0, 4),
          '0'.repeat(64),
        )) as ChunkResult;
        expect(checksumFailure).toMatchObject({
          status: 409,
          body: { error: 'checksum_mismatch' },
        });

        const quotaAssetId = await page.evaluate(() => crypto.randomUUID());
        const quotaFailure = await page.evaluate(
          async ({ projectId: id, assetId: asset }) => {
            const response = await fetch(
              `/api/projects/${id}/cloud-backup/assets/${asset}/chunks/`,
              {
                method: 'PUT',
                body: new Uint8Array([0]),
                headers: {
                  'Content-Range': 'bytes 0-0/1000000000',
                  'X-CSRFToken':
                    document.cookie
                      .split('; ')
                      .find((cookie) => cookie.startsWith('csrftoken='))
                      ?.split('=')[1] ?? '',
                  'X-Asset-Checksum': 'a'.repeat(64),
                  'X-Asset-Mime-Type': 'image/png',
                  'X-Idempotency-Key': `live-546-quota-${asset}`,
                },
              },
            );
            return { status: response.status, body: await response.json() };
          },
          { projectId, assetId: quotaAssetId },
        );
        expect(quotaFailure).toMatchObject({
          status: 413,
          body: { error: 'cloud_backup_quota_exceeded' },
        });
      } finally {
        expect((await apiDelete(page.context(), `/api/projects/${projectId}/`)).status()).toBe(204);
        const settingsAfter = (await (
          await apiGet(adminContext, '/api/admin/settings/')
        ).json()) as {
          revision: number;
        };
        expect(
          (
            await apiPatch(adminContext, '/api/admin/settings/', {
              site_title: settingsBefore.site_title,
              cloud_sync_enabled: settingsBefore.cloud_sync_enabled,
              revision: settingsAfter.revision,
            })
          ).status(),
        ).toBe(200);
        await adminContext.close();
      }
    });
  }
});

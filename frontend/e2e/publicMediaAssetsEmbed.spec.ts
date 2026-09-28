import { expect, test } from '@playwright/test';

import {
  cleanupPublicMediaFixture,
  createPublicMediaFixture,
  type PublicMediaFixture,
} from './support/publicMediaFixture.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('real public media embed viewer (#973)', () => {
  requireE2EFixtures();
  let fixture: PublicMediaFixture;

  test.beforeAll(() => {
    fixture = createPublicMediaFixture();
    if (!fixture.available || !fixture.public_id || !fixture.asset_id) {
      throw new Error(`Public media fixture unavailable: ${fixture.reason ?? 'unknown reason'}`);
    }
  });

  test.afterAll(() => {
    cleanupPublicMediaFixture();
  });

  for (const viewport of VIEWPORTS) {
    test(`renders server media at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      const assetUrl = `/api/pieces/2d/${fixture.public_id}/assets/${fixture.asset_id}/`;
      const assetResponsePromise = page.waitForResponse(
        (response) => response.url().includes(assetUrl) && response.request().method() === 'GET',
      );
      await page.goto(`/embed/p/${fixture.public_id}`);
      await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();
      await expect(page.locator('canvas')).toBeVisible();
      const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
      await expect(toolbar.getByRole('button', { name: 'Open piece controls menu' })).toBeVisible();
      const assetResponse = await assetResponsePromise;
      expect(assetResponse.status()).toBe(200);
      expect(assetResponse.headers()).toMatchObject({
        'content-type': expect.stringContaining('image/png'),
        'x-content-type-options': 'nosniff',
        'cache-control': 'public, immutable',
        'access-control-allow-origin': '*',
        'x-asset-checksum': expect.stringMatching(/^[0-9a-f]{64}$/),
      });
      await expect
        .poll(() =>
          page.locator('canvas').evaluate((element) => {
            const canvas = element as HTMLCanvasElement;
            const context = canvas.getContext('2d');
            if (!context) return false;
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            return Array.from({ length: pixels.length / 4 }, (_, index) => index * 4).some(
              (index) => pixels[index] > 180 && pixels[index + 1] < 160 && pixels[index + 2] < 140,
            );
          }),
        )
        .toBe(true);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`embed-${viewport.width}.png`),
        fullPage: true,
      });

      const foreignResponse = await page.request.get(
        `/api/pieces/2d/${fixture.public_id}/assets/00000000-0000-0000-0000-000000000000/`,
      );
      expect(foreignResponse.status()).toBe(404);
      const privateResponse = await page.request.get(
        `/api/pieces/2d/00000000-0000-0000-0000-000000000000/assets/${fixture.asset_id}/`,
      );
      expect(privateResponse.status()).toBe(404);
    });
  }
});

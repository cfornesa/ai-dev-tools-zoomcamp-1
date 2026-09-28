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

test.describe('real public media canonical immersive viewer (#974)', () => {
  requireE2EFixtures();
  let fixture: PublicMediaFixture;

  test.beforeAll(() => {
    fixture = createPublicMediaFixture();
    if (!fixture.available || !fixture.public_id || !fixture.asset_id || !fixture.slug) {
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
      await page.goto(`/users/@e2e_owner/immersive/${fixture.slug}`);
      await expect(page.getByRole('heading', { name: 'Public media fixture' })).toBeVisible();
      await expect(page.locator('canvas')).toBeVisible();
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
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`immersive-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});

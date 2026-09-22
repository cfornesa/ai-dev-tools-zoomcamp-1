import { expect, test } from '@playwright/test';

async function stubProfile(page: import('@playwright/test').Page) {
  await page.route('**/api/users/@alignment/', async (route) =>
    route.fulfill({
      json: {
        profile: {
          handle: 'alignment',
          display_name: 'Alignment study',
          bio: '',
          website_url: '',
          social_links: {},
          profile_image_url: '',
          is_public: true,
          revision: 1,
          theme_config: {},
        },
        collections: [],
        pieces: [
          {
            id: 'alignment-piece',
            slug: 'alignment-piece',
            title: 'Alignment piece',
            type: '2d',
            engine: 'canvas2d',
            description: '',
            published_at: '2026-09-20T12:00:00Z',
            regular_url: '/users/@alignment/pieces/alignment-piece',
            thumbnail_url: null,
          },
        ],
      },
    }),
  );
}

test.describe('public profile alignment (#714)', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`aligns the empty profile header and piece grid at ${viewport.width}px`, async ({
      page,
    }, testInfo) => {
      await stubProfile(page);
      await page.setViewportSize(viewport);
      await page.goto('/users/@alignment');
      await expect(page.getByRole('heading', { name: 'Alignment study' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Pieces' })).toBeVisible();

      const boxes = await Promise.all(
        [
          page.locator('.public-profile-heading'),
          page.locator('.public-profile-section > h3'),
          page.locator('.public-profile-card-grid'),
        ].map((locator) => locator.boundingBox()),
      );
      expect(boxes.every(Boolean)).toBe(true);
      expect(Math.abs(boxes[0]!.x - boxes[1]!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(boxes[1]!.x - boxes[2]!.x)).toBeLessThanOrEqual(1);
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`profile-alignment-${viewport.width}.png`),
        fullPage: true,
      });
    });
  }
});

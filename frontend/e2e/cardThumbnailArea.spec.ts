import { expect, test } from '@playwright/test';

test.describe('piece card thumbnail area (#715)', () => {
  test('keeps preview tiles at 16:9 and cards aligned at desktop and mobile widths', async ({
    page,
  }, testInfo) => {
    await page.route('**/api/users/@artist/', async (route) =>
      route.fulfill({
        json: {
          profile: {
            handle: 'artist',
            display_name: 'The Artist',
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
              id: 'with-preview',
              slug: 'with-preview',
              title: 'With preview',
              type: '2d',
              engine: 'canvas2d',
              description: '',
              published_at: '2026-09-21T12:00:00Z',
              regular_url: '/users/@artist/pieces/with-preview',
              thumbnail_url: '/preview.svg',
            },
            {
              id: 'without-preview',
              slug: 'without-preview',
              title: 'Without preview',
              type: '3d',
              engine: 'threejs',
              description: '',
              published_at: '2026-09-21T12:00:00Z',
              regular_url: '/users/@artist/pieces/without-preview',
              thumbnail_url: null,
            },
          ],
        },
      }),
    );
    await page.route('**/preview.svg', async (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#8b5cf6"/></svg>',
      }),
    );

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/users/@artist');
      const thumbnails = page.locator('.piece-card-thumbnail, .piece-card-thumbnail-fallback');
      await expect(thumbnails).toHaveCount(2);
      await expect(page.getByText('No preview yet')).toBeVisible();

      const metrics = await thumbnails.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }),
      );
      for (const metric of metrics) {
        expect(metric.height / metric.width).toBeCloseTo(9 / 16, 2);
      }

      const cardHeights = await page
        .locator('.piece-card')
        .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
      if (viewport.width >= 600) {
        expect(Math.max(...cardHeights) - Math.min(...cardHeights)).toBeLessThanOrEqual(1);
      }
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`card-thumbnail-area-${viewport.width}.png`),
        fullPage: true,
      });
    }
  });
});

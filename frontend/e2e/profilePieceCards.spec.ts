import { expect, test } from '@playwright/test';

async function stubProfile(page: import('@playwright/test').Page) {
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
          theme_config: {
            background: '#f4efe6',
            surface: '#fffaf0',
            text: '#1f2937',
            muted: '#6b7280',
            accent: '#dc2626',
          },
        },
        collections: [],
        pieces: [
          {
            id: 'piece-2d',
            slug: 'structured-study',
            title: 'Structured study',
            type: '2d',
            engine: 'canvas2d',
            description: 'A concise description for the structured study.',
            published_at: '2026-09-20T12:00:00Z',
            regular_url: '/users/@artist/pieces/structured-study',
            thumbnail_url: '/2d/thumbnail.png',
          },
          {
            id: 'piece-3d',
            slug: 'orbit-study',
            title: 'Orbit study',
            type: '3d',
            engine: 'threejs',
            description: '',
            published_at: '2026-09-19T12:00:00Z',
            regular_url: '/users/@artist/pieces/orbit-study',
            thumbnail_url: null,
          },
          {
            id: 'piece-generated',
            slug: 'long-form-study',
            title: 'Long-form generated study',
            type: 'generated',
            engine: 'p5js',
            description: `${'A long editorial description with enough words to exceed the card limit. '.repeat(8)}`,
            published_at: '2026-09-18T12:00:00Z',
            regular_url: '/users/@artist/pieces/long-form-study',
            thumbnail_url: '/generated/thumbnail.png',
            thumbnail_is_fallback: true,
          },
        ],
      },
    }),
  );
  await page.route('**/thumbnail.png', async (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#dc2626"/></svg>',
    }),
  );
}

test.describe('public profile piece cards (#685)', () => {
  for (const style of ['none', 'offset']) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`renders the editorial card contract in ${style} style (${colorScheme})`, async ({
        page,
      }, testInfo) => {
        await page.emulateMedia({ colorScheme });
        await stubProfile(page);
        await page.goto('/users/@artist');
        await expect(page.getByRole('heading', { name: 'Pieces' })).toBeVisible();
        await page.locator('html').evaluate((element, shadow) => {
          element.setAttribute('data-site-shadow', shadow as string);
        }, style);
        const cards = page.locator('article.piece-card[data-testid^="profile-piece-"]');
        await expect(cards).toHaveCount(3);
        await expect(page.getByText('Sep 20, 2026')).toBeVisible();
        await expect(page.getByText('Sep 19, 2026')).toBeVisible();
        await expect(page.locator('.renderer-badge', { hasText: 'Generated' })).toBeVisible();
        await expect(page.getByText('p5js')).toBeVisible();
        await expect(page.getByText('No preview available')).toBeVisible();
        await expect(
          page.locator('[data-testid="profile-piece-piece-3d"] .piece-card-excerpt'),
        ).toHaveCount(0);
        await expect(page.locator('.piece-card-excerpt').first()).toHaveText(/description/);
        await expect(page.locator('.piece-card-excerpt').nth(1)).toHaveText(/…$/);
        await expect(cards.first()).toHaveCSS('box-shadow', style === 'offset' ? /4px/ : 'none');

        for (const viewport of [
          { width: 1280, height: 900, columns: 3 },
          { width: 375, height: 812, columns: 1 },
        ]) {
          await page.setViewportSize(viewport);
          await expect
            .poll(() =>
              page
                .locator('.public-profile-card-grid')
                .evaluate(
                  (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
                ),
            )
            .toBe(viewport.columns);
          await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width);
          await page.screenshot({
            path: testInfo.outputPath(
              `profile-piece-cards-${style}-${colorScheme}-${viewport.width}.png`,
            ),
            fullPage: true,
          });
        }
      });
    }
  }
});

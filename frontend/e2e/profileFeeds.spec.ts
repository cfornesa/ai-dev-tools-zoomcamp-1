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
            id: 'piece-1',
            slug: 'first-piece',
            title: 'First piece',
            description: 'The first piece description.',
            type: 'generated',
            engine: 'p5js',
            regular_url: '/users/@artist/pieces/first-piece',
            thumbnail_url: '/thumbnail.png',
          },
          {
            id: 'piece-2',
            slug: 'second-piece',
            title: 'Second piece',
            description: 'The second piece description.',
            type: '2d',
            engine: 'canvas2d',
            regular_url: '/users/@artist/pieces/second-piece',
            thumbnail_url: '/thumbnail.png',
          },
          {
            id: 'piece-3',
            slug: 'third-piece',
            title: 'Third piece',
            description: 'The third piece description.',
            type: '3d',
            engine: 'threejs',
            regular_url: '/users/@artist/pieces/third-piece',
            thumbnail_url: '/thumbnail.png',
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

test.describe('profile feeds discovery (#689)', () => {
  test('renders subscribe links, copy confirmation, and five-entry preview at desktop and mobile', async ({
    page,
  }, testInfo) => {
    await stubProfile(page);
    await page.goto('/users/@artist/feeds');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: new URL(page.url()).origin,
    });
    await expect(page.getByRole('heading', { name: 'Subscribe to The Artist' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy' })).toHaveCount(3);
    await expect(page.getByRole('link', { name: 'Open' })).toHaveCount(3);
    await expect(page.locator('.profile-feed-preview-card')).toHaveCount(3);

    await page.getByRole('button', { name: 'Copy' }).first().click();
    await expect(page.locator('.profile-feed-confirmation')).toContainText('Atom feed URL copied.');

    for (const viewport of [
      { width: 1280, height: 900, columns: 3 },
      { width: 375, height: 812, columns: 1 },
    ]) {
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page
            .locator('.profile-feed-preview-grid')
            .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
        )
        .toBe(viewport.columns);
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width);
      await page.screenshot({
        path: testInfo.outputPath(`profile-feeds-${viewport.width}.png`),
        fullPage: true,
      });
    }
  });

  test('profile page exposes server-rendered feed alternates and a Subscribe link', async ({
    page,
  }) => {
    await stubProfile(page);
    const response = await page.request.get('/users/@artist');
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html).toContain('rel="alternate" type="application/atom+xml"');
    expect(html).toContain('rel="alternate" type="application/rss+xml"');
    expect(html).toContain('rel="alternate" type="application/feed+json"');

    await page.goto('/users/@artist');
    await expect(page.getByRole('link', { name: 'Subscribe to feeds' })).toHaveAttribute(
      'href',
      '/users/@artist/feeds',
    );
  });
});

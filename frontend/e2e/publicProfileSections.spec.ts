import { expect, test, type Page } from '@playwright/test';

async function stubProfileSections(page: Page) {
  await page.route('**/thumbnail.png', async (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#dc2626"/></svg>',
    }),
  );
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
        collections: [
          {
            id: 'empty-collection',
            title: 'Empty collection',
            slug: 'empty-collection',
            viewer_url: '/users/@artist/collections/empty-collection',
            thumbnail_url: null,
            item_count: 0,
          },
          {
            id: 'populated-collection',
            title: 'Three public works',
            slug: 'three-public-works',
            viewer_url: '/users/@artist/collections/three-public-works',
            thumbnail_url: '/api/public/collections/populated/thumbnail.png',
            item_count: 3,
          },
        ],
        pieces: [
          {
            id: '2d',
            title: 'Structured 2D',
            type: '2d',
            engine: 'canvas2d',
            thumbnail_url: '/2d/thumbnail.png',
          },
          {
            id: '3d',
            title: 'Structured 3D',
            type: '3d',
            engine: 'threejs',
            thumbnail_url: '/3d/thumbnail.png',
          },
          {
            id: 'generated-2d',
            title: 'Generated 2D',
            type: 'generated',
            engine: 'canvas2d',
            thumbnail_url: '/generated-2d/thumbnail.png',
          },
          {
            id: 'generated-3d',
            title: 'Generated 3D',
            type: 'generated',
            engine: 'threejs',
            thumbnail_url: '/generated-3d/thumbnail.png',
          },
        ],
      },
    }),
  );
}

test.describe('public profile sections (#650)', () => {
  test('renders collections before pieces with shared cards and public counts on desktop', async ({
    page,
  }, testInfo) => {
    await stubProfileSections(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/users/@artist');

    await expect(page.getByRole('heading', { name: 'Collections' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pieces' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Empty collection' })).toBeVisible();
    await expect(page.getByText('3 public pieces')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Structured 2D' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Structured 3D' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Generated 2D' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Generated 3D' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Private piece' })).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator('.public-profile-card-grid')
          .first()
          .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
      )
      .toBe(3);
    await expect(page.locator('.piece-card-link')).toHaveCount(6);
    await page.screenshot({
      path: testInfo.outputPath('public-profile-sections-desktop.png'),
      fullPage: true,
    });
  });

  test('uses one card column without overflow on mobile', async ({ page }, testInfo) => {
    await stubProfileSections(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/users/@artist');

    await expect
      .poll(() =>
        page
          .locator('.public-profile-card-grid')
          .first()
          .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
      )
      .toBe(1);
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 375);
    await page.screenshot({
      path: testInfo.outputPath('public-profile-sections-mobile.png'),
      fullPage: true,
    });
  });
});

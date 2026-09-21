import { expect, test } from '@playwright/test';

const SOURCE = '<canvas width="320" height="180"></canvas>';

async function stubCanonicalPiece(page: import('@playwright/test').Page, engine: string) {
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
        pieces: [],
      },
    }),
  );
  await page.route('**/api/users/@artist/pieces/**', async (route) =>
    route.fulfill({
      json: {
        canonical_url: '/users/@artist/pieces/sample-piece',
        viewer_url: '/users/@artist/pieces/sample-piece',
        type: 'generated',
        piece: {
          public_id: 'piece-1',
          public_slug: 'sample-piece',
          title: `${engine} immersive piece`,
          description: 'A public immersive generated piece.',
          engine,
          status: 'published',
          created_at: '2026-09-20T00:00:00Z',
          updated_at: '2026-09-20T00:00:00Z',
          current_version: {
            id: 1,
            sequence: 1,
            source: SOURCE,
            thumbnail_url: '',
            thumbnail_is_fallback: false,
            created_at: '2026-09-20T00:00:00Z',
            capabilities: {
              screenshot: true,
              download: true,
              immersive: true,
              fullscreen: true,
              sound: engine === 'threejs',
              camera_view: engine === 'threejs',
              hand_steering: engine === 'threejs',
            },
          },
        },
      },
    }),
  );
}

test.describe('generated immersive toolset (#691)', () => {
  for (const engine of ['canvas2d', 'threejs', 'aframe']) {
    test(`renders labelled ${engine} immersive actions without a hamburger`, async ({
      page,
    }, testInfo) => {
      await stubCanonicalPiece(page, engine);
      await page.goto('/users/@artist/immersive/sample-piece');

      await expect(page.getByRole('heading', { name: `${engine} immersive piece` })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
      await expect(
        page.locator('.piece-stage-action-label', { hasText: 'Download ZIP' }),
      ).toBeVisible();
      await expect(page.locator('.piece-stage-action-label', { hasText: 'VR' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Back to regular viewer' })).toHaveAttribute(
        'href',
        '/users/@artist/pieces/sample-piece',
      );
      await expect(page.getByRole('button', { name: 'Camera controls' })).toHaveCount(
        engine === 'threejs' ? 1 : 0,
      );
      await expect(page.getByRole('button', { name: /^Hand tracking$/ })).toHaveCount(
        engine === 'threejs' ? 1 : 0,
      );
      await expect(page.getByRole('button', { name: 'Unmute sound' })).toHaveCount(
        engine === 'threejs' ? 1 : 0,
      );
      await expect(page.getByRole('button', { name: 'Open piece controls menu' })).toHaveCount(0);

      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 375);
      await page.screenshot({
        path: testInfo.outputPath(`immersive-art-piece-toolset-${engine}-375.png`),
        fullPage: true,
      });
    });
  }
});

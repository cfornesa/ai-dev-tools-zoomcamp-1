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
          title: `${engine} piece`,
          description: 'A public generated piece.',
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

test.describe('generated art-piece public toolset (#690)', () => {
  for (const engine of ['canvas2d', 'threejs', 'aframe']) {
    test(`renders labelled ${engine} actions without a hamburger`, async ({ page }, testInfo) => {
      await stubCanonicalPiece(page, engine);
      await page.goto('/users/@artist/pieces/sample-piece');

      await expect(page.getByRole('heading', { name: `${engine} piece` })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open download menu' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Piece controls' })).toHaveCount(
        engine === 'threejs' ? 1 : 0,
      );
      // Steer lives inside the Piece controls popover; the guide is its own button (#766).
      await expect(page.getByRole('button', { name: /^Hand tracking$/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Show hand gesture guide' })).toHaveCount(
        engine === 'threejs' ? 1 : 0,
      );
      await expect(page.getByRole('button', { name: 'Unmute sound' })).toHaveCount(
        engine === 'threejs' ? 1 : 0,
      );
      await expect(page.getByRole('button', { name: 'Open piece controls menu' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Embed' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'View immersive piece' })).toBeVisible();
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 1280);

      await page.getByRole('button', { name: 'Embed' }).click();
      await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: new URL(page.url()).origin,
      });
      await page.getByRole('button', { name: 'Copy' }).click();
      await expect(page.getByText('Copied!')).toBeVisible();

      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 375);
      await page.screenshot({
        path: testInfo.outputPath(`public-art-piece-toolset-${engine}-375.png`),
        fullPage: true,
      });
    });
  }
});

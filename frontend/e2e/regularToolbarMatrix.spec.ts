import { expect, test } from '@playwright/test';

/**
 * Issue #766: the regular-view stage shows exactly the button set the parity matrix
 * (docs/piece-toolbar-parity-matrix.md) lists for each capability state, in order
 * (Screenshot, Download, Immersive, Sound, Piece controls, Hand gesture guide,
 * engine tools, Fullscreen last). The API is stubbed so every capability combination
 * is deterministic.
 */
const CASES: Array<{
  name: string;
  engine: string;
  capabilities: Record<string, boolean>;
  expected: string[];
}> = [
  {
    name: 'minimal flat piece',
    engine: 'c2js',
    capabilities: { screenshot: true, download: true, fullscreen: true },
    expected: ['Take screenshot', 'Open download menu', 'Expand piece to fullscreen'],
  },
  {
    name: 'full three.js piece',
    engine: 'threejs',
    capabilities: {
      screenshot: true,
      download: true,
      immersive: true,
      fullscreen: true,
      sound: true,
      camera_view: true,
      hand_steering: true,
    },
    expected: [
      'Take screenshot',
      'Open download menu',
      'View immersive piece',
      'Unmute sound',
      'Piece controls',
      'Hand gesture guide',
      'Expand piece to fullscreen',
    ],
  },
  {
    name: 'sound only',
    engine: 'aframe',
    capabilities: { screenshot: true, download: true, fullscreen: true, sound: true },
    expected: [
      'Take screenshot',
      'Open download menu',
      'Unmute sound',
      'Piece controls',
      'Expand piece to fullscreen',
    ],
  },
  {
    name: 'hand steering only',
    engine: 'threejs',
    capabilities: { screenshot: true, download: true, fullscreen: true, hand_steering: true },
    expected: [
      'Take screenshot',
      'Open download menu',
      'Piece controls',
      'Hand gesture guide',
      'Expand piece to fullscreen',
    ],
  },
  {
    name: 'screenshot and fullscreen explicitly off',
    engine: 'svg',
    capabilities: { screenshot: false, download: true, fullscreen: false },
    expected: ['Open download menu'],
  },
];

async function stubPiece(
  page: import('@playwright/test').Page,
  engine: string,
  capabilities: Record<string, boolean>,
) {
  await page.route('**/api/users/@artist/', (route) =>
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
  await page.route('**/api/users/@artist/pieces/**', (route) =>
    route.fulfill({
      json: {
        canonical_url: '/users/@artist/pieces/sample-piece',
        viewer_url: '/users/@artist/pieces/sample-piece',
        type: 'generated',
        piece: {
          public_id: 'piece-1',
          public_slug: 'sample-piece',
          title: 'Matrix piece',
          description: 'Regular toolbar matrix fixture.',
          engine,
          status: 'published',
          created_at: '2026-09-24T00:00:00Z',
          updated_at: '2026-09-24T00:00:00Z',
          current_version: {
            id: 1,
            sequence: 1,
            source: '<canvas width="320" height="180"></canvas>',
            thumbnail_url: '',
            thumbnail_is_fallback: false,
            created_at: '2026-09-24T00:00:00Z',
            capabilities,
          },
        },
      },
    }),
  );
}

test.describe('regular generated-piece toolbar matrix (#766)', () => {
  for (const testCase of CASES) {
    test(`${testCase.name}: exact set and order`, async ({ page }, testInfo) => {
      await stubPiece(page, testCase.engine, testCase.capabilities);
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto('/users/@artist/pieces/sample-piece');
        await expect(page.getByRole('heading', { name: 'Matrix piece' })).toBeVisible();
        const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
        await expect(toolbar).toBeVisible();
        const labels = await toolbar.locator('.piece-stage-toolbar-group').evaluate((group) =>
          Array.from(group.querySelectorAll(':scope > button, :scope > a, :scope > div > button'))
            .filter((node) => !node.closest('[data-piece-stage-download-menu]'))
            .map((node) => node.getAttribute('aria-label') ?? ''),
        );
        expect(labels).toEqual(testCase.expected);
        await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width);
        if (testCase.name === 'full three.js piece') {
          await page.screenshot({
            path: testInfo.outputPath(`regular-matrix-full-${viewport.width}.png`),
          });
        }
      }
    });
  }
});

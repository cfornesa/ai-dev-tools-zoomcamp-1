import { expect, test } from '@playwright/test';

/**
 * Issue #768: the regular view of a structured 2D piece (canonical
 * `/users/@handle/pieces/:slug`) shows the icon row from docs/piece-toolbar-parity-matrix.md
 * for every renderer: Screenshot, Download, Piece controls, Fullscreen last. Structured 2D
 * has no immersive surface, no Sound, and no Steer, so those buttons must be absent.
 */
function scene(renderer: 'p5' | 'canvas2d' | 'svg') {
  return {
    schemaVersion: 1,
    id: `scene-768-${renderer}`,
    canvas: { width: 800, height: 600, backgroundColor: '#101828' },
    renderer: { preferred: renderer },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'shape-1',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 400, y: 300, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: '#ef4444', stroke: null, strokeWidth: 0 },
        radius: 120,
      },
    ],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
  };
}

test.describe('structured 2D regular view toolbar (#768)', () => {
  for (const renderer of ['canvas2d', 'svg', 'p5'] as const) {
    test(`${renderer}: exact icon row`, async ({ page }, testInfo) => {
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
            canonical_url: '/users/@artist/pieces/red-circle',
            viewer_url: '/users/@artist/pieces/red-circle',
            type: '2d',
            piece: {
              id: `p2d-768-${renderer}`,
              owner: 'artist',
              title: `Red circle ${renderer}`,
              description: 'A structured 2D fixture.',
              tags: [],
              allow_public_remix: false,
              thumbnail_url: null,
              remix_provenance: null,
              current_version: {
                sequence: 1,
                scene_json: scene(renderer),
                created_at: '2026-09-24T00:00:00Z',
              },
              created_at: '2026-09-24T00:00:00Z',
              updated_at: '2026-09-24T00:00:00Z',
            },
          },
        }),
      );

      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto('/users/@artist/pieces/red-circle');
        await expect(page.getByRole('heading', { name: `Red circle ${renderer}` })).toBeVisible();
        const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
        await expect(toolbar).toBeVisible();
        const labels = await toolbar.locator('.piece-stage-toolbar-group').evaluate((group) =>
          Array.from(group.querySelectorAll('button, a'))
            .filter(
              (node) =>
                !node.closest('[data-piece-stage-download-menu]') &&
                !node.closest('.piece-stage-controls-panel'),
            )
            .map((node) => node.getAttribute('aria-label') ?? ''),
        );
        expect(labels).toEqual([
          'Take screenshot',
          'Open download menu',
          'Piece controls',
          'Expand piece to fullscreen',
        ]);
        await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width);
        await page.screenshot({
          path: testInfo.outputPath(`regular-2d-${renderer}-${viewport.width}.png`),
        });
      }
    });
  }
});

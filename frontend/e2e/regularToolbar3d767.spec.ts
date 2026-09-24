import { expect, test } from '@playwright/test';

/**
 * Issue #767: the regular view of a structured 3D piece (canonical
 * `/users/@handle/pieces/:slug`) shows the icon row from docs/piece-toolbar-parity-matrix.md
 * in order (Screenshot, Download, Immersive, Sound, Piece controls, Hand gesture guide,
 * Fullscreen last) and Steer lives inside the Piece controls popover.
 */
const SCENE = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'scene3d-767',
  scene: { backgroundColor: '#111111' },
  camera: {
    position: { x: 0, y: 2, z: 6 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,
    near: 0.1,
    far: 1000,
  },
  lights: [{ id: 'sun', type: 'ambient', color: '#ffffff', intensity: 1 }],
  groups: [],
  objects: [
    {
      id: 'sphere',
      type: 'sphere',
      groupId: null,
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        opacity: 1,
      },
      material: { color: '#ff0000' },
      visible: true,
      radius: 1,
    },
  ],
  randomness: { seed: 1, enabled: false },
};

test.describe('structured 3D regular view toolbar (#767)', () => {
  test('exact icon row and Steer inside Piece controls', async ({ page }, testInfo) => {
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
          canonical_url: '/users/@artist/pieces/red-sphere',
          viewer_url: '/users/@artist/pieces/red-sphere',
          type: '3d',
          piece: {
            id: 'p3d-767',
            owner: 'artist',
            title: 'Red sphere',
            description: 'A structured 3D fixture.',
            thumbnail_url: null,
            versions: [],
            version_count: 1,
            created_at: '2026-09-24T00:00:00Z',
            updated_at: '2026-09-24T00:00:00Z',
            current_version: {
              id: 1,
              sequence: 1,
              origin: 'manual',
              created_by: 'artist',
              created_at: '2026-09-24T00:00:00Z',
              scene_json: SCENE,
            },
          },
        },
      }),
    );

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/users/@artist/pieces/red-sphere');
      const frame = page.getByTestId('scene3d-preview-canvas-frame');
      await expect(frame).toBeVisible();
      const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
      await expect(toolbar).toBeVisible();
      const labels = await toolbar.locator('.scene3d-preview-actions').evaluate((group) =>
        Array.from(group.querySelectorAll('button, a'))
          .filter(
            (node) =>
              !node.closest('[data-piece-stage-download-menu]') &&
              !node.closest('.piece-stage-controls-panel') &&
              !node.closest('[role="dialog"]'),
          )
          .map((node) => node.getAttribute('aria-label') ?? ''),
      );
      expect(labels[0]).toBe('Take screenshot');
      expect(labels[1]).toBe('Open download menu');
      expect(labels[labels.length - 1]).toBe('Expand piece to fullscreen');
      expect(labels).not.toContain('Steer the piece');
      expect(labels).not.toContain('Hand tracking');
      const order = ['Piece controls', 'Show hand gesture guide'].map((name) =>
        labels.findIndex((label) => label === name),
      );
      expect(order.every((index) => index > 1)).toBe(true);
      expect(order[0]).toBeLessThan(order[1]!);

      await toolbar.getByRole('button', { name: 'Piece controls', exact: true }).click();
      await expect(
        toolbar.getByRole('group', { name: 'Piece controls' }).getByRole('button', {
          name: 'Steer the piece',
        }),
      ).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`regular-3d-${viewport.width}.png`) });
    }
  });
});

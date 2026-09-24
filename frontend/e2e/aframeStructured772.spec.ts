import { expect, test } from '@playwright/test';

/**
 * Issue #772: a structured 3D piece whose scene declares `renderer.preferred: 'aframe'` renders
 * through A-Frame on the regular and immersive routes (sandboxed iframe), with the stage toolbar,
 * and never falls back to the Three.js canvas.
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
  renderer: { preferred: 'aframe' },
  randomness: { seed: 1, enabled: false },
};

test.describe('structured 3D A-Frame renderer (#772)', () => {
  test('regular and immersive routes render the scene through A-Frame', async ({
    page,
  }, testInfo) => {
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
            id: 'p3d-772',
            owner: 'artist',
            title: 'Red sphere aframe',
            description: 'A structured 3D A-Frame fixture.',
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

    for (const route of ['pieces', 'immersive'] as const) {
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto(`/users/@artist/${route}/red-sphere`);
        const frame = page.getByTestId('scene3d-preview-canvas-frame');
        await expect(frame).toBeVisible();
        // A-Frame, not Three.js: an iframe, and no Three.js preview canvas in the parent.
        await expect(page.getByTestId('scene3d-preview')).toHaveAttribute(
          'data-renderer',
          'aframe',
        );
        await expect(page.getByTestId('scene3d-preview-canvas')).toHaveCount(0);
        const aframe = page.frameLocator('iframe[title="A-Frame scene preview"]');
        await expect(aframe.locator('canvas.a-canvas')).toBeVisible({ timeout: 30_000 });
        await expect(aframe.locator('a-sphere#sphere')).toHaveCount(1);
        await page.waitForTimeout(2500);
        // The sphere is drawn: sample the centre of the A-Frame canvas for the red material.
        const png = (await aframe.locator('canvas.a-canvas').screenshot()).toString('base64');
        const centre = await page.evaluate(async (base64) => {
          const image = new Image();
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('bad png'));
            image.src = `data:image/png;base64,${base64}`;
          });
          const scratch = document.createElement('canvas');
          scratch.width = image.width;
          scratch.height = image.height;
          const ctx = scratch.getContext('2d')!;
          ctx.drawImage(image, 0, 0);
          return Array.from(ctx.getImageData(image.width / 2, image.height / 2, 1, 1).data);
        }, png);
        await page.screenshot({
          path: testInfo.outputPath(`aframe-${route}-${viewport.width}.png`),
        });
        // Red dominates at the centre (lit sphere), regardless of shading.
        expect(centre[0]).toBeGreaterThan(centre[1] + 40);
        expect(centre[0]).toBeGreaterThan(centre[2] + 40);
        await expect(
          page.getByRole('toolbar', { name: 'Preview actions' }).getByRole('button', {
            name: 'Take screenshot',
          }),
        ).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`aframe-${route}-${viewport.width}.png`),
        });
      }
    }
  });
});

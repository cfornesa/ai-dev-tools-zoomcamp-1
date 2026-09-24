import { expect, test } from '@playwright/test';

/**
 * Issues #779 (Three.js), #780 (A-Frame), #785 (public viewer), #786 (immersive): a structured 3D scene
 * containing a `drawingPlane` shows its vector drawing on the plane. The API is stubbed so the same scene
 * is rendered by both engines and on both routes; the drawing is a large green rectangle on a transparent
 * background, so the centre pixel of the rendered canvas proves the drawing (not just a plain plane) is
 * on screen, and the pixels outside the rectangle prove transparency.
 */
function sceneFor(engine: 'threejs' | 'aframe') {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: `scene3d-drawing-${engine}`,
    scene: { backgroundColor: '#0b1020' },
    renderer: { preferred: engine },
    camera: {
      position: { x: 0, y: 0, z: 6 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    lights: [{ id: 'amb', type: 'ambient', color: '#ffffff', intensity: 1 }],
    groups: [],
    objects: [
      {
        id: 'drawing',
        type: 'drawingPlane',
        groupId: null,
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        material: { color: '#ffffff' },
        visible: true,
        width: 4,
        height: 3,
        drawing: {
          width: 512,
          height: 384,
          background: null,
          shapes: [
            {
              id: 'green',
              type: 'rect',
              x: 128,
              y: 96,
              width: 256,
              height: 192,
              fill: '#22c55e',
              stroke: null,
              strokeWidth: 0,
            },
          ],
        },
      },
    ],
    randomness: { seed: 1, enabled: false },
  };
}

async function stub(page: import('@playwright/test').Page, engine: 'threejs' | 'aframe') {
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
        canonical_url: '/users/@artist/pieces/drawing',
        viewer_url: '/users/@artist/pieces/drawing',
        type: '3d',
        piece: {
          id: `p3d-drawing-${engine}`,
          owner: 'artist',
          title: `Drawing plane ${engine}`,
          description: 'A drawing plane fixture.',
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
            scene_json: sceneFor(engine),
          },
        },
      },
    }),
  );
}

async function readPixels(
  page: import('@playwright/test').Page,
  canvasLocator: import('@playwright/test').Locator,
) {
  const png = (await canvasLocator.screenshot()).toString('base64');
  return page.evaluate(async (base64) => {
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
    const at = (fx: number, fy: number) =>
      Array.from(
        ctx.getImageData(Math.floor(image.width * fx), Math.floor(image.height * fy), 1, 1).data,
      ).slice(0, 3);
    return { centre: at(0.5, 0.5), corner: at(0.03, 0.03), edge: at(0.5, 0.06) };
  }, png);
}

const ENGINES = (process.env.DRAWING_PLANE_ENGINES ?? 'threejs').split(',') as Array<
  'threejs' | 'aframe'
>;

test.describe('drawing plane renders in 3D scenes (#779, #780, #785, #786)', () => {
  for (const engine of ENGINES) {
    for (const route of ['pieces', 'immersive'] as const) {
      test(`${engine} on the ${route} route`, async ({ page }, testInfo) => {
        await stub(page, engine);
        for (const viewport of [
          { width: 1280, height: 900 },
          { width: 375, height: 812 },
        ]) {
          await page.setViewportSize(viewport);
          await page.goto(`/users/@artist/${route}/drawing`);
          const frame = page.getByTestId('scene3d-preview-canvas-frame');
          await expect(frame).toBeVisible();
          const canvas =
            engine === 'threejs'
              ? page.getByTestId('scene3d-preview-canvas')
              : page
                  .frameLocator('iframe[title="A-Frame scene preview"]')
                  .locator('canvas.a-canvas');
          await expect(canvas).toBeVisible({ timeout: 30_000 });
          await page.waitForTimeout(2500);
          const pixels = await readPixels(page, canvas);
          // Centre is inside the green rectangle: green dominates.
          expect(pixels.centre[1]).toBeGreaterThan(pixels.centre[0] + 50);
          expect(pixels.centre[1]).toBeGreaterThan(pixels.centre[2] + 50);
          // Outside the drawn rectangle the plane is transparent, so the dark scene background shows.
          expect(Math.max(...pixels.corner)).toBeLessThan(60);
          await page.screenshot({
            path: testInfo.outputPath(`drawing-${engine}-${route}-${viewport.width}.png`),
          });
        }
      });
    }
  }
});

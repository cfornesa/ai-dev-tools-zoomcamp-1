import { expect, test } from '@playwright/test';

/**
 * Issue #783: an object with a declarative `oscillate` animation moves on screen under both engines, and
 * holds its authored pose under prefers-reduced-motion. The API is stubbed so the same scene
 * is rendered by both engines and on both routes; the drawing is a large green rectangle on a transparent
 * background, so the centre pixel of the rendered canvas proves the drawing (not just a plain plane) is
 * on screen, and the pixels outside the rectangle prove transparency.
 */
function sceneFor(engine: 'threejs' | 'aframe') {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: `scene3d-anim-${engine}`,
    scene: { backgroundColor: '#0b1020' },
    renderer: { preferred: engine },
    camera: {
      position: { x: 0, y: 0, z: 8 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    lights: [{ id: 'amb', type: 'ambient', color: '#ffffff', intensity: 1 }],
    groups: [],
    objects: [
      {
        id: 'bob',
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
        radius: 0.6,
        animation: { kind: 'oscillate', axis: 'x', speed: 0.5, amplitude: 2 },
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

async function redCentroidX(
  page: import('@playwright/test').Page,
  canvasLocator: import('@playwright/test').Locator,
): Promise<number> {
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
    const data = ctx.getImageData(0, 0, image.width, image.height).data;
    let sum = 0;
    let count = 0;
    for (let y = 0; y < image.height; y += 2) {
      for (let x = 0; x < image.width; x += 2) {
        const i = (y * image.width + x) * 4;
        if (data[i]! > 120 && data[i + 1]! < 60 && data[i + 2]! < 60) {
          sum += x;
          count += 1;
        }
      }
    }
    return count === 0 ? -1 : sum / count;
  }, png);
}

const ENGINES = (process.env.DRAWING_PLANE_ENGINES ?? 'threejs').split(',') as Array<
  'threejs' | 'aframe'
>;

test.describe('object animation renders in 3D scenes (#783)', () => {
  for (const engine of ENGINES) {
    test(`${engine}: an oscillating sphere moves, and holds still under reduced motion`, async ({
      page,
    }) => {
      await stub(page, engine);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/users/@artist/pieces/drawing');
      const canvas =
        engine === 'threejs'
          ? page.getByTestId('scene3d-preview-canvas')
          : page.frameLocator('iframe[title="A-Frame scene preview"]').locator('canvas.a-canvas');
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2000);
      const samples: number[] = [];
      for (let i = 0; i < 4; i += 1) {
        samples.push(await redCentroidX(page, canvas));
        await page.waitForTimeout(500);
      }
      expect(samples.every((value) => value > 0)).toBe(true);
      // Amplitude 2 world units on a 1230px-wide canvas is hundreds of pixels of travel.
      expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(80);
    });

    test(`${engine}: prefers-reduced-motion keeps the authored pose`, async ({ browser }) => {
      const context = await browser.newContext({
        reducedMotion: 'reduce',
        viewport: { width: 1280, height: 900 },
      });
      const page = await context.newPage();
      await stub(page, engine);
      await page.goto('/users/@artist/pieces/drawing');
      const canvas =
        engine === 'threejs'
          ? page.getByTestId('scene3d-preview-canvas')
          : page.frameLocator('iframe[title="A-Frame scene preview"]').locator('canvas.a-canvas');
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2000);
      const samples: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        samples.push(await redCentroidX(page, canvas));
        await page.waitForTimeout(700);
      }
      expect(Math.max(...samples) - Math.min(...samples)).toBeLessThan(6);
      await context.close();
    });
  }
});

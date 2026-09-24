/**
 * Issues #785/#786: a published structured-3D piece with a transformed, two-colour drawing plane renders
 * on the regular (`/pieces/`) and immersive (`/immersive/`) routes in BOTH engines at 1280x900 and 375x812,
 * with transparency intact, the screenshot action including the plane, and immersive navigation working.
 * The API is stubbed so both engines render the identical scene.
 */
import fs from 'node:fs';

import { expect, test, type Locator, type Page } from '@playwright/test';

type Engine = 'threejs' | 'aframe';

function sceneFor(engine: Engine) {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: `scene3d-viewers-${engine}`,
    scene: { backgroundColor: '#0b1020' },
    renderer: { preferred: engine },
    camera: {
      position: { x: 0, y: 0, z: 7 },
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
          rotation: { x: 0, y: 25, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          opacity: 1,
        },
        material: { color: '#ffffff' },
        visible: true,
        width: 4.5,
        height: 3.4,
        drawing: {
          width: 1024,
          height: 768,
          background: null,
          shapes: [
            {
              id: 'red',
              type: 'rect',
              x: 64,
              y: 128,
              width: 384,
              height: 512,
              fill: '#ef4444',
              stroke: null,
            },
            {
              id: 'green',
              type: 'rect',
              x: 576,
              y: 128,
              width: 384,
              height: 512,
              fill: '#22c55e',
              stroke: null,
            },
          ],
        },
      },
    ],
    randomness: { seed: 1, enabled: false },
  };
}

async function stub(page: Page, engine: Engine) {
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
          id: `p3d-viewers-${engine}`,
          owner: 'artist',
          title: `Viewer ${engine}`,
          description: 'A drawing plane viewer fixture.',
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

function stageCanvas(page: Page, engine: Engine): Locator {
  return engine === 'threejs'
    ? page.getByTestId('scene3d-preview-canvas')
    : page.frameLocator('iframe[title="A-Frame scene preview"]').locator('canvas.a-canvas');
}

type Counts = { red: number; green: number; total: number; corner: number[] };

/** Classifies the pixels of a PNG (a Buffer) in the page: how many are red-ish / green-ish. */
async function classify(page: Page, png: Buffer): Promise<Counts> {
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
    let red = 0;
    let green = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (r > g + 60 && r > b + 60) red += 1;
      if (g > r + 50 && g > b + 50) green += 1;
    }
    return {
      red,
      green,
      total: image.width * image.height,
      corner: Array.from(ctx.getImageData(2, 2, 1, 1).data).slice(0, 3),
    };
  }, png.toString('base64'));
}

const ENGINES: Engine[] = ['threejs', 'aframe'];

test.describe('drawing plane in the public viewers (#785, #786)', () => {
  for (const engine of ENGINES) {
    test(`${engine}: regular view shows both colours, transparency, and a screenshot with the plane`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      await stub(page, engine);
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto('/users/@artist/pieces/drawing');
        const canvas = stageCanvas(page, engine);
        await expect(canvas).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(2500);
        const counts = await classify(page, await canvas.screenshot());
        // Both drawn colours are on screen and each covers a real area of the stage.
        expect(counts.red).toBeGreaterThan(counts.total * 0.02);
        expect(counts.green).toBeGreaterThan(counts.total * 0.02);
        // Transparent drawing background: the dark scene shows at the corner.
        expect(Math.max(...counts.corner)).toBeLessThan(60);
        await page.screenshot({
          path: testInfo.outputPath(`regular-${engine}-${viewport.width}.png`),
        });
      }

      // The screenshot action captures the plane.
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/users/@artist/pieces/drawing');
      await expect(stageCanvas(page, engine)).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2500);
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Take screenshot' }).click();
      const shot = fs.readFileSync((await (await download).path())!);
      const shotCounts = await classify(page, shot);
      expect(shotCounts.red).toBeGreaterThan(500);
      expect(shotCounts.green).toBeGreaterThan(500);
    });

    test(`${engine}: immersive view frames the plane face-on and stays navigable`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      await stub(page, engine);
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(viewport);
        await page.goto('/users/@artist/immersive/drawing');
        const canvas = stageCanvas(page, engine);
        await expect(canvas).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(2500);
        const counts = await classify(page, await canvas.screenshot());
        // Not blank and not edge-on: a substantial share of the stage is the plane's two colours.
        expect(counts.red + counts.green).toBeGreaterThan(counts.total * 0.06);
        await page.screenshot({
          path: testInfo.outputPath(`immersive-${engine}-${viewport.width}.png`),
        });
      }

      if (engine === 'threejs') {
        // Drag-orbit changes the view; arrow keys fly.
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto('/users/@artist/immersive/drawing');
        const canvas = stageCanvas(page, engine);
        await expect(canvas).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(2000);
        const before = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
        const box = (await canvas.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(400);
        const afterDrag = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
        expect(afterDrag).not.toBe(before);
        await page.keyboard.down('ArrowUp');
        await page.waitForTimeout(500);
        await page.keyboard.up('ArrowUp');
        await page.waitForTimeout(300);
        const afterFly = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
        expect(afterFly).not.toBe(afterDrag);
      } else {
        // A-Frame's look controls: a drag turns the view.
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto('/users/@artist/immersive/drawing');
        const canvas = stageCanvas(page, engine);
        await expect(canvas).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(2500);
        const before = await canvas.screenshot();
        const box = (await canvas.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(600);
        expect((await canvas.screenshot()).equals(before)).toBe(false);
      }
    });
  }
});

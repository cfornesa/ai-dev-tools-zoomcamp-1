/**
 * Issue #796: the drawing-plane selection chrome (#782) also works on the A-Frame stage. The sandboxed
 * stage reports its camera and clicks over the versioned bridge; the parent projects the plane, draws the
 * handles/toolbar, and a released drag reloads the stage once with the new pose.
 */
import { expect, test, type Page } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { createBlank3DProjectViaUI } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const SCENE = {
  schemaVersion: 1,
  documentType: 'scene3d',
  id: 'scene3d-aframe-chrome',
  scene: { backgroundColor: '#0b1020' },
  renderer: { preferred: 'aframe' },
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
      id: 'drawing-plane-1',
      name: 'Drawing plane 1',
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
        width: 1024,
        height: 768,
        background: null,
        shapes: [
          {
            id: 'g',
            type: 'rect',
            x: 0,
            y: 0,
            width: 1024,
            height: 768,
            fill: '#22c55e',
            stroke: null,
          },
        ],
      },
    },
  ],
  randomness: { seed: 0, enabled: false },
};

async function greenCentroidX(page: Page) {
  const png = await page
    .frameLocator('iframe[title="A-Frame scene preview"]')
    .locator('canvas.a-canvas')
    .screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise<void>((r, j) => {
      img.onload = () => r();
      img.onerror = () => j(new Error('png'));
      img.src = `data:image/png;base64,${b64}`;
    });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    let sx = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 1]! > d[i]! + 50 && d[i + 1]! > d[i + 2]! + 50) {
        n += 1;
        sx += (i / 4) % c.width;
      }
    }
    return n ? sx / n : -1;
  }, png.toString('base64'));
}

test.describe('drawing-plane selection chrome on the A-Frame stage (#796)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`select, drag, click-pick, dismiss at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(150_000);
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const id = await createBlank3DProjectViaUI(page);
      expect(
        (
          await apiPost(page.context(), `/api/projects3d/${id}/versions/`, {
            scene_json: SCENE,
            origin: 'manual',
          })
        ).status(),
      ).toBe(201);
      await page.reload();
      const frame = page.getByTestId('scene3d-preview-canvas-frame');
      await expect(page.locator('iframe[title="A-Frame scene preview"]')).toBeVisible({
        timeout: 45_000,
      });
      await page.waitForTimeout(3000);
      const overlay = page.getByTestId('plane-selection-overlay');
      await expect(overlay).toHaveCount(0);

      // Select through the outline: handles and the floating toolbar appear over the sandboxed stage.
      await page.getByRole('button', { name: 'Drawing plane 1', exact: true }).first().click();
      await expect(overlay).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('plane-handle-move')).toBeVisible();
      await expect(page.getByRole('toolbar', { name: /Drawing plane 1 actions/ })).toBeVisible();
      await frame.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('selected.png') });

      // The move handle sits over the rendered plane.
      const handle = (await page.getByTestId('plane-handle-move').boundingBox())!;
      const stage = (await frame.boundingBox())!;
      const planeX = await greenCentroidX(page);
      expect(planeX).toBeGreaterThan(0);
      expect(
        Math.abs(handle.x + handle.width / 2 - stage.x - planeX * (stage.width / stage.width)),
      ).toBeLessThan(stage.width * 0.2);

      // Drag: the plane moves once released (the stage reloads with the new pose).
      const before = await greenCentroidX(page);
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
      await page.mouse.down();
      await page.mouse.move(handle.x + handle.width / 2 + 60, handle.y + handle.height / 2, {
        steps: 6,
      });
      await page.mouse.up();
      await expect
        .poll(async () => (await greenCentroidX(page)) - before, {
          timeout: 20_000,
          intervals: [500],
        })
        .toBeGreaterThan(10);
      await page.screenshot({ path: testInfo.outputPath('after-drag.png') });

      // Escape deselects; clicking the plane in the stage selects it again; clicking empty space deselects.
      await page.keyboard.press('Escape');
      await expect(overlay).toHaveCount(0);
      const box = (await frame.boundingBox())!;
      const cx = box.x + (await greenCentroidX(page));
      await page.mouse.click(cx, box.y + box.height / 2);
      await expect(overlay).toBeVisible({ timeout: 10_000 });
      await page.mouse.click(box.x + 8, box.y + box.height - 8);
      await expect(overlay).toHaveCount(0, { timeout: 10_000 });
    });
  }
});

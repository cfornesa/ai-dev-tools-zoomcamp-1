/**
 * Issue #787: Full and Non-Camera ZIP exports of a structured 3D piece with a drawing plane render it
 * OFFLINE (file://, every network request refused) in both engines: the plane's two colours and
 * transparency show, an animated plane moves, the runtime is vendored, and the toolbar's screenshot
 * action captures the plane. The piece is created through the editor's own creation flow and exported
 * with the editor's Download menu; the extracted files are then opened straight from disk.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { expect, test, type Page } from '@playwright/test';

import { apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

type Engine = 'threejs' | 'aframe';

function sceneFor(engine: Engine) {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: `scene3d-zip-${engine}`,
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
        animation: { kind: 'oscillate', axis: 'x', speed: 0.4, amplitude: 1.2 },
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

async function classify(page: Page, png: Buffer) {
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
    let redX = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (r > g + 60 && r > b + 60) {
        red += 1;
        redX += (i / 4) % image.width;
      }
      if (g > r + 50 && g > b + 50) green += 1;
    }
    return { red, green, total: image.width * image.height, redCentreX: red ? redX / red : 0 };
  }, png.toString('base64'));
}

test.describe('drawing plane in ZIP exports (#787)', () => {
  const fixtures = requireE2EFixtures();

  for (const engine of ['threejs', 'aframe'] as Engine[]) {
    for (const variant of ['Full', 'Non-Camera'] as const) {
      test(`${engine} ${variant} ZIP renders the plane offline`, async ({
        page,
        context,
      }, testInfo) => {
        test.setTimeout(180_000);
        await page.setViewportSize({ width: 1280, height: 900 });
        await loginViaUI(page, fixtures.owner.email, fixtures.password);
        await page.goto('/');
        await page.getByRole('button', { name: 'More creation options' }).click();
        const created = page.waitForResponse(
          (res) =>
            res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/projects3d/',
        );
        await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
        const { id } = (await (await created).json()) as { id: string };
        await page.waitForURL(/\/users\/@[^/]+\/edit\//);
        expect(
          (
            await apiPost(context, `/api/projects3d/${id}/versions/`, {
              scene_json: sceneFor(engine),
              origin: 'manual',
            })
          ).status(),
        ).toBe(201);
        await page.reload();
        await expect(page.getByRole('toolbar', { name: 'Preview actions' })).toBeVisible();

        const toolbar = page.getByRole('toolbar', { name: 'Preview actions' });
        await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
        await toolbar.getByRole('button', { name: 'Open download menu' }).click();
        const download = page.waitForEvent('download');
        await page.getByRole('menuitem', { name: new RegExp(`Download ${variant}`, 'i') }).click();
        const zip = await JSZip.loadAsync(fs.readFileSync((await (await download).path())!));
        const names = Object.keys(zip.files);
        expect(names).toContain('index.html');
        expect(names.some((n) => n.startsWith('runtime/'))).toBe(true);
        const html = await zip.files['index.html']!.async('string');
        expect(html).not.toContain('cdn.jsdelivr.net');
        if (engine === 'threejs') {
          expect(await zip.files['scripts/piece.js']!.async('string')).toContain('drawingPlane');
        }

        const root = fs.mkdtempSync(path.join(os.tmpdir(), `zip787-${engine}-`));
        try {
          for (const [name, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;
            const target = path.join(root, name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, await entry.async('nodebuffer'));
          }
          // Offline: every non-file request is refused, so the vendored runtime is what runs.
          await page.route('**/*', (route) =>
            route.request().url().startsWith('file://') || route.request().url().startsWith('data:')
              ? route.continue()
              : route.abort(),
          );
          await page.goto(`file://${path.join(root, 'index.html')}`);
          const canvas =
            engine === 'threejs'
              ? page.locator('#scene3d-canvas-host canvas')
              : page.locator('canvas.a-canvas').first();
          await expect(canvas).toBeVisible({ timeout: 30_000 });
          await page.waitForTimeout(2000);
          const first = await classify(page, await canvas.screenshot());
          expect(first.red).toBeGreaterThan(first.total * 0.01);
          expect(first.green).toBeGreaterThan(first.total * 0.01);
          await page.screenshot({ path: testInfo.outputPath(`zip-${engine}-${variant}.png`) });
          // Animated (oscillating in x): the plane's position changes over time.
          await page.waitForTimeout(1200);
          const later = await classify(page, await canvas.screenshot());
          expect(Math.abs(later.redCentreX - first.redCentreX)).toBeGreaterThan(2);

          // The toolbar's screenshot action captures the plane.
          const shot = page.waitForEvent('download');
          await page
            .getByRole('button', { name: /take screenshot|screenshot/i })
            .first()
            .click();
          const shotCounts = await classify(page, fs.readFileSync((await (await shot).path())!));
          expect(shotCounts.red).toBeGreaterThan(300);
          expect(shotCounts.green).toBeGreaterThan(300);
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      });
    }
  }
});

/**
 * Issue #781: Draw mode for a structured 3D drawing plane. The author adds a Drawing Plane, enters Draw
 * mode (scene frozen, plane presented face-on at the documented 1024x768), draws with the shared ink
 * tools, and Confirm writes the shapes into that plane object; Cancel restores the pre-edit drawing and
 * the stage is returned exactly as it was.
 */
import { expect, test, type Page } from '@playwright/test';

import { apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

async function openMenu(page: Page) {
  const toolbar = page.getByRole('toolbar', { name: 'Preview actions' });
  const trigger = toolbar.getByRole('button', { name: 'Open piece controls menu' });
  if (await trigger.isVisible().catch(() => false)) await trigger.click();
  return toolbar;
}

async function closeMenu(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Preview actions' });
  if (await dialog.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const canvas = page.getByTestId('ink-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const start = { x: box.x + box.width * from[0], y: box.y + box.height * from[1] };
  const end = { x: box.x + box.width * to[0], y: box.y + box.height * to[1] };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(
      start.x + ((end.x - start.x) * i) / 8,
      start.y + ((end.y - start.y) * i) / 8,
    );
  }
  await page.mouse.up();
}

function inkPixels(page: Page) {
  return page.getByTestId('ink-canvas').evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    // The drawing has a white background, so count non-white pixels.
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! < 240 || data[i + 1]! < 240 || data[i + 2]! < 240) painted += 1;
    }
    return painted;
  });
}

type SavedObject = {
  id: string;
  type: string;
  drawing?: { width: number; height: number; shapes: Array<{ type: string }> };
};

async function savedObjects(page: Page, projectId: string): Promise<SavedObject[]> {
  const project = (await (
    await apiGet(page.context(), `/api/projects3d/${projectId}/`)
  ).json()) as {
    current_version: { scene_json: { objects: SavedObject[] } };
  };
  return project.current_version.scene_json.objects;
}

test.describe('3D drawing plane Draw mode (#781)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`add plane, draw, cancel, confirm, save, reload at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/');
      await page.getByRole('button', { name: 'More creation options' }).click();
      const createdResponse = page.waitForResponse(
        (res) =>
          res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/projects3d/',
      );
      await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
      const projectId = ((await (await createdResponse).json()) as { id: string }).id;
      await page.waitForURL(/\/users\/@[^/]+\/edit\/untitled-3d-scene/);
      await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
      const frame = page.getByTestId('scene3d-preview-canvas-frame');

      // Add Drawing Plane -> a listed, selected object.
      let toolbar = await openMenu(page);
      await toolbar.getByRole('button', { name: '3D authoring', exact: true }).click();
      await toolbar.getByRole('button', { name: 'Add drawing plane' }).click();
      await closeMenu(page);
      await expect(page.getByText('Drawing plane 1').first()).toBeVisible();
      await frame.scrollIntoViewIfNeeded();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
      const before = await frame.screenshot({ path: testInfo.outputPath('stage-before.png') });

      // Enter Draw mode: stage frozen/hidden, ink editor face-on at the documented resolution.
      toolbar = await openMenu(page);
      await toolbar.getByTestId('draw-plane-button').click();
      await expect(page.getByTestId('ink-editor')).toBeVisible();
      await expect(page.getByTestId('ink-frozen-indicator')).toBeVisible();
      await expect(page.getByTestId('ink-canvas')).toHaveJSProperty('width', 1024);
      await expect(page.getByTestId('ink-canvas')).toHaveJSProperty('height', 768);
      await expect(frame).toBeHidden();
      await page.screenshot({ path: testInfo.outputPath('draw-open.png') });

      // Tools: pen, rectangle (filled), ellipse, line, eraser, select, undo/redo, clear.
      expect(await inkPixels(page)).toBe(0);
      await drag(page, [0.1, 0.2], [0.5, 0.35]);
      const afterPen = await inkPixels(page);
      expect(afterPen).toBeGreaterThan(200);
      await page.getByTestId('ink-tool-rect').click();
      await page.getByTestId('ink-fill').check();
      await page.getByTestId('ink-color').fill('#dc2626');
      await drag(page, [0.55, 0.5], [0.85, 0.8]);
      const afterRect = await inkPixels(page);
      expect(afterRect).toBeGreaterThan(afterPen + 5000);
      await page.getByTestId('ink-tool-ellipse').click();
      await page.getByTestId('ink-color').fill('#16a34a');
      await drag(page, [0.1, 0.55], [0.4, 0.85]);
      expect(await inkPixels(page)).toBeGreaterThan(afterRect);
      await page.getByTestId('ink-tool-line').click();
      await drag(page, [0.05, 0.95], [0.95, 0.95]);
      await page.getByTestId('ink-undo').click();
      await page.getByTestId('ink-redo').click();
      await page.getByTestId('ink-tool-eraser').click();
      await drag(page, [0.1, 0.2], [0.5, 0.35]);
      await page.getByTestId('ink-tool-select').click();
      await drag(page, [0.7, 0.65], [0.7, 0.65]);
      await page.getByTestId('ink-delete').click();
      await page.screenshot({ path: testInfo.outputPath('draw-tools.png') });

      // Cancel: no change to the scene, and the stage is back exactly as it was.
      await page.getByTestId('ink-cancel').click();
      await expect(page.getByTestId('ink-editor')).toHaveCount(0);
      await expect(frame).toBeVisible();
      await frame.scrollIntoViewIfNeeded();
      const afterCancel = await frame.screenshot({
        path: testInfo.outputPath('stage-after-cancel.png'),
      });
      expect(afterCancel.equals(before)).toBe(true);

      // Draw again and Confirm: the shapes land in the plane and show on the stage.
      toolbar = await openMenu(page);
      await toolbar.getByTestId('draw-plane-button').click();
      await page.getByTestId('ink-tool-rect').click();
      await page.getByTestId('ink-fill').check();
      await page.getByTestId('ink-color').fill('#dc2626');
      await drag(page, [0.2, 0.2], [0.8, 0.8]);
      await page.getByTestId('ink-confirm').click();
      await expect(page.getByTestId('ink-editor')).toHaveCount(0);
      await expect(frame).toBeVisible();
      await frame.scrollIntoViewIfNeeded();
      const after = await frame.screenshot({ path: testInfo.outputPath('stage-with-drawing.png') });
      expect(after.equals(before)).toBe(false);

      // Save and round-trip.
      toolbar = await openMenu(page);
      await toolbar.getByTestId('project3d-save-button').click();
      await closeMenu(page);
      await expect
        .poll(
          async () =>
            (await savedObjects(page, projectId)).find((o) => o.type === 'drawingPlane')?.drawing
              ?.shapes.length,
        )
        .toBe(1);
      const plane = (await savedObjects(page, projectId)).find((o) => o.type === 'drawingPlane')!;
      expect(plane.drawing).toMatchObject({ width: 1024, height: 768 });
      await page.reload();
      await expect(page.getByText('Drawing plane 1').first()).toBeVisible();
      await page.getByTestId('scene3d-preview-canvas-frame').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('reloaded.png') });
    });
  }
});

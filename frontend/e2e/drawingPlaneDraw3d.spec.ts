/**
 * Issue #781: Draw mode for a structured 3D drawing plane. The author adds a Drawing Plane, enters Draw
 * mode (scene frozen, plane presented face-on at the documented 1024x768), draws with the shared ink
 * tools, and Confirm writes the shapes into that plane object; Cancel restores the pre-edit drawing and
 * the stage is returned exactly as it was.
 */
import { expect, test, type Page } from '@playwright/test';

import { apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { createServerProject3D } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';

async function openAuthoringPanel(page: Page) {
  const toolbar = page.getByRole('toolbar', { name: 'Preview actions' });
  const authoringActions = toolbar.getByRole('group', { name: '3D authoring actions' });
  if (!(await authoringActions.isVisible().catch(() => false))) {
    await toolbar.getByRole('button', { name: '3D authoring', exact: true }).click();
  }
  return toolbar;
}

async function closeAuthoringPanel(page: Page) {
  const close = page.getByRole('button', { name: 'Close 3d authoring', exact: true });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
    await expect(page.getByRole('group', { name: '3D authoring actions' })).toBeHidden();
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
      const projectId = await createServerProject3D(page);
      await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
      const frame = page.getByTestId('scene3d-preview-canvas-frame');

      // Add Drawing Plane -> a listed, selected object.
      let toolbar = await openAuthoringPanel(page);
      await toolbar.getByRole('button', { name: 'Add drawing plane' }).click();
      await closeAuthoringPanel(page);
      await expect(page.getByText('Drawing plane 1').first()).toBeVisible();
      await frame.scrollIntoViewIfNeeded();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
      const stage = page.getByTestId('scene3d-preview');
      const pageScrollBefore = await page.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY,
      }));
      await page.screenshot({ path: testInfo.outputPath('stage-before.png') });
      const stageBefore = await stage.boundingBox();
      const moveHandleBefore = await page.getByTestId('plane-handle-move').boundingBox();
      expect(stageBefore).not.toBeNull();
      expect(moveHandleBefore).not.toBeNull();
      const moveHandlePositionBefore = {
        x: moveHandleBefore!.x - stageBefore!.x,
        y: moveHandleBefore!.y - stageBefore!.y,
        width: moveHandleBefore!.width,
        height: moveHandleBefore!.height,
      };
      const savedBeforeDraw = await savedObjects(page, projectId);

      // Enter Draw mode: stage frozen/hidden, ink editor face-on at the documented resolution.
      toolbar = await openAuthoringPanel(page);
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
      await expect(page.getByTestId('plane-handle-move')).toBeVisible();
      await expect(page.getByTestId('plane-selection-toolbar')).toBeVisible();
      await closeAuthoringPanel(page);
      await page.evaluate(({ x, y }) => window.scrollTo(x, y), pageScrollBefore);
      await expect
        .poll(() => page.evaluate(() => ({ x: window.scrollX, y: window.scrollY })))
        .toEqual(pageScrollBefore);
      const stageAfterCancel = await stage.screenshot();
      await page.screenshot({ path: testInfo.outputPath('stage-after-cancel.png') });
      const moveHandleAfter = await page.getByTestId('plane-handle-move').boundingBox();
      const stageAfter = await stage.boundingBox();
      expect(stageAfter).not.toBeNull();
      expect(moveHandleAfter).not.toBeNull();
      expect({
        x: moveHandleAfter!.x - stageAfter!.x,
        y: moveHandleAfter!.y - stageAfter!.y,
        width: moveHandleAfter!.width,
        height: moveHandleAfter!.height,
      }).toEqual(moveHandlePositionBefore);
      expect(await savedObjects(page, projectId)).toEqual(savedBeforeDraw);
      if (viewport.width === 375) {
        const layout = await page.evaluate(() => ({
          viewportWidth: document.documentElement.clientWidth,
          documentWidth: document.documentElement.scrollWidth,
          stage: document.querySelector('[data-testid="scene3d-preview"]')!.getBoundingClientRect(),
        }));
        expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
        expect(layout.stage.left).toBeGreaterThanOrEqual(0);
        expect(layout.stage.right).toBeLessThanOrEqual(layout.viewportWidth);
      }

      // Draw again and Confirm: the shapes land in the plane and show on the stage.
      toolbar = await openAuthoringPanel(page);
      await toolbar.getByTestId('draw-plane-button').click();
      await page.getByTestId('ink-tool-rect').click();
      await page.getByTestId('ink-fill').check();
      await page.getByTestId('ink-color').fill('#dc2626');
      await drag(page, [0.2, 0.2], [0.8, 0.8]);
      await page.getByTestId('ink-confirm').click();
      await expect(page.getByTestId('ink-editor')).toHaveCount(0);
      await expect(frame).toBeVisible();
      await closeAuthoringPanel(page);
      await frame.scrollIntoViewIfNeeded();
      const after = await stage.screenshot({ path: testInfo.outputPath('stage-with-drawing.png') });
      expect(after.equals(stageAfterCancel)).toBe(false);

      // Save and round-trip.
      toolbar = await openAuthoringPanel(page);
      await page.getByTestId('project3d-save-button').click();
      await closeAuthoringPanel(page);
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

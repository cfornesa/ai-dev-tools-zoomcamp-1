/**
 * Issue #775: Ink mode in the structured 2D editor. The author draws pen/pencil strokes over a frozen
 * snapshot of the scene, erases/selects/undoes, and confirms; every stroke lands in one ink group, saves,
 * and survives a reload. Cancel restores the pre-ink layer exactly.
 */
import { expect, test, type Page } from '@playwright/test';

import { apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { createBlankProjectViaUI } from './support/createProject.js';
import {
  closePieceControlsMenu,
  openEditScene,
  openPieceControlsMenu,
} from './support/openEditScene.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function openInk(page: Page) {
  await openPieceControlsMenu(page);
  const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
  await toolbar.getByTestId('ink-mode-button').click();
  await expect(page.getByTestId('ink-editor')).toBeVisible();
  // Starting ink dismisses the piece-controls menu itself.
  await expect(page.getByRole('dialog', { name: 'Piece actions' })).toBeHidden();
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  await page.getByTestId('ink-canvas').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 0));
  const box = (await page.getByTestId('ink-canvas').boundingBox())!;
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

/** Counts painted (non-transparent) pixels in the ink canvas. */
function inkPixels(page: Page) {
  return page.getByTestId('ink-canvas').evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) painted += 1;
    return painted;
  });
}

async function savedScene(page: Page, projectId: string) {
  const project = (await (await apiGet(page.context(), `/api/projects/${projectId}/`)).json()) as {
    current_version: number;
  };
  const version = (await (
    await apiGet(page.context(), `/api/projects/${projectId}/versions/${project.current_version}/`)
  ).json()) as { scene_json: Record<string, unknown> };
  return version.scene_json as {
    layers: Array<{ id: string }>;
    shapes: Array<{ id: string; groupId: string | null; type: string }>;
    groups: Array<{ id: string; childIds: string[] }>;
  };
}

test.describe('structured 2D ink layer (#775)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`draw, erase, undo, confirm, save, reload, cancel at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const projectId = await createBlankProjectViaUI(page);

      await openInk(page);
      await expect(page.getByTestId('ink-frozen-indicator')).toBeVisible();
      await expect(page.getByTestId('scene-canvas-viewport')).toBeHidden();
      await expect(page.getByTestId('ink-canvas')).toHaveJSProperty('width', 800);
      await page.screenshot({ path: test.info().outputPath('ink-open.png') });

      // Pen and pencil strokes paint the ink surface.
      expect(await inkPixels(page)).toBe(0);
      await drag(page, [0.1, 0.2], [0.6, 0.3]);
      const afterPen = await inkPixels(page);
      expect(afterPen).toBeGreaterThan(200);
      await page.getByTestId('ink-tool-pencil').click();
      await drag(page, [0.1, 0.6], [0.7, 0.8]);
      const afterPencil = await inkPixels(page);
      expect(afterPencil).toBeGreaterThan(afterPen);

      // Undo / Redo on the ink's own history.
      await page.getByTestId('ink-undo').click();
      expect(await inkPixels(page)).toBe(afterPen);
      await page.getByTestId('ink-redo').click();
      expect(await inkPixels(page)).toBe(afterPencil);

      // Eraser removes the stroke it touches.
      await page.getByTestId('ink-tool-eraser').click();
      await drag(page, [0.1, 0.6], [0.7, 0.8]);
      expect(await inkPixels(page)).toBe(afterPen);

      // Select + move + delete a stroke.
      await page.getByTestId('ink-tool-select').click();
      await drag(page, [0.35, 0.25], [0.35, 0.5]);
      await page.getByTestId('ink-delete').click();
      expect(await inkPixels(page)).toBe(0);
      await page.getByTestId('ink-undo').click();
      expect(await inkPixels(page)).toBeGreaterThan(200);

      // Two strokes total, then Confirm.
      await page.getByTestId('ink-tool-pen').click();
      await drag(page, [0.2, 0.7], [0.8, 0.7]);
      await page.screenshot({ path: test.info().outputPath('ink-drawn.png') });
      await page.getByTestId('ink-confirm').click();
      await expect(page.getByTestId('ink-editor')).toHaveCount(0);
      await expect(page.getByTestId('scene-canvas-viewport')).toBeVisible();
      await page.screenshot({ path: test.info().outputPath('ink-confirmed.png') });

      // Save, then the saved scene has ONE ink group with the strokes.
      await openEditScene(page);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await closePieceControlsMenu(page);
      await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version/);
      const scene = await savedScene(page, projectId);
      const inkGroups = scene.groups.filter((g) => g.id === 'ink-group');
      expect(inkGroups).toHaveLength(1);
      expect(inkGroups[0]!.childIds.length).toBe(2);
      expect(
        scene.shapes.filter((s) => s.groupId === 'ink-group' && s.type === 'path'),
      ).toHaveLength(2);

      // Reload: the strokes come back in the ink editor, Cancel leaves them untouched.
      await page.reload();
      await openInk(page);
      const reloaded = await inkPixels(page);
      expect(reloaded).toBeGreaterThan(200);
      await page.getByTestId('ink-clear').click();
      expect(await inkPixels(page)).toBe(0);
      await page.getByTestId('ink-cancel').click();
      await expect(page.getByTestId('ink-editor')).toHaveCount(0);
      await openInk(page);
      expect(await inkPixels(page)).toBe(reloaded);
      await page.getByTestId('ink-cancel').click();

      // The public/regular stage still shows the ink (it is ordinary path shapes in the scene).
      await page.screenshot({ path: test.info().outputPath('ink-after.png') });
    });
  }
});

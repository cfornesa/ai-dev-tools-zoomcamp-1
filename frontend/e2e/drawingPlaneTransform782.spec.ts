/**
 * Issue #782: photo-editor-style selection chrome for a structured-3D drawing plane. Selecting a plane
 * shows on-canvas handles and a small floating toolbar; a precise-values panel opens on demand; nothing
 * shows when nothing is selected; expansion is proportional by default (Shift or an edge handle
 * stretches); everything is keyboard-reachable; a drag is one undo step.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

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

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragHandle(
  page: Page,
  handle: Locator,
  by: { x: number; y: number },
  options: { shift?: boolean; hold?: () => Promise<void> } = {},
) {
  const from = await center(handle);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  if (options.shift) await page.keyboard.down('Shift');
  for (let i = 1; i <= 6; i += 1) {
    await page.mouse.move(from.x + (by.x * i) / 6, from.y + (by.y * i) / 6);
  }
  if (options.hold) await options.hold();
  await page.mouse.up();
  if (options.shift) await page.keyboard.up('Shift');
}

/** The rendered WebGL canvas pixels (without the selection chrome drawn above it). */
function canvasPixels(page: Page) {
  return page
    .getByTestId('scene3d-preview-canvas')
    .evaluate((el) => (el as HTMLCanvasElement).toDataURL('image/png'));
}

async function field(page: Page, label: string) {
  return Number(await page.getByLabel(label, { exact: true }).inputValue());
}

async function setField(page: Page, label: string, value: string) {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(value);
  await input.press('Enter');
}

test.describe('drawing plane selection chrome (#782)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`handles, toolbar, precise panel, proportional resize, keyboard at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(150_000);
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/');
      await page.getByRole('button', { name: 'More creation options' }).click();
      const created = page.waitForResponse(
        (res) =>
          res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/projects3d/',
      );
      await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
      const projectId = ((await (await created).json()) as { id: string }).id;
      await page.waitForURL(/\/users\/@[^/]+\/edit\/untitled-3d-scene/);
      await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();
      const frame = page.getByTestId('scene3d-preview-canvas-frame');
      const overlay = page.getByTestId('plane-selection-overlay');

      // Nothing selected: no selection chrome at all.
      await expect(overlay).toHaveCount(0);
      await frame.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('1-nothing-selected.png') });

      // Add a drawing plane: it is selected, so handles + the floating toolbar appear.
      let toolbar = await openMenu(page);
      await toolbar.getByRole('button', { name: '3D authoring', exact: true }).click();
      await toolbar.getByRole('button', { name: 'Add drawing plane' }).click();
      await closeMenu(page);
      await expect(overlay).toBeVisible();
      const floating = page
        .getByRole('toolbar', { name: /actions$/ })
        .filter({ has: page.getByRole('button', { name: 'Precise values' }) });
      await expect(floating).toBeVisible();
      for (const kind of [
        'move',
        'rotate',
        'corner-0',
        'corner-1',
        'corner-2',
        'corner-3',
        'edge-0',
        'edge-1',
        'edge-2',
        'edge-3',
      ]) {
        await expect(page.getByTestId(`plane-handle-${kind}`)).toBeVisible();
      }
      // The precise panel is NOT shown by default.
      await expect(page.getByTestId('plane-precise-panel')).toHaveCount(0);
      await frame.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('2-selected-handles-toolbar.png') });

      // Toolbar: horizontal / vertical presets change the plane (rendered stage differs).
      const upright = await canvasPixels(page);
      await floating.getByRole('button', { name: /Rotate horizontal/ }).click();
      await expect
        .poll(async () => (await canvasPixels(page)) === upright, { timeout: 5000 })
        .toBe(false);
      await frame.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('3-horizontal.png') });
      await floating.getByRole('button', { name: /Rotate vertical/ }).click();
      await expect
        .poll(async () => (await canvasPixels(page)) === upright, { timeout: 5000 })
        .toBe(true);

      // Precise panel opens on demand, holding the real values (width 4 x height 3 to start).
      await floating.getByRole('button', { name: 'Precise values' }).click();
      const panel = page.getByTestId('plane-precise-panel');
      await expect(panel).toBeVisible();
      expect(await field(page, 'Width')).toBe(4);
      expect(await field(page, 'Height')).toBe(3);
      await page.screenshot({ path: testInfo.outputPath('4-precise-panel.png') });

      // Proportional by default: width 6 -> height 4.5; unticking "Keep proportions" stretches one axis.
      await setField(page, 'Width', '6');
      await expect.poll(() => field(page, 'Height')).toBe(4.5);
      await panel.getByLabel('Keep proportions').uncheck();
      await setField(page, 'Height', '2');
      await expect.poll(() => field(page, 'Width')).toBe(6);
      await panel.getByLabel('Keep proportions').check();
      await setField(page, 'Width', '4');
      await expect.poll(() => field(page, 'Height')).toBeCloseTo(4 / 3, 2);
      // Height 3 at the current 3:1 ratio drives the width to 9 (proportional), not to a fixed value.
      await setField(page, 'Height', '3');
      await expect.poll(() => field(page, 'Width')).toBeCloseTo(9, 2);
      // Restore the original 4 x 3 plane by stretching explicitly.
      await panel.getByLabel('Keep proportions').uncheck();
      await setField(page, 'Width', '4');
      await expect.poll(() => field(page, 'Height')).toBe(3);
      await panel.getByLabel('Keep proportions').check();
      await page.keyboard.press('Escape'); // closes the panel first
      await expect(panel).toHaveCount(0);
      await expect(overlay).toBeVisible();

      // Corner drag scales PROPORTIONALLY, with a live size readout mid-resize.
      await floating.getByRole('button', { name: 'Precise values' }).click();
      const before = { w: await field(page, 'Width'), h: await field(page, 'Height') };
      await panel.getByRole('button', { name: 'Close precise values' }).click();
      await dragHandle(
        page,
        page.getByTestId('plane-handle-corner-2'),
        { x: 50, y: 50 },
        {
          hold: async () => {
            await expect(page.getByTestId('plane-resize-readout')).toBeVisible();
            await page.screenshot({ path: testInfo.outputPath('5-mid-resize.png') });
          },
        },
      );
      await floating.getByRole('button', { name: 'Precise values' }).click();
      const afterCorner = { w: await field(page, 'Width'), h: await field(page, 'Height') };
      expect(afterCorner.w).toBeGreaterThan(before.w);
      expect(afterCorner.w / afterCorner.h).toBeCloseTo(before.w / before.h, 1);
      await panel.getByRole('button', { name: 'Close precise values' }).click();

      // Shift-drag on a corner and an edge handle stretch (the ratio changes).
      await dragHandle(page, page.getByTestId('plane-handle-edge-1'), { x: 40, y: 0 });
      await floating.getByRole('button', { name: 'Precise values' }).click();
      const afterEdge = { w: await field(page, 'Width'), h: await field(page, 'Height') };
      expect(afterEdge.w).toBeGreaterThan(afterCorner.w);
      expect(afterEdge.h).toBeCloseTo(afterCorner.h, 1);
      await panel.getByRole('button', { name: 'Close precise values' }).click();

      // One drag == one undo step: undoing restores the pre-drag width exactly.
      toolbar = await openMenu(page);
      const undoButton = toolbar.getByRole('button', { name: 'Undo', exact: true });
      // The authoring popover may still be open from the earlier "Add drawing plane".
      if (!(await undoButton.isVisible().catch(() => false))) {
        await toolbar.getByRole('button', { name: '3D authoring', exact: true }).click();
      }
      await undoButton.click();
      await closeMenu(page);
      await floating.getByRole('button', { name: 'Precise values' }).click();
      expect(await field(page, 'Width')).toBeCloseTo(afterCorner.w, 1);
      await panel.getByRole('button', { name: 'Close precise values' }).click();

      // Move by dragging the move handle, and by keyboard (arrow keys on the focused handle).
      await floating.getByRole('button', { name: 'Precise values' }).click();
      const x0 = await field(page, 'Position X');
      await panel.getByRole('button', { name: 'Close precise values' }).click();
      await dragHandle(page, page.getByTestId('plane-handle-move'), { x: 40, y: 0 });
      await floating.getByRole('button', { name: 'Precise values' }).click();
      const x1 = await field(page, 'Position X');
      expect(x1).toBeGreaterThan(x0);
      await panel.getByRole('button', { name: 'Close precise values' }).click();
      await page.getByTestId('plane-handle-move').focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await floating.getByRole('button', { name: 'Precise values' }).click();
      expect(await field(page, 'Position X')).toBeGreaterThan(x1);
      await panel.getByRole('button', { name: 'Close precise values' }).click();
      await page.getByTestId('plane-handle-corner-0').focus();
      await page.keyboard.press('+');
      await floating.getByRole('button', { name: 'Precise values' }).click();
      expect(await field(page, 'Width')).toBeGreaterThan(afterCorner.w - 0.01);
      await panel.getByRole('button', { name: 'Close precise values' }).click();

      // "More" overflow: Duplicate then Delete.
      await floating.getByRole('button', { name: 'More actions' }).click();
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();
      await expect(page.getByText(/copy/).first()).toBeVisible();
      await floating.getByRole('button', { name: 'More actions' }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await expect(overlay).toHaveCount(0);

      // Click the original plane in the stage to select it again; Escape dismisses everything.
      const stageBox = (await frame.boundingBox())!;
      await page.mouse.click(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
      await expect(overlay).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(overlay).toHaveCount(0);
      // Clicking empty stage space also leaves nothing selected.
      await page.mouse.click(stageBox.x + 6, stageBox.y + stageBox.height - 6);
      await expect(overlay).toHaveCount(0);

      // Persisted through save.
      toolbar = await openMenu(page);
      await toolbar.getByTestId('project3d-save-button').click();
      await closeMenu(page);
      await expect
        .poll(async () => {
          const project = (await (
            await apiGet(page.context(), `/api/projects3d/${projectId}/`)
          ).json()) as {
            current_version: { scene_json: { objects: Array<{ type: string; width?: number }> } };
          };
          return project.current_version.scene_json.objects.filter((o) => o.type === 'drawingPlane')
            .length;
        })
        .toBeGreaterThan(0);
    });
  }
});

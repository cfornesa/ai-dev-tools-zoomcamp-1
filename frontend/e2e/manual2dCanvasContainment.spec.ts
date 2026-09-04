/** Issue #397: the 2D editor's rendered canvas and its overlays must stay
 * inside the designated Preview stage box, and must never cover the
 * surrounding tabs, description, or panel content. */
import { expect, test } from '@playwright/test';

import { apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

/** Every part of the canvas/overlay box (`.editor-scene-canvas`, which the
 * p5 `<canvas>` and any SVG overlays fill via `width/height: 100%`) must be
 * a subset of its designated viewport stage box -- the exact regression
 * this issue reports: the canvas escaping upward and covering the tabs,
 * Preview heading, and description above it. */
function readCanvasGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.editor-scene-canvas');
    const viewport = document.querySelector('.editor-scene-canvas-viewport');
    if (!canvas || !viewport) return null;
    const c = canvas.getBoundingClientRect();
    const v = viewport.getBoundingClientRect();
    return {
      canvasTop: c.top,
      canvasBottom: c.bottom,
      canvasLeft: c.left,
      canvasRight: c.right,
      viewportTop: v.top,
      viewportBottom: v.bottom,
      viewportLeft: v.left,
      viewportRight: v.right,
      documentWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });
}

async function expectCanvasContained(page: import('@playwright/test').Page) {
  // `fitScale` (the canvas's own logical size) recomputes from a
  // ResizeObserver on `.editor-scene-canvas-viewport`, which can lag one
  // tick behind a Playwright `setViewportSize` -- poll rather than read
  // once, so this doesn't flake on that harmless settle delay.
  await expect
    .poll(async () => {
      const g = await readCanvasGeometry(page);
      return g === null
        ? null
        : g.canvasTop >= g.viewportTop - 1 && g.canvasBottom <= g.viewportBottom + 1;
    })
    .toBe(true);
  const g = await readCanvasGeometry(page);
  expect(g).not.toBeNull();
  const geometry = g!;
  expect(geometry.canvasLeft).toBeGreaterThanOrEqual(geometry.viewportLeft - 1);
  expect(geometry.canvasRight).toBeLessThanOrEqual(geometry.viewportRight + 1);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.innerWidth);
}

test.describe('manual 2D canvas containment', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('the canvas and overlays never cover surrounding editor chrome at either required viewport', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new animation' }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    const projectId = /\/projects\/([^/]+)$/.exec(page.url())?.[1];
    expect(projectId).toBeTruthy();
    if (!projectId) return;

    const metadata = await apiPatch(page.context(), `/api/projects/${projectId}/`, {
      description: 'A canvas containment fixture with a visible description.',
    });
    expect(metadata.ok()).toBe(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();

    // The add-shape toolbar lives behind the stage's own "Open piece
    // controls menu" -> "Edit scene" popover, not inline on the canvas.
    const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
    await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await toolbar.getByRole('button', { name: 'Edit scene' }).click();
    await toolbar.getByRole('button', { name: 'Add circle' }).click();
    await toolbar.getByRole('button', { name: 'Add rectangle' }).click();
    await toolbar.getByRole('button', { name: 'Add line' }).click();
    await toolbar.getByRole('button', { name: /close edit scene/i }).click();
    await page.keyboard.press('Escape');

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);

      // The canvas/overlay box stays inside its designated stage, in Visual
      // mode, and never covers the surrounding chrome.
      await expectCanvasContained(page);
      await expect(page.getByRole('heading', { name: 'Preview' })).toBeVisible();
      await expect(page.getByText('shape(s) in the working copy.', { exact: false })).toBeVisible();

      // Switching Details/Layers/Tools/Inspector (via the narrow-viewport
      // switcher, or already all visible above the breakpoint) never loses
      // or duplicates the canvas, and the Details tab's description field
      // -- one of the panels the issue reports as covered -- stays reachable.
      const detailsTab = page.getByRole('tab', { name: 'Details', exact: true });
      if (await detailsTab.isVisible()) {
        await detailsTab.click();
        await expect(page.getByLabel('Description')).toHaveValue(
          'A canvas containment fixture with a visible description.',
        );
      }
      const layersTab = page.getByRole('tab', { name: 'Layers', exact: true });
      if (await layersTab.isVisible()) {
        await layersTab.click();
      }
      await expect(page.getByRole('list', { name: 'Scene outline' })).toBeVisible();

      // Preview is never one of the switcher's tabs (issue #93) -- it and
      // its containment stay intact through every tab switch above.
      await expectCanvasContained(page);
      await expect(page.locator('.editor-scene-canvas canvas.p5Canvas')).toHaveCount(1);

      // Selecting a shape's overlay controls stay aligned inside the stage
      // too, not just the bare canvas. (Layers is still the active tab from
      // just above, so its outline row is reachable at every viewport.)
      await page.getByRole('button', { name: 'Circle 1', exact: true }).click();
      await expectCanvasContained(page);
      const handleGeometry = await page.evaluate(() => {
        const canvas = document.querySelector('.editor-scene-canvas');
        const handle = document.querySelector('.editor-shape-handle');
        if (!canvas || !handle) return null;
        const c = canvas.getBoundingClientRect();
        const h = handle.getBoundingClientRect();
        return {
          withinX: h.left >= c.left - 20 && h.right <= c.right + 20,
          withinY: h.top >= c.top - 20 && h.bottom <= c.bottom + 20,
        };
      });
      if (handleGeometry) {
        expect(handleGeometry.withinX).toBe(true);
        expect(handleGeometry.withinY).toBe(true);
      }

      const toolsTab = page.getByRole('tab', { name: 'Tools', exact: true });
      if (await toolsTab.isVisible()) {
        await toolsTab.click();
        await expect(page.getByRole('region', { name: 'Tools' })).toBeVisible();
      }
      await expectCanvasContained(page);

      // Switching to Code and back never duplicates or detaches the canvas.
      await page.getByRole('radio', { name: 'Code' }).click();
      await expect(page.locator('.editor-scene-canvas canvas.p5Canvas')).toHaveCount(1);
      await page.getByRole('radio', { name: 'Visual' }).click();
      await expectCanvasContained(page);
      await expect(page.locator('.editor-scene-canvas canvas.p5Canvas')).toHaveCount(1);

      await page.screenshot({
        path: test.info().outputPath(`canvas-containment-${viewport.width}.png`),
        fullPage: true,
      });
    }
  });
});

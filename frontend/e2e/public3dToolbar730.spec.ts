/** Issue #730: public 3D stage toolbar placement and non-reflowing popovers. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

const TOP_LEVEL_ACTIONS =
  '.piece-stage-toolbar-group > .piece-stage-icon-button, .piece-stage-toolbar-group > .piece-stage-download > .piece-stage-icon-button, .piece-stage-toolbar-group > .piece-stage-controls > .piece-stage-icon-button';

async function actionGeometry(frame: import('@playwright/test').Locator) {
  return frame.locator(TOP_LEVEL_ACTIONS).evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }),
  );
}

test.describe('public 3D stage toolbar placement (#730)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('overlays controls without reflow at desktop and mobile sizes', async ({
    page,
    browser,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    const createdResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/projects3d/') && response.request().method() === 'POST',
    );
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    const created = await createdResponse;
    expect(created.status()).toBe(201);
    const { id: projectId } = (await created.json()) as { id: string };
    await page.waitForURL(/\/users\/@[^/]+\/edit\/untitled-3d-scene(?:-\d+)?$/);
    expect(projectId).toBeTruthy();
    if (!projectId) throw new Error('Could not determine the created 3D project id.');

    await page
      .getByRole('group', { name: 'Publication status' })
      .getByRole('button', { name: 'Published', exact: true })
      .click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Publish', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    try {
      await anonymousPage.goto(`/immersive/p3d/${projectId}`);
      const frame = anonymousPage.getByTestId('scene3d-preview-canvas-frame');
      const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
      await expect(toolbar).toBeVisible();

      for (const viewport of [
        { name: 'desktop', width: 1440, height: 900 },
        { name: 'mobile', width: 375, height: 812 },
      ]) {
        await anonymousPage.setViewportSize(viewport);
        const stageBox = await frame.boundingBox();
        const fullscreen = toolbar.getByRole('button', { name: 'Expand piece to fullscreen' });
        await expect(fullscreen).toBeVisible();
        const fullscreenBox = await fullscreen.boundingBox();
        expect(stageBox).not.toBeNull();
        expect(fullscreenBox).not.toBeNull();
        expect(fullscreenBox!.x + fullscreenBox!.width).toBeLessThanOrEqual(
          stageBox!.x + stageBox!.width + 1,
        );
        expect(fullscreenBox!.y + fullscreenBox!.height).toBeLessThanOrEqual(
          stageBox!.y + stageBox!.height + 1,
        );
        expect(fullscreenBox!.x).toBeGreaterThan(stageBox!.x + stageBox!.width / 2);

        const closed = await actionGeometry(frame);
        expect(closed.length).toBe(7);
        for (const button of closed) {
          expect(button.width).toBeGreaterThanOrEqual(32);
          expect(button.height).toBeGreaterThanOrEqual(32);
        }
        if (viewport.name === 'desktop') {
          expect(
            Math.max(...closed.map((button) => button.y)) -
              Math.min(...closed.map((button) => button.y)),
          ).toBeLessThanOrEqual(1);
        }

        const controls = toolbar.getByRole('button', { name: 'Piece controls', exact: true });
        await controls.click();
        const controlsOpen = await actionGeometry(frame);
        expect(controlsOpen).toHaveLength(closed.length);
        controlsOpen.forEach((button, index) => {
          expect(Math.abs(button.x - closed[index].x)).toBeLessThanOrEqual(1);
          expect(Math.abs(button.y - closed[index].y)).toBeLessThanOrEqual(1);
          expect(Math.abs(button.width - closed[index].width)).toBeLessThanOrEqual(1);
          expect(Math.abs(button.height - closed[index].height)).toBeLessThanOrEqual(1);
        });
        const controlsPanel = toolbar.locator('.piece-stage-controls-panel');
        await expect(controlsPanel).toBeVisible();
        await expect(
          controlsPanel.getByRole('button', { name: 'Close piece controls' }),
        ).toBeVisible();
        await anonymousPage.screenshot({
          path: testInfo.outputPath(`issue-730-${viewport.name}-controls-open.png`),
          fullPage: false,
        });
        await controlsPanel.getByRole('button', { name: 'Close piece controls' }).click();

        await toolbar.getByRole('button', { name: 'Open download menu' }).click();
        await expect(toolbar.getByRole('menuitem', { name: 'Download Full ZIP' })).toBeVisible();
        const downloadOpen = await actionGeometry(frame);
        downloadOpen.forEach((button, index) => {
          expect(Math.abs(button.x - closed[index].x)).toBeLessThanOrEqual(1);
          expect(Math.abs(button.y - closed[index].y)).toBeLessThanOrEqual(1);
        });
        await anonymousPage.screenshot({
          path: testInfo.outputPath(`issue-730-${viewport.name}-download-open.png`),
          fullPage: false,
        });
        await toolbar.getByRole('button', { name: 'Close download menu' }).click();
        await anonymousPage.screenshot({
          path: testInfo.outputPath(`issue-730-${viewport.name}-closed.png`),
          fullPage: false,
        });
      }
    } finally {
      await anonymousContext.close();
    }
  });
});

import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject3D } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('3D authoring panel layout (#1113)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('keeps the authoring panel usable without horizontal clipping', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createServerProject3D(page);
    await expect(page.getByTestId('scene3d-preview-canvas')).toBeVisible();

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
      // Short-height mobile stress case exercises the panel's vertical scroll.
      { width: 375, height: 360 },
    ]) {
      await page.setViewportSize(viewport);
      const frame = page.getByTestId('scene3d-preview-canvas-frame');
      const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
      const trigger = toolbar.getByRole('button', { name: '3D authoring', exact: true });
      await expect(trigger).toBeVisible();
      await trigger.click();

      const panel = toolbar.locator('.editor-authoring-controls-panel');
      await expect(panel).toBeVisible();
      const geometry = await panel.evaluate((element) => {
        const panelElement = element as HTMLElement;
        const rect = panelElement.getBoundingClientRect();
        return {
          x: rect.x,
          right: rect.right,
          width: rect.width,
          scrollWidth: panelElement.scrollWidth,
          clientWidth: panelElement.clientWidth,
          scrollHeight: panelElement.scrollHeight,
          clientHeight: panelElement.clientHeight,
        };
      });

      expect(geometry.width).toBeGreaterThanOrEqual(viewport.width === 375 ? 280 : 360);
      expect(geometry.x).toBeGreaterThanOrEqual(16);
      expect(viewport.width - geometry.right).toBeGreaterThanOrEqual(16);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
      if (viewport.height === 360) {
        expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
      }

      await page.screenshot({
        path: testInfo.outputPath(`authoring-panel-${viewport.width}x${viewport.height}.png`),
        fullPage: true,
      });

      const controls = panel.getByRole('button');
      const controlCount = await controls.count();
      expect(controlCount).toBeGreaterThan(1);
      for (let index = 0; index < controlCount; index += 1) {
        const control = controls.nth(index);
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeVisible();
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(geometry.x);
        expect(box!.x + box!.width).toBeLessThanOrEqual(geometry.right);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      }

      await panel.evaluate((element) => {
        const panelElement = element as HTMLElement;
        panelElement.scrollTop = panelElement.scrollHeight;
      });
      const actions = panel.getByRole('group', { name: '3D authoring actions' });
      const finalAction = actions.getByRole('button').last();
      const close = panel.getByRole('button', { name: 'Close 3d authoring', exact: true });
      await expect(finalAction).toBeInViewport({ ratio: 0.99 });
      await expect(close).toBeInViewport({ ratio: 0.99 });
      const closeReceivesPointer = await close.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return hit === element || element.contains(hit);
      });
      expect(closeReceivesPointer).toBe(true);
      await close.click();
      await expect(panel).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }
  });
});

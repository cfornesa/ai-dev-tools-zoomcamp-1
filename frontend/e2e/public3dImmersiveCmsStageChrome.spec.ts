/** Issue #389: verify the anonymous CMS immersive 3D route independently. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('anonymous CMS immersive 3D stage chrome', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('keeps the CMS wrapper chrome-less and responsive', async ({ page, browser }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/');
    await page.getByRole('button', { name: 'More creation options' }).click();
    await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
    await page.waitForURL(/\/projects3d\/[^/]+$/);
    const projectId = /\/projects3d\/([^/]+)$/.exec(page.url())?.[1];
    expect(projectId).toBeTruthy();
    if (!projectId) return;

    await page.setViewportSize({ width: 1280, height: 900 });
    const ownerToolbar = page
      .getByTestId('scene3d-preview-canvas-frame')
      .getByRole('toolbar', { name: 'Preview actions' });
    await ownerToolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await ownerToolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
    await ownerToolbar.getByRole('button', { name: 'Published', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Publish', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    const context = await browser.newContext();
    await context.addInitScript(() => {
      const devices = navigator.mediaDevices;
      if (!devices) return;
      const original = devices.getUserMedia.bind(devices);
      Object.defineProperty(devices, 'getUserMedia', {
        configurable: true,
        value: (...args: Parameters<MediaDevices['getUserMedia']>) => {
          window.dispatchEvent(new Event('camera-requested'));
          return original(...args);
        },
      });
    });
    const anonymousPage = await context.newPage();
    try {
      let cameraRequests = 0;
      await anonymousPage.exposeFunction('recordCameraRequest', () => {
        cameraRequests += 1;
      });
      await anonymousPage.addInitScript(() => {
        window.addEventListener('camera-requested', () => {
          void (
            window as unknown as { recordCameraRequest: () => Promise<void> }
          ).recordCameraRequest();
        });
      });
      await anonymousPage.goto(`/immersive/p3d/${projectId}?embed=1&cms=1`);
      const viewer = anonymousPage.getByTestId('immersive-project3d-viewer');
      const frame = anonymousPage.getByTestId('scene3d-preview-canvas-frame');
      const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
      await expect(viewer).toHaveAttribute('data-immersive-embed-mode', 'cms');
      await expect(viewer).toBeVisible();
      await expect(frame.locator('canvas')).toBeVisible();
      await expect(toolbar).toBeVisible();
      await expect(anonymousPage.locator('.app-shell-header')).toHaveCount(0);
      await expect(viewer.getByRole('heading')).toHaveCount(0);
      await expect(viewer.getByRole('button', { name: 'Embed (Custom)' })).toHaveCount(0);
      await expect(viewer.getByRole('button', { name: 'Embed (CMS)' })).toHaveCount(0);
      expect(cameraRequests).toBe(0);

      await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
      for (const viewport of [
        { name: 'desktop', width: 1280, height: 900 },
        { name: 'mobile', width: 375, height: 812 },
      ]) {
        await anonymousPage.setViewportSize(viewport);
        const dialog = toolbar.getByRole('dialog', { name: 'Preview actions' });
        await expect(dialog).toBeVisible();
        for (const name of [
          'Take screenshot',
          'Open download menu',
          'Enable sound',
          'Piece controls',
          'Steer the piece',
          'Show hand gesture guide',
          'Expand piece to fullscreen',
        ]) {
          await expect(
            dialog.getByRole('button', { name, exact: name === 'Piece controls' }),
          ).toBeVisible();
        }
        const metrics = await frame.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const card = document.querySelector('.piece-stage-command-card');
          const cardBox = card?.getBoundingClientRect();
          return {
            frameRatio: box.width / box.height,
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: innerWidth,
            cardInside: Boolean(
              cardBox &&
              cardBox.x >= 0 &&
              cardBox.y >= 0 &&
              cardBox.right <= innerWidth &&
              cardBox.bottom <= innerHeight,
            ),
            cardOverflow: card ? getComputedStyle(card).overflowY : 'missing',
          };
        });
        expect(metrics.frameRatio).toBeCloseTo(16 / 9, 1);
        expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(metrics.cardInside).toBe(true);
        expect(['auto', 'scroll']).not.toContain(metrics.cardOverflow);
        await test.info().attach(`3d-immersive-cms-${viewport.name}`, {
          body: await anonymousPage.screenshot(),
          contentType: 'image/png',
        });
      }
      await anonymousPage.keyboard.press('Escape');
      await expect(toolbar.getByRole('dialog', { name: 'Preview actions' })).toBeHidden();
    } finally {
      await context.close();
    }

    await page.goto(`/projects3d/${projectId}`);
    const restoredToolbar = page
      .getByTestId('scene3d-preview-canvas-frame')
      .getByRole('toolbar', { name: 'Preview actions' });
    await restoredToolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await restoredToolbar.getByRole('button', { name: /Publication status: Published/ }).click();
    await restoredToolbar
      .locator('.publication-status-controls-panel')
      .getByRole('button', { name: 'Draft', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Draft (Private)');
  });
});

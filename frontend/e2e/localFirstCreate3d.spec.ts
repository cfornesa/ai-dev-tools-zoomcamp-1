import { expect, test, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Local-first 3D creation (#937)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`creates, edits, saves, and reloads a local-only 3D project at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/create');

      const serverCreateRequests: string[] = [];
      page.on('request', (request) => {
        if (
          request.method() === 'POST' &&
          /\/api\/projects3d(?:\/|$)/.test(new URL(request.url()).pathname)
        ) {
          serverCreateRequests.push(request.url());
        }
      });

      await page.getByRole('button', { name: 'Create a new 3D project', exact: true }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);
      await expect(page.getByRole('heading', { name: 'Untitled 3D scene' })).toBeVisible();
      expect(serverCreateRequests).toEqual([]);

      await page.getByRole('button', { name: '3D authoring' }).click();
      await page.getByRole('button', { name: 'Add sphere' }).click();
      await page.getByRole('button', { name: 'Add plane' }).click();
      await page.getByRole('button', { name: 'Add drawing plane' }).click();
      await page.getByRole('button', { name: 'Hide 3d authoring' }).click();
      await expect(page.getByText('Sphere 1')).toBeVisible();

      await page.getByRole('button', { name: 'Sphere 1', exact: true }).click();
      await page.getByLabel('Position X').fill('1');
      await page.getByLabel('Color', { exact: true }).fill('#22aa66');
      await page.getByLabel('Animation kind').selectOption('rotate');
      await expect(page.getByLabel('Animation axis')).toHaveValue('y');

      await page.getByRole('button', { name: '3D authoring' }).click();
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      await page.getByRole('button', { name: 'Hide 3d authoring' }).click();

      await page.getByRole('button', { name: 'Drawing plane 1', exact: true }).click();
      await page.getByTestId('draw-plane-button').click();
      await expect(page.getByTestId('ink-editor')).toBeVisible();
      await page.getByTestId('ink-tool-rect').click();
      const inkCanvas = page.getByTestId('ink-canvas');
      const inkBox = await inkCanvas.boundingBox();
      expect(inkBox).not.toBeNull();
      if (inkBox) {
        await page.mouse.move(inkBox.x + inkBox.width * 0.2, inkBox.y + inkBox.height * 0.2);
        await page.mouse.down();
        await page.mouse.move(inkBox.x + inkBox.width * 0.6, inkBox.y + inkBox.height * 0.6);
        await page.mouse.up();
      }
      await page.getByTestId('ink-confirm').click();
      await expect(page.getByTestId('ink-editor')).not.toBeVisible();

      const screenshotDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Take screenshot' }).first().click();
      expect((await screenshotDownload).suggestedFilename()).toMatch(/\.png$/);

      await page.getByRole('button', { name: 'Save scene' }).click();
      await expect(page.getByTestId('project3d-save-status')).toHaveText(/Saved as version 2/);

      await page.getByRole('button', { name: 'Sphere 1', exact: true }).click();
      await page.getByLabel('Position X').fill('2');
      await page.getByRole('button', { name: 'Save scene' }).click();
      await expect(page.getByTestId('project3d-save-status')).toHaveText(/Saved as version 3/);

      await page.getByRole('button', { name: 'Restore version 2', exact: true }).click();
      await expect(page.getByTestId('project3d-save-status')).toHaveText(/Saved as version 2/);

      await page.getByTestId('project3d-engine').selectOption('aframe');
      await expect(page.getByTestId('scene3d-preview-canvas-frame')).toBeVisible();
      await page.getByRole('button', { name: 'Save scene' }).click();
      await expect(page.getByTestId('project3d-save-status')).toHaveText(/Saved as version 4/);

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Untitled 3D scene' })).toBeVisible();
      await expect(page.getByText('Sphere 1')).toBeVisible();
      await expect(page.getByTestId('project3d-save-status')).toHaveText(/Saved as version 4/);
      await expect(page.getByTestId('project3d-engine')).toHaveValue('aframe');
      await page.screenshot({ path: testInfo.outputPath('local-first-3d.png'), fullPage: true });
    });
  }
});

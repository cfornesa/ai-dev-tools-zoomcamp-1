/** Issue #378: verify anonymous public 2D controls from their real route. */
import { expect, test } from '@playwright/test';

import { apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('anonymous public 2D stage chrome', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('exposes only permitted controls in a contained mobile/desktop overlay', async ({
    page,
    browser,
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
      title: 'Public 2D parity fixture',
      description: 'A public 2D stage control fixture.',
    });
    expect(metadata.ok()).toBe(true);
    await page.reload();

    const ownerToolbar = page.locator(
      '.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]',
    );
    await ownerToolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await ownerToolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
    await ownerToolbar.getByRole('button', { name: 'Published', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Publish', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status')).toContainText('Published (public)');

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`/p/${projectId}`);
    const toolbar = anonymousPage.locator(
      '.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]',
    );
    await expect(toolbar).toBeVisible();
    await expect(anonymousPage.getByRole('button', { name: 'Logout' })).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: /Publication status/i })).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: 'Open piece controls menu' })).toBeVisible();
    await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await anonymousPage.setViewportSize(viewport);
      const dialog = toolbar.getByRole('dialog', { name: 'Piece actions' });
      await expect(dialog).toBeVisible();
      for (const name of [
        'Take screenshot',
        'Open download menu',
        'Piece controls',
        'Expand piece to fullscreen',
      ]) {
        await expect(dialog.getByRole('button', { name, exact: true })).toBeVisible();
      }
      const geometry = await dialog.locator('.piece-stage-command-card').evaluate((card) => {
        const box = card.getBoundingClientRect();
        return {
          x: box.x,
          y: box.y,
          right: box.right,
          bottom: box.bottom,
          width: innerWidth,
          height: innerHeight,
          documentWidth: document.documentElement.scrollWidth,
          scrollable: ['auto', 'scroll'].includes(getComputedStyle(card).overflowY),
        };
      });
      expect(geometry.x).toBeGreaterThanOrEqual(0);
      expect(geometry.y).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.width);
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.width);
      expect(geometry.scrollable).toBe(false);
    }

    const screenshotDownload = anonymousPage.waitForEvent('download');
    await toolbar.getByRole('button', { name: 'Take screenshot' }).click();
    await screenshotDownload;

    await toolbar.getByRole('button', { name: 'Open download menu' }).click();
    const fullDownload = anonymousPage.waitForEvent('download');
    await toolbar.getByRole('menuitem', { name: 'Download Full' }).click();
    await fullDownload;

    const nativeFullscreen = await anonymousPage.evaluate(
      () =>
        document.fullscreenEnabled &&
        typeof Element.prototype.requestFullscreen === 'function' &&
        typeof document.exitFullscreen === 'function',
    );
    if (nativeFullscreen) {
      await toolbar.getByRole('button', { name: 'Expand piece to fullscreen' }).click();
      await expect
        .poll(() => anonymousPage.evaluate(() => Boolean(document.fullscreenElement)))
        .toBe(true);
      await toolbar.getByRole('button', { name: 'Exit fullscreen' }).click();
      await expect
        .poll(() => anonymousPage.evaluate(() => Boolean(document.fullscreenElement)))
        .toBe(false);
    }

    await anonymousPage.keyboard.press('Escape');
    await expect(toolbar.getByRole('dialog', { name: 'Piece actions' })).toBeHidden();
    await expect(toolbar.getByRole('button', { name: 'Open piece controls menu' })).toBeFocused();
    await anonymousContext.close();

    await page.goto(`/projects/${projectId}`);
    const ownerMenu = page.locator(
      '.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]',
    );
    await ownerMenu.getByRole('button', { name: 'Open piece controls menu' }).click();
    await ownerMenu.getByRole('button', { name: /Publication status: Published/ }).click();
    await ownerMenu
      .locator('.publication-status-controls-panel')
      .getByRole('button', { name: 'Draft', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status')).toContainText('Draft (private)');
  });
});

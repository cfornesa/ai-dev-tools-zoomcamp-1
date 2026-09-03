/** Issue #386: verify the anonymous regular 2D embed route independently. */
import { expect, test } from '@playwright/test';

import { apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('anonymous regular 2D embed stage chrome', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('keeps the chrome-less embed contained and exposes only public controls', async ({
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
      title: 'Regular 2D embed parity fixture',
      description: 'A route-specific embed control fixture.',
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
    try {
      await anonymousPage.goto(`/embed/p/${projectId}`);
      const toolbar = anonymousPage.locator(
        '.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]',
      );
      await expect(toolbar).toBeVisible();
      await expect(anonymousPage.locator('.app-shell-header')).toHaveCount(0);
      await expect(anonymousPage.getByRole('link', { name: 'Public gallery' })).toHaveCount(0);
      await expect(toolbar.getByRole('button', { name: 'Open piece controls menu' })).toBeVisible();
      await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();

      for (const viewport of [
        { name: 'desktop', width: 1280, height: 900 },
        { name: 'mobile', width: 375, height: 812 },
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
            viewportWidth: innerWidth,
            viewportHeight: innerHeight,
            documentWidth: document.documentElement.scrollWidth,
            overflowY: getComputedStyle(card).overflowY,
          };
        });
        expect(geometry.x).toBeGreaterThanOrEqual(0);
        expect(geometry.y).toBeGreaterThanOrEqual(0);
        expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
        expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
        expect(['auto', 'scroll']).not.toContain(geometry.overflowY);
        await test.info().attach(`embed-${viewport.name}`, {
          body: await anonymousPage.screenshot(),
          contentType: 'image/png',
        });
      }

      await toolbar.getByRole('button', { name: 'Open download menu' }).click();
      await expect(toolbar.getByRole('menuitem', { name: 'Download Full' })).toBeVisible();
      await expect(toolbar.getByRole('menuitem', { name: 'Download Non-Camera' })).toBeVisible();
      await anonymousPage.keyboard.press('Escape');
      await expect(toolbar.getByRole('dialog', { name: 'Piece actions' })).toBeHidden();
    } finally {
      await anonymousContext.close();
    }

    await page.goto(`/projects/${projectId}`);
    const restoredToolbar = page.locator(
      '.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]',
    );
    await restoredToolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
    await restoredToolbar.getByRole('button', { name: /Publication status: Published/ }).click();
    await restoredToolbar
      .locator('.publication-status-controls-panel')
      .getByRole('button', { name: 'Draft', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status')).toContainText('Draft (private)');

    const privateContext = await browser.newContext();
    const privatePage = await privateContext.newPage();
    try {
      await privatePage.goto(`/embed/p/${projectId}`);
      await expect(privatePage.getByText(/this project isn't available/i)).toBeVisible();
    } finally {
      await privateContext.close();
    }
  });
});

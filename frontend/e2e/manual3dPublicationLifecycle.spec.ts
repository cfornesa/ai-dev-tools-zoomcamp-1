/** Issue #376 (original): the manual 3D publication disclosure is one
 * focused route transaction, separate from the broader project
 * lifecycle/artifact suite.
 *
 * Issue #394 moved this disclosure out of the stage-local toolbar popover
 * `#376` originally added and into the editor header
 * (`PublishControl3D.tsx`'s non-`compact` branch), explicitly to remove the
 * "duplicate or hidden competing publication controls" #394's own closure
 * checklist named as a defect. This spec now exercises that header control
 * directly at both fixed viewports instead of the stage popover, which no
 * longer exists for the manual editor route. `#376` stays closed/immutable;
 * this file's coverage moved with the control, it wasn't reopened. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject3D } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('manual 3D publication lifecycle', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('publishes and restores the exact editor fixture at both required viewports', async ({
    page,
    browser,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createServerProject3D(page);
    expect(projectId).toBeTruthy();

    const status = page.getByTestId('visibility-status-3d');
    const publicationGroup = page.getByRole('group', { name: 'Publication status', exact: true });

    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(status).toContainText('Private');
      const publishButton = page.getByRole('button', { name: 'Publish', exact: true });
      await expect(publishButton).toBeVisible();

      const controlGeometry = await publicationGroup.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          x: box.x,
          right: box.right,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      expect(controlGeometry.x).toBeGreaterThanOrEqual(0);
      expect(controlGeometry.right).toBeLessThanOrEqual(controlGeometry.viewportWidth);
      expect(controlGeometry.documentWidth).toBeLessThanOrEqual(controlGeometry.viewportWidth);

      // The stage-local toolbar popover #376 originally added is gone --
      // there is exactly one Publication status control on this route now.
      await expect(page.getByRole('button', { name: 'Publication status: Draft' })).toHaveCount(0);
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(status).toContainText('Public');

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    await anonymousPage.goto(`/p3d/${projectId}`);
    await expect(anonymousPage.getByTestId('scene3d-preview-canvas-frame')).toBeVisible();
    await expect(
      anonymousPage.getByRole('button', { name: 'Piece controls', exact: true }),
    ).toBeVisible();
    await expect(anonymousPage.getByRole('button', { name: 'Logout' })).toHaveCount(0);

    await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await expect(status).toContainText('Private');

    await anonymousPage.reload();
    await expect(anonymousPage).toHaveURL(/\/gallery(?:\?.*)?$/);
    await anonymousContext.close();
  });
});

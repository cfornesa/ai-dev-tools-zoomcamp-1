/** Issue #487: verify the published structured-3D viewer does not emit
 * Three.js undefined-parameter warnings for objects whose valid material
 * omits the optional `emissive` property. */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { createServerProject3D } from './support/createProject3d.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function attachRenderedScreenshot(
  testInfo: import('@playwright/test').TestInfo,
  page: import('@playwright/test').Page,
  label: string,
): Promise<void> {
  const path = testInfo.outputPath(`${label}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(label, { path });
}

test.describe('published 3D viewer material warnings', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('loads a public 3D fixture without emissive and emits no Three.js emissive warnings', async ({
    browser,
    page,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createServerProject3D(page);

    // Add default sphere and plane objects. New objects are created with
    // material `{ color: ... }` and no `emissive`, which is the exact
    // scenario that previously triggered the Three.js warning. The editor's
    // inline Preview actions toolbar exposes the 3D authoring disclosure.
    const toolbar = page
      .getByTestId('scene3d-preview-canvas-frame')
      .getByRole('toolbar', { name: 'Preview actions' });
    await toolbar.getByRole('button', { name: '3D authoring' }).click();
    await toolbar.getByRole('button', { name: 'Add sphere' }).click();
    await toolbar.getByRole('button', { name: 'Add plane' }).click();
    // Persist the scene before publishing. In the current editor layout,
    // Save scene lives in the editor header while authoring stays in the
    // stage-local disclosure.
    await page.getByRole('button', { name: 'Save scene' }).click();
    await expect(page.getByTestId('project3d-save-status')).toContainText('Saved as version');
    await toolbar.getByRole('button', { name: 'Close 3d authoring' }).click();

    // Lift the sphere above the plane so both default-material objects are
    // visibly distinct in the rendered fixture -- at their shared origin
    // they would occlude each other and criterion 4's "rendered sphere and
    // stage remain visible" could not be inspected from the screenshot.
    await page
      .getByTestId('outline3d-list')
      .getByRole('button', { name: 'Sphere 1', exact: true })
      .click();
    await page.getByTestId('object-inspector').getByLabel('Position Y').fill('1.5');

    // Save the repositioned scene so the published version is the one under
    // test.
    await page.getByRole('button', { name: 'Save scene' }).click();
    await expect(page.getByTestId('project3d-save-status')).toContainText('Saved as version');

    // Publish the project so the anonymous public route is reachable.
    // Project3DWorkspace renders PublishControl3D non-compact: a plain
    // "Publish" header button (unlike the 2D editor's stage-local
    // "Publication status: Draft" popover), so this mirrors
    // embed3dStageChrome.spec.ts's dialog flow.
    await page
      .locator('.editor-publish-action')
      .getByRole('button', { name: 'Publish', exact: true })
      .click();
    const dialog = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    const consoleMessages: string[] = [];
    anonymousPage.on('console', (message) => {
      consoleMessages.push(message.text());
    });
    anonymousPage.on('pageerror', (error) => {
      consoleMessages.push(error.message);
    });

    await anonymousPage.goto(`/p3d/${projectId}`);

    const frame = anonymousPage.getByTestId('scene3d-preview-canvas-frame');
    await expect(frame).toBeVisible();

    const emissiveWarnings = consoleMessages.filter(
      (text) => text.includes("parameter 'emissive'") || text.includes('has value of undefined'),
    );
    expect(emissiveWarnings).toHaveLength(0);

    await attachRenderedScreenshot(testInfo, anonymousPage, 'public-3d-no-emissive-warning');
    await anonymousContext.close();
  });
});

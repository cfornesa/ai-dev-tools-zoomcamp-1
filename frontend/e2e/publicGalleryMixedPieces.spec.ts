/** Issue #392: the header gallery must discover published structured 2D and
 * 3D pieces through one anonymous-reachable listing. */
import { expect, test } from '@playwright/test';

import { apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function publishFrom2D(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  await page.getByRole('menuitem', { name: 'Create an AI-assisted animation' }).click();
  await page.waitForURL(/\/ai-projects\/[^/]+$/);
  const projectId = /\/ai-projects\/([^/]+)$/.exec(page.url())?.[1];
  expect(projectId).toBeTruthy();
  if (!projectId) return;

  const metadata = await apiPatch(page.context(), `/api/projects/${projectId}/`, {
    title: 'Gallery 2D fixture',
    description: 'A public gallery 2D fixture.',
  });
  expect(metadata.ok()).toBe(true);
  await page.reload();
  const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
  await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
  await toolbar
    .getByRole('dialog')
    .getByRole('button', { name: 'Publication status: Draft' })
    .click();
  await toolbar
    .getByRole('group', { name: 'Publication status', exact: true })
    .getByRole('button', { name: 'Published', exact: true })
    .click();
  const confirmation = page.getByRole('alertdialog', { name: /Publish/ });
  await confirmation.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status')).toContainText('Published (public)');
}

async function publishFrom3D(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
  await page.waitForURL(/\/projects3d\/[^/]+$/);
  const projectId = /\/projects3d\/([^/]+)$/.exec(page.url())?.[1];
  expect(projectId).toBeTruthy();
  if (!projectId) return;

  const metadata = await apiPatch(page.context(), `/api/projects3d/${projectId}/`, {
    title: 'Gallery 3D fixture',
  });
  expect(metadata.ok()).toBe(true);
  await page.reload();
  const frame = page.getByTestId('scene3d-preview-canvas-frame');
  const toolbar = frame.getByRole('toolbar', { name: 'Preview actions' });
  await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
  await toolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
  await toolbar
    .getByRole('group', { name: 'Publication status', exact: true })
    .getByRole('button', { name: 'Published', exact: true })
    .click();
  const confirmation = toolbar.getByRole('alertdialog', { name: /Publish/ });
  await confirmation.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');
}

test.describe('mixed public gallery', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('shows published 2D and 3D cards to anonymous visitors at desktop and mobile widths', async ({
    page,
    browser,
  }, testInfo) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await publishFrom2D(page);
    await publishFrom3D(page);

    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    try {
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 375, height: 812 },
      ]) {
        await anonymousPage.setViewportSize(viewport);
        await anonymousPage.goto('/gallery');
        await expect(anonymousPage.getByRole('heading', { name: 'Public gallery' })).toBeVisible();
        await expect(
          anonymousPage.getByRole('heading', { name: 'Gallery 2D fixture' }),
        ).toBeVisible();
        await expect(
          anonymousPage.getByRole('heading', { name: 'Gallery 3D fixture' }),
        ).toBeVisible();
        await expect(
          anonymousPage.getByRole('link', { name: /gallery 2d fixture/i }),
        ).toHaveAttribute('href', /\/p\//);
        await expect(
          anonymousPage.getByRole('link', { name: /gallery 3d fixture/i }),
        ).toHaveAttribute('href', /\/p3d\//);
        await anonymousPage.screenshot({
          path: testInfo.outputPath(`gallery-${viewport.width}.png`),
          fullPage: true,
        });
      }
    } finally {
      await anonymousContext.close();
    }
  });
});

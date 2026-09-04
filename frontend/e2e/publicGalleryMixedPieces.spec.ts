/** Issue #392: the header gallery must discover published structured 2D and
 * 3D pieces through one anonymous-reachable listing. */
import { expect, test } from '@playwright/test';

import { apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function publishFrom2D(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  await page.getByRole('menuitem', { name: 'Create an AI-assisted animation' }).click();
  await page.waitForURL(/\/ai-projects\/[^/]+$/);
  const projectId = /\/ai-projects\/([^/]+)$/.exec(page.url())?.[1];
  expect(projectId).toBeTruthy();
  if (!projectId) throw new Error('Could not determine the created 2D project id.');

  const metadata = await apiPatch(page.context(), `/api/projects/${projectId}/`, {
    // Issue #392: a per-run-unique title, not a hardcoded one --
    // this spec is exercised across multiple Playwright browser projects
    // (chromium/firefox/webkit) against the same disposable database within
    // one `browser-qa.sh` run, so a fixed title collides with an earlier
    // browser project's still-published fixture and makes every gallery
    // assertion below ambiguous (a strict-mode "resolved to 2 elements"
    // failure), not just flaky.
    title: `Gallery 2D fixture ${projectId}`,
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
  return projectId;
}

async function publishFrom3D(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  await page.getByRole('menuitem', { name: 'Create a new 3D project' }).click();
  await page.waitForURL(/\/projects3d\/[^/]+$/);
  const projectId = /\/projects3d\/([^/]+)$/.exec(page.url())?.[1];
  expect(projectId).toBeTruthy();
  if (!projectId) throw new Error('Could not determine the created 3D project id.');

  const metadata = await apiPatch(page.context(), `/api/projects3d/${projectId}/`, {
    // Same per-run-unique-title rationale as `publishFrom2D` above.
    title: `Gallery 3D fixture ${projectId}`,
  });
  expect(metadata.ok()).toBe(true);
  await page.reload();
  // Issue #394 moved the 3D editor's owner-facing publication disclosure and
  // Draft/Published switch out of the stage-local toolbar popover and into
  // the editor header (`PublishControl3D.tsx`'s non-`compact` branch), so
  // this reaches the group directly rather than opening the toolbar's piece
  // controls menu first.
  const status = page.getByRole('group', { name: 'Publication status', exact: true });
  await status.getByRole('button', { name: 'Published', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: /Publish/ });
  await confirmation.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status-3d')).toContainText('Public');
  return projectId;
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
    const project2dId = await publishFrom2D(page);
    const project3dId = await publishFrom3D(page);

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
        // Scoped by the exact project id (`PublicProjectCard.tsx`'s
        // `#public-project-<id>-title`) rather than by title text -- see the
        // per-run-unique-title comment in `publishFrom2D` above for why a
        // text-based match is ambiguous within one `browser-qa.sh` run.
        const card2d = anonymousPage.locator(`#public-project-${project2dId}-title`);
        const card3d = anonymousPage.locator(`#public-project-${project3dId}-title`);
        await expect(card2d).toBeVisible();
        await expect(card3d).toBeVisible();
        await expect(
          anonymousPage.getByRole('link', {
            name: new RegExp(`gallery 2d fixture ${project2dId}`, 'i'),
          }),
        ).toHaveAttribute('href', `/p/${project2dId}`);
        await expect(
          anonymousPage.getByRole('link', {
            name: new RegExp(`gallery 3d fixture ${project3dId}`, 'i'),
          }),
        ).toHaveAttribute('href', `/p3d/${project3dId}`);
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

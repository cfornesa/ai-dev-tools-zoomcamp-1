/** Issue #692: the legacy 2D ID route is a compatibility redirect.
 *
 * The old `/p/:id` entry point must not grow a second viewer shell. It
 * resolves the published record, replaces the URL with the canonical
 * profile-nested slug route, and therefore receives the same inline toolbar
 * as every other public piece entry point.
 */
import { expect, test, type Page } from '@playwright/test';

import { apiPatch } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function createPublishedProject(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'More creation options' }).click();
  await page.getByRole('menuitem', { name: 'Create a new animation' }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const projectId = /\/projects\/([^/]+)$/.exec(page.url())?.[1];
  if (!projectId) throw new Error(`Could not extract project id from ${page.url()}`);

  const metadata = await apiPatch(page.context(), `/api/projects/${projectId}/`, {
    title: 'Legacy 2D compatibility study',
    description: 'A published fixture for the canonical redirect contract.',
  });
  expect(metadata.ok()).toBe(true);
  await page.reload();

  const toolbar = page.locator('.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]');
  await toolbar.getByRole('button', { name: 'Open piece controls menu' }).click();
  await toolbar.getByRole('button', { name: 'Publication status: Draft' }).click();
  await toolbar.getByRole('button', { name: 'Published', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status')).toContainText('Published (public)');
  return projectId;
}

test.describe('legacy 2D compatibility route (#692)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('replaces /p/:id with the canonical profile-nested slug route and inline toolset', async ({
    page,
    browser,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createPublishedProject(page);
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();

    try {
      await anonymousPage.goto(`/p/${projectId}`);
      await anonymousPage.waitForURL(/\/users\/@[^/]+\/pieces\/[^/]+$/);

      const toolbar = anonymousPage.locator(
        '.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]',
      );
      await expect(toolbar).toBeVisible();
      await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
      await expect(toolbar.getByRole('button', { name: 'Open download menu' })).toBeVisible();
      await expect(
        toolbar.getByRole('button', { name: 'Expand piece to fullscreen' }),
      ).toBeVisible();
      await expect(toolbar.getByRole('button', { name: 'Open piece controls menu' })).toHaveCount(
        0,
      );
      await expect(anonymousPage.getByRole('button', { name: 'Embed', exact: true })).toBeVisible();
      // Structured 2D's capability matrix does not advertise VR, sound, or
      // hand-tracking controls, so those unsupported actions stay absent.
      await expect(toolbar.getByRole('button', { name: /VR|Sound|Hand tracking/i })).toHaveCount(0);
      await expect(anonymousPage.getByRole('link', { name: /immersive/i })).toHaveCount(0);
    } finally {
      await anonymousContext.close();
    }
  });
});

/** Issue #693: `/p3d/:id` is a compatibility redirect to the canonical 3D
 * piece route. The embed route remains a separate chrome-less surface. */
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test('replaces the legacy 3D ID route with the canonical slug route', async ({ page, browser }) => {
  const fixtures = requireE2EFixtures();
  await loginViaUI(page, fixtures.owner.email, fixtures.password);

  const created = await apiPost(page.context(), '/api/projects3d/', {});
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };
  await apiPatch(page.context(), `/api/projects3d/${project.id}/`, {
    title: `Legacy 3D compatibility ${project.id}`,
  });
  const published = await apiPost(page.context(), `/api/projects3d/${project.id}/publish/`);
  expect(published.status()).toBe(200);

  const profile = (await (await apiGet(page.context(), '/api/account/profile/')).json()) as {
    handle: string;
  };
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  try {
    await anonymousPage.goto(`/p3d/${project.id}`);
    await anonymousPage.waitForURL(/\/users\/@[^/]+\/pieces\/[^/]+$/);
    expect(anonymousPage.url()).toContain(`/users/@${profile.handle}/pieces/`);

    const toolbar = anonymousPage.getByRole('toolbar', { name: 'Preview actions' });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Open download menu' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Open piece controls menu' })).toHaveCount(0);
    await expect(anonymousPage.getByRole('button', { name: 'Embed', exact: true })).toBeVisible();
  } finally {
    await anonymousContext.close();
  }
});

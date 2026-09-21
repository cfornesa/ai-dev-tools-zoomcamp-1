/** Issue #638: canonical immersive structured pieces own the viewport and
 * use named compact controls without the legacy hamburger menu. */
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test('canonical immersive structured route matches the reference chrome', async ({
  page,
  browser,
}) => {
  const fixtures = requireE2EFixtures();
  await loginViaUI(page, fixtures.owner.email, fixtures.password);

  const created = await apiPost(page.context(), '/api/projects3d/', {});
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };
  await apiPatch(page.context(), `/api/projects3d/${project.id}/`, {
    title: `Canonical immersive fixture ${project.id}`,
  });
  expect((await apiPost(page.context(), `/api/projects3d/${project.id}/publish/`)).status()).toBe(
    200,
  );

  const profile = (await (await apiGet(page.context(), '/api/account/profile/')).json()) as {
    handle: string;
  };
  const publicProfile = (await (
    await apiGet(page.context(), `/api/users/@${profile.handle}/`)
  ).json()) as {
    profile: { display_name: string };
    pieces: Array<{ id: string; slug: string; type: string; title: string }>;
  };
  const piece = publicProfile.pieces.find((candidate) => candidate.id === project.id);
  if (!piece || piece.type !== '3d')
    throw new Error('Published immersive fixture was not discoverable.');

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  try {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await anonymousPage.setViewportSize(viewport);
      await anonymousPage.goto(`/users/@${profile.handle}/immersive/${piece.slug}`);
      await expect(
        anonymousPage.getByRole('heading', { name: piece.title, exact: true }),
      ).toBeVisible();
      await expect(
        anonymousPage.getByText(`By ${publicProfile.profile.display_name || profile.handle}`, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(anonymousPage.getByRole('note')).toContainText('arrow keys');
      await expect(anonymousPage.getByTestId('scene3d-preview-canvas-frame')).toBeVisible();
      await expect(
        anonymousPage.getByRole('button', { name: 'Open piece controls menu' }),
      ).toHaveCount(0);
      await expect(anonymousPage.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
      await expect(anonymousPage.getByRole('button', { name: 'Open download menu' })).toBeVisible();
      await expect(
        anonymousPage.getByRole('button', { name: 'Expand piece to fullscreen' }),
      ).toBeVisible();
      await expect(anonymousPage.getByRole('button', { name: 'Move forward' })).toBeVisible();
      await expect(anonymousPage.getByRole('button', { name: 'Zoom in' })).toBeVisible();
      await expect(anonymousPage.getByRole('button', { name: 'Zoom out' })).toBeVisible();
      await expect(anonymousPage.getByRole('button', { name: 'Embed (Custom)' })).toBeVisible();
      await expect(anonymousPage.getByRole('button', { name: 'Embed (CMS)' })).toBeVisible();
      expect(anonymousPage.url()).toContain(`/users/@${profile.handle}/immersive/${piece.slug}`);
      expect(
        await anonymousPage.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
      await anonymousPage.keyboard.press('Escape');
    }
  } finally {
    await anonymousContext.close();
  }
});

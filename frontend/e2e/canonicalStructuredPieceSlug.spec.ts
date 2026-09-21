/** Issue #636: structured 2D/3D pieces must render directly at their
 * canonical profile/slug routes, while the legacy UUID viewers remain
 * available as compatibility shims. */
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test('canonical structured piece routes render at desktop and mobile sizes', async ({
  page,
  browser,
}) => {
  const fixtures = requireE2EFixtures();
  await loginViaUI(page, fixtures.owner.email, fixtures.password);

  const created2d = await apiPost(page.context(), '/api/projects/blank/');
  expect(created2d.status()).toBe(201);
  const project2d = (await created2d.json()) as { id: string };
  await apiPatch(page.context(), `/api/projects/${project2d.id}/`, {
    title: `Canonical 2D fixture ${project2d.id}`,
    description: 'Canonical structured 2D route fixture.',
  });
  const published2d = await apiPost(page.context(), `/api/projects/${project2d.id}/publish/`);
  expect(published2d.status()).toBe(200);

  const created3d = await apiPost(page.context(), '/api/projects3d/', {});
  expect(created3d.status()).toBe(201);
  const project3d = (await created3d.json()) as { id: string };
  await apiPatch(page.context(), `/api/projects3d/${project3d.id}/`, {
    title: `Canonical 3D fixture ${project3d.id}`,
  });
  const published3d = await apiPost(page.context(), `/api/projects3d/${project3d.id}/publish/`);
  expect(published3d.status()).toBe(200);

  const profile = (await (await apiGet(page.context(), '/api/account/profile/')).json()) as {
    handle: string;
  };
  const publicProfileResponse = await apiGet(page.context(), `/api/users/@${profile.handle}/`);
  expect(publicProfileResponse.status()).toBe(200);
  const publicProfile = (await publicProfileResponse.json()) as {
    profile: { display_name: string };
    pieces: Array<{ id: string; slug: string; type: string; title: string }>;
  };
  const piece2d = publicProfile.pieces.find((piece) => piece.id === project2d.id);
  const piece3d = publicProfile.pieces.find((piece) => piece.id === project3d.id);
  expect(piece2d?.type).toBe('2d');
  expect(piece3d?.type).toBe('3d');
  if (!piece2d || !piece3d)
    throw new Error('Published structured pieces were not in the public profile.');

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  try {
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await anonymousPage.setViewportSize(viewport);

      await anonymousPage.goto(`/users/@${profile.handle}/pieces/${piece2d.slug}`);
      await expect(
        anonymousPage.getByRole('heading', { name: piece2d.title, exact: true }),
      ).toBeVisible();
      await expect(anonymousPage.getByTestId('public-scene-canvas')).toBeVisible();
      await expect(
        anonymousPage.getByText(`By ${publicProfile.profile.display_name || profile.handle}`, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        anonymousPage.getByRole('button', { name: 'Open piece controls menu' }),
      ).toHaveCount(0);
      await expect(anonymousPage.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
      await expect(anonymousPage.getByRole('button', { name: 'Open download menu' })).toBeVisible();
      await expect(anonymousPage.getByText('Canonical structured 2D route fixture.')).toBeVisible();
      expect(anonymousPage.url()).toContain(`/users/@${profile.handle}/pieces/${piece2d.slug}`);

      await anonymousPage.goto(`/users/@${profile.handle}/pieces/${piece3d.slug}`);
      await expect(
        anonymousPage.getByRole('heading', { name: piece3d.title, exact: true }),
      ).toBeVisible();
      await expect(anonymousPage.getByTestId('scene3d-preview-canvas-frame')).toBeVisible();
      await expect(
        anonymousPage.getByText(`By ${publicProfile.profile.display_name || profile.handle}`, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        anonymousPage.getByRole('button', { name: 'Open piece controls menu' }),
      ).toHaveCount(0);
      await expect(anonymousPage.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
      await expect(anonymousPage.getByRole('button', { name: 'Open download menu' })).toBeVisible();
      await expect(
        anonymousPage.getByRole('button', { name: 'View immersive piece' }),
      ).toBeVisible();
      await expect(anonymousPage.getByRole('link', { name: 'View immersive piece' })).toHaveCount(
        0,
      );
      expect(anonymousPage.url()).toContain(`/users/@${profile.handle}/pieces/${piece3d.slug}`);
    }
  } finally {
    await anonymousContext.close();
  }
});

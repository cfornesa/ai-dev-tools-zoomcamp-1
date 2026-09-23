/** Issue #737: canonical public 2D piece information architecture. */
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test('renders the canonical 2D payload sections and captures desktop/mobile evidence', async ({
  page,
  browser,
}, testInfo) => {
  const fixtures = requireE2EFixtures();
  await loginViaUI(page, fixtures.owner.email, fixtures.password);

  const created = await apiPost(page.context(), '/api/projects/blank/');
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };
  await apiPatch(page.context(), `/api/projects/${project.id}/`, {
    title: `Public 2D #737 ${project.id}`,
    description: 'A canonical public 2D piece for version-history evidence.',
  });
  const published = await apiPost(page.context(), `/api/projects/${project.id}/publish/`);
  expect(published.status()).toBe(200);

  const profile = (await (await apiGet(page.context(), '/api/account/profile/')).json()) as {
    handle: string;
    display_name: string;
  };
  const profileResponse = await apiGet(page.context(), `/api/users/@${profile.handle}/`);
  expect(profileResponse.status()).toBe(200);
  const profilePage = (await profileResponse.json()) as {
    pieces: Array<{ id: string; slug: string; type: string }>;
  };
  const piece = profilePage.pieces.find((candidate) => candidate.id === project.id);
  expect(piece?.type).toBe('2d');
  if (!piece) throw new Error('Published 2D fixture was not present in the public profile.');

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  try {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await anonymousPage.setViewportSize(viewport);
      await anonymousPage.goto(`/users/@${profile.handle}/pieces/${piece.slug}`);

      await expect(anonymousPage.getByText('2D scene', { exact: true })).toBeVisible();
      await expect(
        anonymousPage.getByRole('heading', { name: `Public 2D #737 ${project.id}`, exact: true }),
      ).toBeVisible();
      await expect(
        anonymousPage.getByText('2D scene · 1 version', { exact: true }),
      ).toBeVisible();
      await expect(
        anonymousPage.getByText('A canonical public 2D piece for version-history evidence.', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(anonymousPage.getByTestId('public-scene-canvas')).toBeVisible();
      await expect(anonymousPage.getByRole('group', { name: 'Piece actions' })).toBeVisible();
      await expect(
        anonymousPage.getByRole('heading', { name: 'Current version context' }),
      ).toBeVisible();
      await expect(anonymousPage.getByRole('heading', { name: 'Versions' })).toBeVisible();
      await expect(anonymousPage.getByText('CURRENT', { exact: true })).toBeVisible();

      await anonymousPage.screenshot({
        path: testInfo.outputPath(`public-2d-piece-${viewport.width}x${viewport.height}.png`),
        fullPage: true,
      });
    }
  } finally {
    await anonymousContext.close();
  }
});

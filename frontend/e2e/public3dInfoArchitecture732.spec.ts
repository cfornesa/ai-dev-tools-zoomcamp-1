/** Issue #732: the canonical public 3D piece page keeps its reference
 * information architecture and below-stage action group at desktop/mobile
 * viewports. */
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test('canonical public 3D page exposes metadata, actions, and version history', async ({
  page,
  browser,
}, testInfo) => {
  const fixtures = requireE2EFixtures();
  await loginViaUI(page, fixtures.owner.email, fixtures.password);

  const created = await apiPost(page.context(), '/api/projects3d/', {});
  expect(created.status()).toBe(201);
  const project = (await created.json()) as {
    id: string;
    current_version: { scene_json: Record<string, unknown> };
  };
  await apiPatch(page.context(), `/api/projects3d/${project.id}/`, {
    title: `Canonical info architecture ${project.id}`,
    description: 'A public 3D fixture with a version history.',
  });
  const secondVersion = await apiPost(page.context(), `/api/projects3d/${project.id}/versions/`, {
    scene_json: project.current_version.scene_json,
  });
  expect(secondVersion.status()).toBe(201);
  const published = await apiPost(page.context(), `/api/projects3d/${project.id}/publish/`);
  expect(published.status()).toBe(200);

  const profile = (await (await apiGet(page.context(), '/api/account/profile/')).json()) as {
    handle: string;
  };
  const publicProfile = (await (
    await apiGet(page.context(), `/api/users/@${profile.handle}/`)
  ).json()) as { pieces: Array<{ id: string; slug: string }> };
  const piece = publicProfile.pieces.find((candidate) => candidate.id === project.id);
  if (!piece) throw new Error('Published 3D fixture was not discoverable from the profile.');

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  try {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 375, height: 812 },
    ]) {
      await anonymousPage.setViewportSize(viewport);
      await anonymousPage.goto(`/users/@${profile.handle}/pieces/${piece.slug}`);
      await expect(
        anonymousPage.getByRole('heading', { name: `Canonical info architecture ${project.id}` }),
      ).toBeVisible();
      await expect(anonymousPage.getByText('3D scene', { exact: true })).toBeVisible();
      await expect(
        anonymousPage.getByText('A public 3D fixture with a version history.', { exact: true }),
      ).toBeVisible();
      await expect(
        anonymousPage.getByRole('heading', { name: 'Current version context' }),
      ).toBeVisible();
      await expect(anonymousPage.getByRole('heading', { name: 'Versions' })).toBeVisible();
      await expect(anonymousPage.getByText('CURRENT', { exact: true })).toBeVisible();

      const stage = anonymousPage.getByRole('region', { name: 'Preview' });
      const actions = anonymousPage.getByRole('group', { name: 'Piece actions' });
      expect(
        await stage.evaluate(
          (element, actionElement) =>
            Boolean(
              actionElement &&
              element.compareDocumentPosition(actionElement) & Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          await actions.elementHandle(),
        ),
      ).toBe(true);
      await expect(
        anonymousPage.getByRole('button', { name: 'Open immersive view' }),
      ).toBeVisible();
      await expect(anonymousPage.getByRole('button', { name: 'Share' })).toBeVisible();
      await expect(anonymousPage.getByRole('button', { name: 'Embed' })).toBeVisible();
      await anonymousPage.screenshot({
        path: testInfo.outputPath(`public-3d-info-architecture-${viewport.name}.png`),
        fullPage: true,
      });
    }
  } finally {
    await anonymousContext.close();
  }
});

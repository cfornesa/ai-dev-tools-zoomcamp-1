/** Issue #733: canonical immersive 3D metadata/actions live below the stage. */
import { expect, test } from '@playwright/test';

import { apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test('canonical immersive 3D page exposes below-stage metadata and version history', async ({
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
  const metadata = await apiPatch(page.context(), `/api/projects3d/${project.id}/`, {
    title: `Immersive info architecture ${project.id}`,
    seo_config: { description: 'A below-stage immersive 3D fixture.' },
  });
  expect(metadata.status()).toBe(200);
  const secondVersion = await apiPost(page.context(), `/api/projects3d/${project.id}/versions/`, {
    scene_json: project.current_version.scene_json,
  });
  expect(secondVersion.status()).toBe(201);
  expect((await apiPost(page.context(), `/api/projects3d/${project.id}/publish/`)).status()).toBe(
    200,
  );

  const profile = (await (await apiGet(page.context(), '/api/account/profile/')).json()) as {
    handle: string;
  };
  const publicProfile = (await (
    await apiGet(page.context(), `/api/users/@${profile.handle}/`)
  ).json()) as {
    pieces: Array<{ id: string; slug: string; type: string }>;
  };
  const piece = publicProfile.pieces.find(
    (candidate) => candidate.id === project.id && candidate.type === '3d',
  );
  if (!piece) throw new Error('Published immersive 3D fixture was not discoverable.');

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  try {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 375, height: 812 },
    ]) {
      await anonymousPage.setViewportSize(viewport);
      await anonymousPage.goto(`/users/@${profile.handle}/immersive/${piece.slug}`);

      const stage = anonymousPage.getByRole('region', { name: 'Preview' });
      const info = anonymousPage.getByTestId('immersive-info-block');
      await expect(stage).toBeVisible();
      await expect(info).toBeVisible();
      await expect(
        info.getByRole('heading', { name: `Immersive info architecture ${project.id}` }),
      ).toBeVisible();
      await expect(
        info.getByText('A below-stage immersive 3D fixture.', { exact: true }),
      ).toBeVisible();
      await expect(info.getByRole('button', { name: 'Share' })).toBeVisible();
      await expect(info.getByRole('button', { name: 'Embed (Custom)' })).toBeVisible();
      await expect(info.getByRole('button', { name: 'Embed (CMS)' })).toBeVisible();
      await expect(info.getByRole('heading', { name: 'Current version context' })).toBeVisible();
      await expect(info.getByRole('heading', { name: 'Versions' })).toBeVisible();
      await expect(info.getByText('CURRENT', { exact: true })).toBeVisible();
      expect(
        await stage.evaluate(
          (element, infoElement) =>
            Boolean(
              infoElement &&
              element.compareDocumentPosition(infoElement) & Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          await info.elementHandle(),
        ),
      ).toBe(true);

      await anonymousPage.screenshot({
        path: testInfo.outputPath(`public-3d-immersive-info-${viewport.name}.png`),
        fullPage: true,
      });
    }
  } finally {
    await anonymousContext.close();
  }
});

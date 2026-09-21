import { expect, test, type TestInfo } from '@playwright/test';

import { apiDelete, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 812 },
  { width: 375, height: 812 },
];

test.describe('public collection context (#566)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`shows public collection links below an authored viewer at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }, testInfo: TestInfo) => {
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      await ownerPage.setViewportSize(viewport);
      await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);

      const profile = await ownerContext.request.get('/api/account/profile/');
      const handle = ((await profile.json()) as { handle: string }).handle;
      const projectResponse = await apiPost(ownerContext, '/api/projects/blank/', {});
      expect(projectResponse.status()).toBe(201);
      const project = (await projectResponse.json()) as { id: string };
      const metadata = await apiPatch(ownerContext, `/api/projects/${project.id}/`, {
        title: `Context project ${viewport.width}`,
        description: 'A responsive collection context fixture.',
      });
      expect(metadata.status()).toBe(200);
      expect((await apiPost(ownerContext, `/api/projects/${project.id}/publish/`)).status()).toBe(
        200,
      );

      const collectionResponse = await apiPost(ownerContext, '/api/account/collections/', {
        title: `Context collection ${viewport.width}`,
      });
      expect(collectionResponse.status()).toBe(201);
      const collection = (await collectionResponse.json()) as { id: string; slug: string };
      expect(
        (
          await apiPost(ownerContext, `/api/account/collections/${collection.id}/items/`, {
            items: [{ kind: 'project', id: project.id }],
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await apiPost(ownerContext, `/api/account/collections/${collection.id}/publish/`)
        ).status(),
      ).toBe(200);

      await ownerPage.goto(`/p/${project.id}`);
      await expect(
        ownerPage.getByRole('heading', { name: `Context project ${viewport.width}` }),
      ).toBeVisible();
      const collectionLink = ownerPage.getByRole('link', {
        name: `Context collection ${viewport.width}`,
      });
      await expect(collectionLink).toHaveAttribute(
        'href',
        `/users/@${handle}/collections/context-collection-${viewport.width}`,
      );
      await ownerPage.screenshot({
        path: testInfo.outputPath(`collection-context-${viewport.width}.png`),
        fullPage: true,
      });

      const embedPage = await ownerContext.newPage();
      await embedPage.goto(`/embed/p/${project.id}`);
      await expect(
        embedPage.getByRole('link', { name: `Context collection ${viewport.width}` }),
      ).toHaveCount(0);

      await apiDelete(ownerContext, `/api/account/collections/${collection.id}/`);
      await apiDelete(ownerContext, `/api/projects/${project.id}/`);
      await ownerContext.close();
    });
  }
});

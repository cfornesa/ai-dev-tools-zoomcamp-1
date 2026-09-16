import { expect, test } from '@playwright/test';

import { apiDelete, apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('owner collections API boundary (#567)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`keeps owner and public collection states isolated at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }) => {
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      await ownerPage.setViewportSize(viewport);
      await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);

      const profile = await apiGet(ownerContext, '/api/account/profile/');
      expect(profile.ok()).toBe(true);
      const handle = ((await profile.json()) as { handle: string }).handle;
      const created = await apiPost(ownerContext, '/api/account/collections/', {
        title: `Browser collection ${viewport.width}`,
      });
      expect(created.status()).toBe(201);
      const collection = (await created.json()) as { id: string; slug: string };

      const edited = await apiPatch(ownerContext, `/api/account/collections/${collection.id}/`, {
        description: 'A browser-verified collection.',
      });
      expect(edited.ok()).toBe(true);
      const reordered = await apiPost(
        ownerContext,
        `/api/account/collections/${collection.id}/items/`,
        { items: [] },
      );
      expect(reordered.ok()).toBe(true);
      expect((await reordered.json()).items).toEqual([]);

      const publish = await apiPost(
        ownerContext,
        `/api/account/collections/${collection.id}/publish/`,
      );
      expect(publish.ok()).toBe(true);
      const publicRead = await apiGet(
        ownerContext,
        `/api/public/collections/${handle}/${collection.slug}/`,
      );
      expect(publicRead.ok()).toBe(true);
      expect((await publicRead.json()).items).toEqual([]);

      const otherContext = await browser.newContext();
      const otherPage = await otherContext.newPage();
      await loginViaUI(otherPage, fixtures.other.email, fixtures.password);
      expect(
        (await apiGet(otherContext, `/api/account/collections/${collection.id}/`)).status(),
      ).toBe(404);
      await otherContext.close();

      const unpublish = await apiPost(
        ownerContext,
        `/api/account/collections/${collection.id}/unpublish/`,
      );
      expect(unpublish.ok()).toBe(true);
      expect(
        (
          await apiGet(ownerContext, `/api/public/collections/${handle}/${collection.slug}/`)
        ).status(),
      ).toBe(404);
      expect(
        (await apiDelete(ownerContext, `/api/account/collections/${collection.id}/`)).status(),
      ).toBe(204);
      await ownerContext.close();
    });
  }
});

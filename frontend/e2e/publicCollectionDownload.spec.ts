import { expect, test } from '@playwright/test';

import { apiDelete, apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('public collection count and download (#823)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`shows count and downloads the complete collection at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }, testInfo) => {
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
      const profile = await apiGet(ownerContext, '/api/account/profile/');
      const handle = ((await profile.json()) as { handle: string }).handle;
      const projectIds: string[] = [];
      let collectionId = '';

      try {
        for (const title of ['Download first', 'Download second', 'Download third']) {
          const created = await apiPost(ownerContext, '/api/projects/blank/', {});
          expect(created.status()).toBe(201);
          const project = (await created.json()) as { id: string };
          projectIds.push(project.id);
          expect(
            (
              await apiPatch(ownerContext, `/api/projects/${project.id}/`, {
                title,
                description: 'Download fixture.',
              })
            ).status(),
          ).toBe(200);
          expect(
            (await apiPost(ownerContext, `/api/projects/${project.id}/publish/`)).status(),
          ).toBe(200);
        }

        const created = await apiPost(ownerContext, '/api/account/collections/', {
          title: `Download collection ${viewport.width}`,
          description: 'A complete collection download fixture.',
        });
        expect(created.status()).toBe(201);
        const collection = (await created.json()) as { id: string; slug: string };
        collectionId = collection.id;
        expect(
          (
            await apiPost(ownerContext, `/api/account/collections/${collection.id}/items/`, {
              items: projectIds.map((id) => ({ kind: 'project', id })),
            })
          ).status(),
        ).toBe(200);
        expect(
          (
            await apiPost(ownerContext, `/api/account/collections/${collection.id}/publish/`)
          ).status(),
        ).toBe(200);

        const page = await browser.newPage();
        await page.setViewportSize(viewport);
        await page.goto(`/users/@${handle}/collections/${collection.slug}`);
        await expect(page.getByText('3 items', { exact: true })).toBeVisible();
        const downloadLink = page.getByRole('link', { name: 'Download complete collection' });
        await expect(downloadLink).toHaveAttribute(
          'href',
          `/api/public/collections/${handle}/${collection.slug}/download/`,
        );
        const [response, download] = await Promise.all([
          page.waitForResponse((candidate) => candidate.url().includes('/download/')),
          page.waitForEvent('download'),
          downloadLink.click(),
        ]);
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('application/zip');
        expect(download.suggestedFilename()).toBe(`${collection.slug}.zip`);
        await page.screenshot({
          path: testInfo.outputPath(`public-collection-download-${viewport.width}.png`),
          fullPage: true,
        });
        await page.close();
      } finally {
        if (collectionId)
          await apiDelete(ownerContext, `/api/account/collections/${collectionId}/`);
        for (const id of projectIds) await apiDelete(ownerContext, `/api/projects/${id}/`);
        await ownerContext.close();
      }
    });
  }
});

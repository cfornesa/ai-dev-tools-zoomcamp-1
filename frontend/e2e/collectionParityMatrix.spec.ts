import { expect, test } from '@playwright/test';

import { apiDelete, apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('collection external parity matrix (#804)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`asserts same collection rows at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }, testInfo) => {
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
      const profileResponse = await apiGet(ownerContext, '/api/account/profile/');
      const handle = ((await profileResponse.json()) as { handle: string }).handle;
      const projectIds: string[] = [];

      try {
        for (const [index, title] of [
          'Collection first',
          'Collection second',
          'Collection third',
        ].entries()) {
          const created = await apiPost(ownerContext, '/api/projects/blank/', {});
          expect(created.status()).toBe(201);
          const project = (await created.json()) as { id: string };
          projectIds.push(project.id);
          expect(
            (
              await apiPatch(ownerContext, `/api/projects/${project.id}/`, {
                title,
                description: `Collection item ${index + 1}.`,
              })
            ).status(),
          ).toBe(200);
          expect(
            (await apiPost(ownerContext, `/api/projects/${project.id}/publish/`)).status(),
          ).toBe(200);
        }

        const created = await apiPost(ownerContext, '/api/account/collections/', {
          title: `Parity collection ${viewport.width}`,
          description: 'A three-item collection parity fixture.',
        });
        expect(created.status()).toBe(201);
        const collection = (await created.json()) as { id: string; slug: string };
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
        await expect(
          page.getByRole('heading', { name: `Parity collection ${viewport.width}` }),
        ).toBeVisible();
        await expect(
          page.getByText('A three-item collection parity fixture.', { exact: true }),
        ).toBeVisible();
        await expect(page.getByRole('link', { name: `@${handle}` })).toBeVisible();
        await expect(page.getByRole('list', { name: 'Collection items' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Open immersive collection' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Embed' })).toBeVisible();
        await page.getByRole('button', { name: 'Embed' }).click();
        await expect(page.locator('#collection-embed-snippet')).toContainText(
          '/embed/collections/',
        );
        await page.screenshot({
          path: testInfo.outputPath(`collection-parity-${viewport.width}.png`),
          fullPage: true,
        });
        await page.close();
        await apiDelete(ownerContext, `/api/account/collections/${collection.id}/`);
      } finally {
        for (const id of projectIds) await apiDelete(ownerContext, `/api/projects/${id}/`);
        await ownerContext.close();
      }
    });
  }
});

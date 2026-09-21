import { expect, test, type TestInfo } from '@playwright/test';

import { apiDelete, apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('collection management and public routes (#568)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`covers owner management and anonymous public view at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }, testInfo: TestInfo) => {
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      await ownerPage.setViewportSize(viewport);
      await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);

      const profile = await apiGet(ownerContext, '/api/account/profile/');
      const handle = ((await profile.json()) as { handle: string }).handle;
      const created = await apiPost(ownerContext, '/api/account/collections/', {
        title: `Responsive collection ${viewport.width}`,
        description: 'A public collection browser fixture.',
      });
      expect(created.status()).toBe(201);
      const collection = (await created.json()) as { id: string; slug: string; title: string };

      await ownerPage.goto('/account/collections');
      await expect(ownerPage.getByRole('heading', { name: 'My collections' })).toBeVisible();
      await expect(ownerPage.getByRole('heading', { name: 'Edit collection' })).toBeVisible();
      await ownerPage.getByRole('button', { name: 'Save details' }).click();
      await expect(ownerPage.getByText('Collection details saved.', { exact: true })).toBeVisible();
      await ownerPage.getByRole('button', { name: 'Publish collection' }).click();
      await expect(ownerPage.getByText('Collection published.', { exact: true })).toBeVisible();

      const publicLink = ownerPage.getByRole('link', { name: 'View public collection' });
      await expect(publicLink).toBeVisible();
      await expect(publicLink).toHaveAttribute(
        'href',
        `/users/@${handle}/collections/${collection.slug}`,
      );
      await ownerPage.screenshot({
        path: testInfo.outputPath(`collection-management-${viewport.width}.png`),
        fullPage: true,
      });

      const anonymousContext = await browser.newContext();
      const anonymousPage = await anonymousContext.newPage();
      await anonymousPage.setViewportSize(viewport);
      await anonymousPage.goto(`/users/@${handle}/collections/${collection.slug}`);
      await expect(
        anonymousPage.getByRole('heading', { name: `Responsive collection ${viewport.width}` }),
      ).toBeVisible();
      await expect(
        anonymousPage.getByText('This collection has no public items yet.', { exact: true }),
      ).toBeVisible();
      await expect(anonymousPage.getByRole('button', { name: 'Embed' })).toBeVisible();
      await expect(
        anonymousPage.getByRole('link', { name: 'Open immersive collection' }),
      ).toBeVisible();
      await anonymousPage.getByRole('button', { name: 'Embed' }).click();
      await expect(anonymousPage.locator('#collection-embed-snippet')).toHaveValue(
        `<iframe src="${anonymousPage.url().split('/users/')[0]}/embed/collections/@${handle}/${collection.slug}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`,
      );
      await anonymousPage.screenshot({
        path: testInfo.outputPath(`collection-public-${viewport.width}.png`),
        fullPage: true,
      });
      await anonymousContext.close();

      const ordinaryContext = await browser.newContext();
      const ordinaryPage = await ordinaryContext.newPage();
      await loginViaUI(ordinaryPage, fixtures.other.email, fixtures.password);
      await ordinaryPage.goto('/account/collections');
      await expect(ordinaryPage.getByRole('heading', { name: 'My collections' })).toBeVisible();
      await expect(ordinaryPage.getByText('No collections yet.', { exact: true })).toBeVisible();
      await expect(ordinaryPage.getByText(collection.title, { exact: true })).toHaveCount(0);
      await ordinaryContext.close();

      expect(
        (await apiDelete(ownerContext, `/api/account/collections/${collection.id}/`)).status(),
      ).toBe(204);
      await ownerContext.close();
    });
  }
});

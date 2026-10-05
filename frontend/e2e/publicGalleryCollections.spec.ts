import { expect, test, type TestInfo } from '@playwright/test';

import { apiDelete, apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 812 },
  { width: 375, height: 812 },
];

test.describe('public gallery collection mode (#565)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`shows a published collection in addressable modes at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }, testInfo: TestInfo) => {
      const ownerContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
      const profileResponse = await apiGet(ownerContext, '/api/account/profile/');
      const handle = ((await profileResponse.json()) as { handle: string }).handle;
      const created = await apiPost(ownerContext, '/api/account/collections/', {
        title: `Gallery collection ${viewport.width}`,
        description: 'Crawlable collection description',
      });
      expect(created.status()).toBe(201);
      const collection = (await created.json()) as { id: string; slug: string; title: string };
      expect(
        (
          await apiPost(ownerContext, `/api/account/collections/${collection.id}/publish/`)
        ).status(),
      ).toBe(200);

      const anonymousContext = await browser.newContext();
      const anonymousPage = await anonymousContext.newPage();
      const noJavaScriptContext = await browser.newContext({ javaScriptEnabled: false });
      const noJavaScriptPage = await noJavaScriptContext.newPage();
      const noJavaScriptResponse = await noJavaScriptPage.goto('/collections');
      expect(noJavaScriptResponse?.status()).toBe(200);
      await expect(
        noJavaScriptPage.getByRole('heading', { name: 'Public collections' }),
      ).toBeVisible();
      await expect(noJavaScriptPage.getByRole('link', { name: collection.title })).toHaveAttribute(
        'href',
        `/users/@${handle}/collections/${collection.slug}`,
      );
      expect(
        await noJavaScriptPage.locator('noscript').evaluate((element) => element.outerHTML),
      ).toContain('Crawlable collection description');
      await noJavaScriptContext.close();

      await anonymousPage.setViewportSize(viewport);
      await anonymousPage.goto('/gallery?type=collections');
      await expect(anonymousPage.getByRole('heading', { name: 'Public gallery' })).toBeVisible();
      const card = anonymousPage.getByTestId(`gallery-card-${collection.id}`);
      await expect(card).toBeVisible();
      await expect(card.getByRole('link', { name: collection.title })).toHaveAttribute(
        'href',
        `/users/@${handle}/collections/${collection.slug}`,
      );
      await anonymousPage.screenshot({
        path: testInfo.outputPath(`public-gallery-collections-${viewport.width}.png`),
        fullPage: true,
      });
      await anonymousContext.close();
      await apiDelete(ownerContext, `/api/account/collections/${collection.id}/`);
      await ownerContext.close();
    });
  }
});

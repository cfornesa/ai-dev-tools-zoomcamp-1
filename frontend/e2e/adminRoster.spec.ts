import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('managed application-admin roster (#560)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`grants and revokes a resolved local account at ${viewport.width}x${viewport.height}`, async ({
      browser,
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.admin.email, fixtures.password);
      const clearAccess = await apiPost(page.context(), '/api/admin/content/access/', {
        identifier: fixtures.other.username,
        granted: false,
      });
      expect(clearAccess.ok()).toBe(true);
      await page.goto('/admin/content');
      await expect(page.getByRole('heading', { name: 'Application-admin access' })).toBeVisible();
      await expect(page.getByRole('list', { name: 'Application administrators' })).toBeVisible();
      const form = page.getByRole('form', { name: 'Application-admin access' });
      await form.getByLabel('Username').fill(fixtures.other.username);
      await form.getByRole('button', { name: 'Grant access' }).click();
      const rosterRow = page
        .getByRole('list', { name: 'Application administrators' })
        .getByRole('listitem')
        .filter({ hasText: fixtures.other.username });
      await expect(rosterRow).toBeVisible();
      await expect(page.getByText(/Application-admin access granted/)).toBeVisible();

      const roster = await apiGet(page.context(), '/api/admin/content/access/');
      expect(roster.ok()).toBe(true);
      expect(
        (await roster.json()).some(
          (entry: { username: string }) => entry.username === fixtures.other.username,
        ),
      ).toBe(true);

      await rosterRow.getByRole('button', { name: 'Revoke' }).click();
      await expect(rosterRow).toHaveCount(0);

      const ordinaryContext = await browser.newContext();
      const ordinaryPage = await ordinaryContext.newPage();
      await loginViaUI(ordinaryPage, fixtures.other.email, fixtures.password);
      const ordinaryApi = await apiGet(ordinaryContext, '/api/admin/content/');
      expect(ordinaryApi.status()).toBe(403);
      await ordinaryPage.goto('/admin/content');
      await expect(ordinaryPage).toHaveURL(/\/studio$/);
      await ordinaryContext.close();

      const anonymousContext = await browser.newContext();
      const anonymousPage = await anonymousContext.newPage();
      const anonymousApi = await apiGet(anonymousContext, '/api/admin/content/');
      expect(anonymousApi.status()).toBe(401);
      await anonymousPage.goto('/admin/content');
      await expect(anonymousPage).toHaveURL(/\/gallery$/);
      await anonymousContext.close();
    });
  }
});

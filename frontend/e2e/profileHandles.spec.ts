import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { apiGet, apiPatch } from './support/api.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

async function profile(context: BrowserContext) {
  const response = await apiGet(context, '/api/account/profile/');
  expect(response.ok()).toBe(true);
  return response.json() as Promise<Record<string, unknown> & { revision: number }>;
}

async function setHandle(context: BrowserContext, handle: string) {
  const current = await profile(context);
  const response = await apiPatch(context, '/api/account/profile/', {
    ...current,
    handle,
  });
  expect(response.ok()).toBe(true);
  return response.json();
}

async function signInOther(browser: Browser, email: string, password: string) {
  const context = await browser.newContext({ baseURL: 'http://localhost:5000' });
  const page = await context.newPage();
  await loginViaUI(page, email, password);
  return { context, page };
}

test.describe('public handle lifecycle (#551)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`generates, changes, validates, and redirects handles at ${viewport.width}x${viewport.height}`, async ({
      page,
      browser,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);

      const generated = await profile(page.context());
      expect(generated.handle).toMatch(/^[a-z0-9](?:[a-z0-9_-]{0,30}[a-z0-9])?$/);
      const oldHandle = generated.handle as string;
      const changedHandle = `qa-owner-${viewport.width}`;
      await setHandle(page.context(), changedHandle);

      const other = await signInOther(browser, fixtures.other.email, fixtures.password);
      const collisionHandle = `qa-collision-${viewport.width}`;
      await setHandle(other.page.context(), collisionHandle);
      await other.context.close();

      await page.goto('/account/settings');
      const handleInput = page.getByLabel('Handle');
      await expect(handleInput).toHaveValue(changedHandle);
      await handleInput.fill(collisionHandle);
      await page.getByRole('button', { name: 'Save profile' }).click();
      await expect(page.locator('#profile-handle-error')).toContainText('already in use');
      await expect(handleInput).toHaveValue(collisionHandle);

      await handleInput.fill('admin');
      await page.getByRole('button', { name: 'Save profile' }).click();
      await expect(page.locator('#profile-handle-error')).toContainText('reserved');
      await expect(handleInput).toHaveValue('admin');

      await page.goto(`/users/@${oldHandle}`);
      await expect(page.getByText(`@${changedHandle}`)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/users/@${changedHandle}$`));
      await page.screenshot({ path: testInfo.outputPath('public-profile-handle.png') });
    });
  }
});

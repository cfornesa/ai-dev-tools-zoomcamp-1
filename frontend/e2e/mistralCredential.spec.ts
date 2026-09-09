/**
 * Real-browser coverage for the personal Mistral credential journey via the
 * generic provider-credentials card.
 *
 * This deliberately uses a test-shaped placeholder rather than a real Mistral
 * secret: the credential endpoint encrypts and stores it without contacting
 * Mistral. The browser still exercises the real authenticated UI, CSRF/session
 * cookies, Vite proxy, Django endpoint, reload behavior, and removal flow.
 *
 * `AccountSettings.tsx` renders a single `ProviderCredentialCards` list for all
 * vendors; the Mistral row is the only place the key can be saved, replaced, or
 * removed. The legacy standalone Mistral-only form and its backing
 * `/api/account/mistral-credential/` endpoint were retired in issue #500.
 */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function assertWithinViewportWidth(
  locator: import('@playwright/test').Locator,
): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewportSize = locator.page().viewportSize();
  expect(viewportSize).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportSize!.width);
}

async function runMistralCredentialFlow(
  page: import('@playwright/test').Page,
  viewportSlug: string,
): Promise<void> {
  const testKey = 'sk-e2e-browser-key-12345';
  const testInfo = test.info();

  const mistralCard = page
    .locator('.account-settings-list > .account-settings-section')
    .filter({ has: page.getByLabel('Mistral API key') });
  const keyInput = mistralCard.getByLabel('Mistral API key');
  const saveButton = mistralCard.getByRole('button', { name: 'Save key', exact: true });
  const replaceButton = mistralCard.getByRole('button', { name: 'Replace key', exact: true });
  const removeButton = mistralCard.getByRole('button', { name: 'Remove key', exact: true });

  await expect(keyInput).toBeVisible();
  await assertWithinViewportWidth(keyInput);
  await assertWithinViewportWidth(saveButton);

  // Keyboard-focus the input, then verify it is reachable via Shift+Tab
  // from the Save key button once that button is enabled.
  await keyInput.focus();
  await expect(keyInput).toBeFocused();
  await keyInput.fill(testKey);
  await saveButton.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(keyInput).toBeFocused();

  await saveButton.click();

  await expect(page.getByText('Mistral key: configured', { exact: true })).toBeVisible();
  await expect(keyInput).toHaveValue('');
  await expect(page.locator('body')).not.toContainText(testKey);
  await assertWithinViewportWidth(keyInput);
  await assertWithinViewportWidth(replaceButton);
  await assertWithinViewportWidth(removeButton);

  await testInfo.attach(`account-settings-${viewportSlug}-configured.png`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  await page.reload();
  await expect(page.getByText('Mistral key: configured', { exact: true })).toBeVisible();
  await expect(keyInput).toHaveValue('');
  await expect(page.locator('body')).not.toContainText(testKey);
  await expect(replaceButton).toBeVisible();

  await keyInput.fill(testKey);
  await replaceButton.click();

  await expect(page.getByText('Mistral key: configured', { exact: true })).toBeVisible();
  await expect(keyInput).toHaveValue('');
  await expect(page.locator('body')).not.toContainText(testKey);

  await removeButton.click();

  await expect(page.getByText('Mistral key: not configured', { exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(testKey);

  await testInfo.attach(`account-settings-${viewportSlug}-not-configured.png`, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
}

test.describe('Personal Mistral credential settings', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const hamburger = page.locator('.app-shell-hamburger');
    if ((await hamburger.count()) > 0 && (await hamburger.isVisible())) {
      await hamburger.click();
    }
    await page.getByRole('link', { name: 'Account settings' }).click();
    await expect(page).toHaveURL(/\/account\/settings$/);

    const duplicateIds = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id]')).map((element) => element.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    expect(duplicateIds).toEqual([]);
  });

  test.describe('desktop viewport', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('saves, reloads, and removes a key without exposing its value', async ({ page }) => {
      await runMistralCredentialFlow(page, 'desktop');
    });
  });

  test.describe('mobile viewport', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('saves, reloads, and removes a key without exposing its value', async ({ page }) => {
      await runMistralCredentialFlow(page, 'mobile');
    });
  });
});

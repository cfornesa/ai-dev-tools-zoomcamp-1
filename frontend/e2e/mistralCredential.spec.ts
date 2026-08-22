/**
 * Real-browser coverage for the personal Mistral credential journey.
 *
 * This deliberately uses a test-shaped placeholder rather than a real Mistral
 * secret: the credential endpoint encrypts and stores it without contacting
 * Mistral. The browser still exercises the real authenticated UI, CSRF/session
 * cookies, Vite proxy, Django endpoint, reload behavior, and removal flow.
 */
import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

test.describe('Personal Mistral credential settings', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('saves, reloads, and removes a key without exposing its value', async ({ page }) => {
    const testKey = 'sk-e2e-browser-key-12345';

    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.getByRole('link', { name: 'Account settings' }).click();
    await expect(page).toHaveURL(/\/account\/settings$/);

    await expect(page.getByRole('status').filter({ hasText: 'not configured' })).toBeVisible();

    const keyInput = page.getByRole('textbox', { name: 'Mistral API key', exact: true });
    await keyInput.fill(testKey);
    await page.getByRole('button', { name: 'Save key' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'configured' })).toBeVisible();
    await expect(page.getByText('Your Mistral key is securely configured.')).toBeVisible();
    await expect(keyInput).toHaveValue('');
    await expect(page.locator('body')).not.toContainText(testKey);

    await page.reload();
    await expect(page.getByRole('status').filter({ hasText: 'configured' })).toBeVisible();
    await expect(keyInput).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Replace key' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(testKey);

    await page.getByRole('button', { name: 'Remove key' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'not configured' })).toBeVisible();
    await expect(page.getByText('Your Mistral key was removed.')).toBeVisible();
  });
});

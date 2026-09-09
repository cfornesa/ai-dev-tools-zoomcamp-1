/**
 * Real-browser coverage for the personal Mistral credential journey.
 *
 * This deliberately uses a test-shaped placeholder rather than a real Mistral
 * secret: the credential endpoint encrypts and stores it without contacting
 * Mistral. The browser still exercises the real authenticated UI, CSRF/session
 * cookies, Vite proxy, Django endpoint, reload behavior, and removal flow.
 *
 * `AccountSettings.tsx` now renders the original standalone Mistral-only
 * form (`<form aria-label="Mistral API key">`) *and* a newer generic
 * `ProviderCredentialCards` list that also includes a Mistral row -- the
 * two duplicate each other's status text ("Mistral key: not configured")
 * and button labels ("Save key"/"Replace key"/"Remove key"). Worse: both
 * rows' text inputs render with `id="mistral-key"` (a real duplicate-id
 * accessibility bug, not just a test-locator ambiguity) -- the second
 * input's `<label htmlFor="mistral-key">` therefore associates with the
 * *first* (wrong) input via `getElementById`, leaving the second input
 * unlabelled and giving the first input's own accessible name an odd
 * doubled reading ("Mistral API key Mistral API key", confirmed via a
 * failed run's captured accessibility snapshot). Flagged separately as an
 * app-code defect; this file works around it by scoping to the
 * standalone form (`getByRole('form', { name: 'Mistral API key' })`)
 * for the input and its own submit button, and `.first()` (DOM order) for
 * "Remove key", which lives outside that form as a sibling.
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

    await expect(
      page.getByText('Mistral key: not configured', { exact: true }).first(),
    ).toBeVisible();

    const mistralForm = page.getByRole('form', { name: 'Mistral API key' });
    const keyInput = mistralForm.getByRole('textbox');
    await keyInput.fill(testKey);
    await mistralForm.getByRole('button', { name: 'Save key', exact: true }).click();

    await expect(page.getByText('Mistral key: configured', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Your Mistral key is securely configured.')).toBeVisible();
    await expect(keyInput).toHaveValue('');
    await expect(page.locator('body')).not.toContainText(testKey);

    await page.reload();
    await expect(page.getByText('Mistral key: configured', { exact: true }).first()).toBeVisible();
    await expect(keyInput).toHaveValue('');
    await expect(
      mistralForm.getByRole('button', { name: 'Replace key', exact: true }),
    ).toBeVisible();
    await expect(page.locator('body')).not.toContainText(testKey);

    await page.getByRole('button', { name: 'Remove key', exact: true }).first().click();
    await expect(
      page.getByText('Mistral key: not configured', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('Your Mistral key was removed.')).toBeVisible();
  });
});

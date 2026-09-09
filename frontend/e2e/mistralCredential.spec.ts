/**
 * Real-browser coverage for the personal Mistral credential journey.
 *
 * This deliberately uses a test-shaped placeholder rather than a real Mistral
 * secret: the credential endpoint encrypts and stores it without contacting
 * Mistral. The browser still exercises the real authenticated UI, CSRF/session
 * cookies, Vite proxy, Django endpoint, reload behavior, and removal flow.
 *
 * `AccountSettings.tsx` renders the original standalone Mistral-only form
 * (`<form aria-label="Mistral API key">`) *and* the newer generic
 * `ProviderCredentialCards` list that also includes a Mistral row -- the
 * two duplicate each other's status text ("Mistral key: not configured")
 * and button labels ("Save key"/"Replace key"/"Remove key"). They are not
 * write-through duplicates: the standalone form saves to the legacy
 * Mistral-only credential store that art-piece generation still reads,
 * while the generic list saves to the per-vendor `ProviderCredential`
 * store. Their former shared `id="mistral-key"` collision (which left the
 * generic Mistral input unlabelled and doubled the standalone input's
 * accessible name) was fixed by renaming the standalone input; the
 * duplicate-id absence is asserted below. Two textboxes still share the
 * accessible name "Mistral API key", so this file keeps scoping to the
 * standalone form (`getByRole('form', { name: 'Mistral API key' })`) for
 * the input and its own submit button, and `.first()` (DOM order) for
 * "Remove key", which lives outside that form as a sibling. Whether to
 * retire one of the two surfaces is an open owner design decision.
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

    const duplicateIds = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id]')).map((element) => element.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    expect(duplicateIds).toEqual([]);

    const mistralKeyInputs = page.getByLabel('Mistral API key');
    await expect(mistralKeyInputs).toHaveCount(2);

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

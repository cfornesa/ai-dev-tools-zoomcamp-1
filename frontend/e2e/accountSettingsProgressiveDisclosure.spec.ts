import { expect, test } from '@playwright/test';

import { apiDelete, apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('account settings progressive disclosure (#554)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`keeps secondary forms closed and keyboard-operable at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const models = (await (
        await apiGet(page.context(), '/api/account/ai-model-preferences/')
      ).json()) as Array<{ id: number }>;
      for (const model of models) {
        await apiDelete(page.context(), `/api/account/ai-model-preferences/${model.id}/`);
      }
      await page.goto('/account/settings');

      await page.getByRole('button', { name: 'Expand Saved AI models' }).click();
      await page.getByRole('button', { name: 'Expand Personas' }).click();

      const modelSection = page.locator('[data-settings-section="models"]');
      const personaSection = page.locator('[data-settings-section="personas"]');
      await expect(page.getByRole('button', { name: 'New model' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'New persona' })).toBeVisible();
      await expect(page.getByLabel('Model slug')).toHaveCount(0);
      await expect(page.getByLabel('Persona name')).toHaveCount(0);

      const modelDetails = modelSection.getByText('See more details about saved models');
      const personaDetails = personaSection.getByText('See more details about Personas');
      await modelDetails.focus();
      await page.keyboard.press('Enter');
      await expect(modelSection.locator('details')).toHaveAttribute('open', '');
      await expect(personaSection.locator('details')).not.toHaveAttribute('open', '');
      await personaDetails.focus();
      await page.keyboard.press('Enter');
      await expect(personaSection.locator('details')).toHaveAttribute('open', '');
      await expect(modelSection.locator('details')).toHaveAttribute('open', '');

      await page.getByRole('button', { name: 'New model' }).click();
      await expect(page.getByLabel('Model slug')).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).first().click();
      await expect(page.getByLabel('Model slug')).toHaveCount(0);

      await page.getByRole('button', { name: 'New persona' }).click();
      await expect(page.getByLabel('Persona name')).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).last().click();
      await expect(page.getByLabel('Persona name')).toHaveCount(0);
    });
  }
});

import { expect, test } from '@playwright/test';

import { apiDelete, apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('vendor-aware saved AI models (#553)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`manages saved models and filters the assistant at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);

      const existing = (await (
        await apiGet(page.context(), '/api/account/ai-model-preferences/')
      ).json()) as Array<{
        id: number;
        slug: string;
      }>;
      for (const model of existing.filter(
        (item) => item.slug === `mistral-e2e-${viewport.width}` || item.slug === 'gemini-2.5-flash',
      )) {
        await apiDelete(page.context(), `/api/account/ai-model-preferences/${model.id}/`);
      }

      const createdMistral = await apiPost(page.context(), '/api/account/ai-model-preferences/', {
        vendor: 'mistral',
        slug: `mistral-e2e-${viewport.width}`,
        label: 'Mistral browser model',
      });
      expect(createdMistral.ok()).toBe(true);
      const createdGemini = await apiPost(page.context(), '/api/account/ai-model-preferences/', {
        vendor: 'gemini',
        slug: 'gemini-2.5-flash',
        label: 'Gemini browser model',
      });
      expect(createdGemini.ok()).toBe(true);

      await page.goto('/account/settings');
      await expect(page.getByRole('heading', { name: 'Saved Mistral models' })).toBeVisible();
      await expect(page.getByText(/gemini: Gemini browser model/)).toBeVisible();

      await page.goto('/');
      await page.getByRole('button', { name: 'More creation options' }).click();
      await page.getByRole('menuitem', { name: 'Create a new animation' }).click();
      await page.waitForURL(/\/projects\/[^/]+$/);
      if (viewport.width < 768) {
        // The whole-scene AI action is in the dedicated Layers panel on the
        // narrow layout; Tools only contains editing preferences there.
        await page.getByRole('tab', { name: 'Layers' }).click();
      } else {
        await page.getByRole('button', { name: 'Expand Tools panel' }).click();
      }
      await page.getByRole('button', { name: 'Ask AI to improve this scene' }).click();
      await expect(page.getByRole('heading', { name: 'AI assistant' })).toBeVisible();
      const vendor = page.getByLabel('AI provider');
      await vendor.selectOption('gemini');
      await expect(page.getByLabel(/gemini model/i)).toHaveValue('');
      await expect(
        page.getByLabel(/gemini model/i).locator('option', { hasText: 'Gemini browser model' }),
      ).toHaveCount(1);

      await apiDelete(
        page.context(),
        `/api/account/ai-model-preferences/${(await createdMistral.json()).id}/`,
      );
      await apiDelete(
        page.context(),
        `/api/account/ai-model-preferences/${(await createdGemini.json()).id}/`,
      );
    });
  }
});

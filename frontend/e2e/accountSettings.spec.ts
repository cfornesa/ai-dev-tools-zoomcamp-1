import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

async function assertGroupedSettings(page: Page) {
  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();
  for (const heading of [
    'Plan and usage',
    'Public profile',
    'Account management',
    'AI provider credentials',
    'Saved AI models',
    'Personas',
    'Automatic retry',
  ]) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  for (const label of [
    'Plan and usage',
    'Account management',
    'AI provider credentials',
    'Saved AI models',
    'Personas',
    'Automatic retry',
  ]) {
    const expand = page.getByRole('button', { name: `Expand ${label}` });
    if (await expand.count()) await expand.click();
  }
  const actions = page.getByRole('list', { name: 'Account management actions' });
  await expect(actions.getByRole('listitem')).toHaveCount(6);
  await expect(actions.getByRole('link', { name: /delete your account/i })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test.describe('Account settings grouping (#548)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`empty settings fixture stays grouped at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.goto('/account/settings');
      await assertGroupedSettings(page);
      await expect(page.getByText('No saved models yet.')).toBeVisible();
      await expect(page.getByText('No Personas yet.')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('account-settings-empty.png') });
    });
  }

  for (const viewport of VIEWPORTS) {
    test(`populated settings fixture stays grouped at ${viewport.width}x${viewport.height}`, async ({
      page,
    }, testInfo: TestInfo) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      await page.route('**/api/account/provider-credentials/', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            providers: [
              { vendor: 'mistral', label: 'Mistral', implemented: true, configured: true },
              { vendor: 'gemini', label: 'Google Gemini', implemented: true, configured: false },
              { vendor: 'deepseek', label: 'DeepSeek', implemented: true, configured: false },
            ],
          }),
        }),
      );
      await page.route('**/api/account/mistral-model-preferences/', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              slug: 'mistral-small-latest',
              label: 'Small',
              created_at: '2026-01-01T00:00:00Z',
            },
          ]),
        }),
      );
      await page.route('**/api/account/ai-personas/', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 1,
              name: 'Playful',
              prompt_text: 'Prefer bright colors.',
              created_at: '2026-01-01T00:00:00Z',
            },
          ]),
        }),
      );
      await page.goto('/account/settings');
      await assertGroupedSettings(page);
      await expect(page.getByText('Small (mistral-small-latest)')).toBeVisible();
      await expect(page.getByText('Playful')).toBeVisible();
      await expect(page.getByText('Mistral key: configured')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('account-settings-populated.png') });
    });
  }
});

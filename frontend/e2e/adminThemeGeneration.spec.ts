import { expect, test } from '@playwright/test';

import { apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test('admin can generate, inspect, accept, and restore a custom theme draft', async ({ page }) => {
  const fixtures = requireE2EFixtures();
  await loginViaUI(page, fixtures.admin.email, fixtures.password);
  await page.goto('/admin/settings');

  const workflow = page.getByRole('heading', { name: 'AI custom theme workflow' });
  await expect(workflow).toBeVisible();
  await page.getByLabel('Theme prompt').fill('Create a readable serif cosmic theme for a gallery.');
  await page.getByRole('button', { name: 'Generate new' }).click();

  const draft = page.getByRole('article', { name: 'Generated theme draft' });
  await expect(draft).toBeVisible();
  await expect(draft.getByLabel('Generated theme draft preview')).toBeVisible();
  await expect(draft.getByText(/Attempt 1 of 3/)).toBeVisible();

  await draft.getByRole('button', { name: 'Accept theme' }).click();
  await expect(page.getByText(/accepted/).first()).toBeVisible();

  const attemptsResponse = await apiGet(page.context(), '/api/admin/theme-generation/');
  expect(attemptsResponse.ok()).toBe(true);
  const attempts = (await attemptsResponse.json()) as Array<{ state: string }>;
  expect(attempts.some((attempt) => attempt.state === 'accepted')).toBe(true);
});

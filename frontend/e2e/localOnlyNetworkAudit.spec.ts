import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

test.describe('Local-only transfer consent (#939)', () => {
  const fixtures = requireE2EFixtures();

  test('discloses the AI transfer and sends only after per-version consent', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await page.goto('/create');

    const apiPosts: string[] = [];
    const aiRequests: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'POST') return;
      const pathname = new URL(request.url()).pathname;
      if (!pathname.startsWith('/api/')) return;
      apiPosts.push(pathname);
      if (pathname === '/api/ai/art-pieces/generate/') aiRequests.push(request.postData() ?? '');
    });

    await page.route('**/api/ai/art-pieces/generate/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          library: 'svg',
          code: '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="purple"/></svg>',
          usage: {
            prompt_tokens: 1,
            completion_tokens: 1,
            total_tokens: 2,
            estimated_cost_usd: 0,
          },
        }),
      });
    });

    await page.getByRole('button', { name: 'Create a local generated piece', exact: true }).click();
    await page.waitForURL(/\/local-generated\/[^/]+$/);
    await page.getByLabel('Describe the local revision').fill('Make the circle purple.');
    await page.getByRole('button', { name: 'Ask AI for a local revision', exact: true }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('stays in this browser');
    await expect(dialog).toContainText('configured AI vendor');
    await expect(dialog).toContainText('current local source and media are not uploaded');
    expect(aiRequests).toEqual([]);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(aiRequests).toEqual([]);

    await page.getByRole('button', { name: 'Ask AI for a local revision', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Continue to AI' }).click();
    await expect(page.getByRole('status')).toContainText('AI result saved as a new local version');
    expect(aiRequests).toHaveLength(1);
    expect(aiRequests[0]).toContain('Make the circle purple.');
    expect(aiRequests[0]).toContain('"library":"svg"');
    expect(aiRequests[0]).not.toContain('source');
    expect(apiPosts.filter((pathname) => pathname === '/api/art-pieces/')).toEqual([]);
    await expect(page.getByRole('button', { name: 'Restore version 2' })).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Local-only piece publish-as-transfer (#942)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`warns, validates, uploads, and publishes a local-only 2D piece at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);

      await page.goto('/create');
      await page.getByRole('button', { name: 'Create a new 2D project', exact: true }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);

      let intakeCalls = 0;
      let publishCalls = 0;
      await page.route('**/api/account/storage/estimate/**', async (route) => {
        await route.fulfill({
          json: {
            remaining_after: {
              private: { bytes: 50_000_000, files: 97 },
              public: { bytes: 50_000_000, files: 97 },
            },
            fits: { private: true, public: true },
          },
        });
      });
      await page.route('**/api/pieces/intake/', async (route) => {
        intakeCalls += 1;
        await route.fulfill({
          status: 201,
          json: {
            kind: '2d',
            public_id: 'e2e-published-piece',
            version: 1,
            visibility: 'private',
            media_count: 0,
          },
        });
      });
      await page.route('**/api/projects/e2e-published-piece/publish/', async (route) => {
        publishCalls += 1;
        await route.fulfill({
          json: {
            id: 'e2e-published-piece',
            title: 'Local project',
            description: 'A short description.',
            visibility: 'public',
            owner: fixtures.owner.email,
            editor_url: '/users/@e2e/edit/local-project',
          },
        });
      });

      await page.getByRole('button', { name: 'Make public' }).click();
      const dialog = page.getByRole('alertdialog', { name: /Make .* public\?/ });
      await expect(dialog).toBeVisible();
      const publishButton = dialog.getByRole('button', { name: 'Publish' });
      await expect(publishButton).toBeDisabled();

      await dialog.getByLabel('Title').fill('Local project');
      await dialog.getByLabel('Description').fill('A short description.');
      await expect(publishButton).toBeEnabled();
      await publishButton.click();

      await page.waitForURL('**/users/@e2e/edit/local-project');
      expect(intakeCalls).toBe(1);
      expect(publishCalls).toBe(1);
    });
  }

  test('refuses to upload over quota and leaves the local piece editable', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    await page.goto('/create');
    await page.getByRole('button', { name: 'Create a new 2D project', exact: true }).click();
    await page.waitForURL(/\/local-projects\/[^/]+$/);

    let intakeCalls = 0;
    await page.route('**/api/account/storage/estimate/**', async (route) => {
      await route.fulfill({
        json: {
          remaining_after: {
            private: { bytes: 50_000_000, files: 97 },
            public: { bytes: 0, files: 0 },
          },
          fits: { private: true, public: false },
        },
      });
    });
    await page.route('**/api/pieces/intake/', async (route) => {
      intakeCalls += 1;
      await route.continue();
    });

    await page.getByRole('button', { name: 'Make public' }).click();
    const dialog = page.getByRole('alertdialog', { name: /Make .* public\?/ });
    await dialog.getByLabel('Title').fill('Local project');
    await dialog.getByLabel('Description').fill('A short description.');
    await dialog.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText(/Over quota/)).toBeVisible();
    expect(intakeCalls).toBe(0);
    // The local piece remains local-only and still editable, not half-transferred.
    await expect(page.getByRole('button', { name: 'Make public' })).toBeVisible();
  });
});

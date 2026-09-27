import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Local piece upload offer (#943)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`offers three local kinds without automatic upload at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);

      await page.goto('/create');
      await page.getByRole('button', { name: 'Create a new 2D project', exact: true }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);
      await page.goto('/create');
      await page.getByRole('button', { name: 'Create a new 3D project', exact: true }).click();
      await page.waitForURL(/\/local-projects\/[^/]+$/);
      await page.goto('/create');
      await page
        .getByRole('button', { name: 'Create a local generated piece', exact: true })
        .click();
      await page.waitForURL(/\/local-generated\/[^/]+$/);

      const intakeRequests: string[] = [];
      let cloudSyncRequests = 0;
      let estimateRequests = 0;
      let forcedOverQuota = true;
      await page.route(/\/api\/account\/cloud-sync\/?$/, async (route) => {
        cloudSyncRequests += 1;
        if (route.request().method() === 'GET') {
          await route.fulfill({
            json: {
              eligible: true,
              reason: null,
              source: 'admin',
              enabled: true,
              signup_preselected: false,
              consent_version: 'cloud-sync-account-v1',
              consent_text: 'Local pieces are offered for upload only after you choose them.',
              existing_local_pieces_offered_by: '#943',
              retention_days_after_disable: 30,
            },
          });
        } else {
          await route.continue();
        }
      });
      await page.route('**/api/account/storage/estimate/**', async (route) => {
        estimateRequests += 1;
        const overQuota = estimateRequests > 1 && forcedOverQuota;
        if (overQuota) forcedOverQuota = false;
        await route.fulfill({
          json: {
            remaining_after: {
              private: { bytes: overQuota ? 0 : 50_000_000, files: overQuota ? 0 : 97 },
              public: { bytes: 0, files: 0 },
            },
            fits: { private: !overQuota, public: false },
          },
        });
      });
      await page.route('**/api/pieces/intake/', async (route) => {
        intakeRequests.push(route.request().url());
        await route.fulfill({
          status: 201,
          json: {
            kind: '2d',
            public_id: crypto.randomUUID(),
            version: 1,
            visibility: 'private',
            media_count: 0,
          },
        });
      });

      await page.goto('/account/settings/storage');
      await expect.poll(() => cloudSyncRequests).toBeGreaterThan(0);
      const offer = page.getByRole('region', { name: 'Offer local pieces for cloud sync' });
      await expect(offer).toBeVisible();
      const checkboxes = offer.locator('input[type="checkbox"]');
      await expect(checkboxes).toHaveCount(4); // select-all plus the three local pieces
      await expect(checkboxes.nth(0)).not.toBeChecked();
      await expect(page.getByRole('button', { name: 'Upload selected pieces' })).toBeDisabled();

      await checkboxes.nth(0).check();
      await expect(page.getByText(/Selected total:/)).toBeVisible();
      await page.getByRole('button', { name: 'Upload selected pieces' }).click();
      await expect(offer.getByText(/Uploaded and verified/).first()).toBeVisible();
      await expect.poll(() => intakeRequests.length).toBe(2);
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(1);
      await page.getByRole('button', { name: 'Retry' }).click();
      await expect.poll(() => intakeRequests.length).toBe(3);
      await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
    });
  }
});

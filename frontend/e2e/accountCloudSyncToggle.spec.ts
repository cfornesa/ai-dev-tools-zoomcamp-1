import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const viewports = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Account cloud-sync consent (#940)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of viewports) {
    test(`requires consent before enabling at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      const updates: string[] = [];
      await page.route('**/api/account/cloud-sync/', async (route) => {
        if (route.request().method() === 'PUT') {
          updates.push(route.request().postData() ?? '');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              eligible: true,
              reason: null,
              source: 'plan',
              enabled: true,
              signup_preselected: false,
              consent_version: 'cloud-sync-account-v1',
              consent_text: 'Pieces currently live only in this browser may be uploaded over TLS.',
              existing_local_pieces_offered_by: '#943',
              retention_days_after_disable: 30,
              paused_inherited_backups: 0,
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            eligible: true,
            reason: null,
            source: 'plan',
            enabled: false,
            signup_preselected: true,
            consent_version: 'cloud-sync-account-v1',
            consent_text:
              'Pieces currently live only in this browser may be uploaded over TLS and are not end-to-end encrypted. Disable to revoke; retained copies expire after 30 days.',
            existing_local_pieces_offered_by: '#943',
            retention_days_after_disable: 30,
          }),
        });
      });

      await page.goto('/account/settings');
      await page.getByRole('button', { name: 'Expand Cloud sync' }).click();
      const toggle = page.getByRole('checkbox', { name: 'Sync future pieces to the cloud' });
      await toggle.click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('not end-to-end encrypted');
      await expect(dialog).toContainText('30 days');
      await expect(dialog).toContainText('#943');
      expect(updates).toEqual([]);
      await dialog.getByRole('button', { name: /enable sync/i }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Cloud sync enabled' }),
      ).toBeVisible();
      expect(updates).toHaveLength(1);
      expect(updates[0]).toContain('cloud-sync-account-v1');
    });
  }
});

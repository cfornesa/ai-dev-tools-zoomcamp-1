import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('PayPal subscription management (#550)', () => {
  const fixtures = requireE2EFixtures();

  for (const viewport of VIEWPORTS) {
    test(`renders hosted management and cancellation at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixtures.owner.email, fixtures.password);
      let cancellationRequests = 0;
      await page.route('**/api/account/billing/', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              plan_key: 'paid',
              plan: { price: '10.00', currency: 'USD', interval: 'month' },
              subscription: {
                status: 'active',
                paid_through: '2026-10-01',
                can_manage: true,
                can_cancel: true,
                manage_url:
                  'https://www.paypal.com/us/digital-wallet/manage-money/manage-subscriptions',
              },
              available_plan: null,
            }),
          });
          return;
        }
        cancellationRequests += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      });

      await page.goto('/account/billing');
      await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
      await expect(page.getByText('Subscription status: active')).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Manage subscription in PayPal' }),
      ).toHaveAttribute('href', /paypal\.com/);

      await page.once('dialog', (dialog) => void dialog.accept());
      await page.getByRole('button', { name: 'Cancel subscription' }).click();
      await expect(page.getByRole('alert')).toContainText('access remains active');
      expect(cancellationRequests).toBe(1);
    });
  }
});

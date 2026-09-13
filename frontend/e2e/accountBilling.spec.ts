import { expect, test } from '@playwright/test';

import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

const BILLING_STATUS = {
  plan_key: 'free',
  plan: { price: '0.00', currency: 'USD', interval: 'month' },
  subscription: { status: null, paid_through: null },
  available_plan: {
    plan_key: 'paid',
    paypal_configured: true,
    price: '19.99',
    currency: 'USD',
    interval: 'month',
  },
};

test.describe('Account billing checkout (#440)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('anonymous visitors cannot access billing', async ({ page }) => {
    await page.goto('/account/billing');
    await expect(page).toHaveURL(/\/$/);
  });

  test('shows explicit monthly pricing and starts a mocked PayPal checkout', async ({ page }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    let checkoutRequests = 0;
    await page.route('**/api/account/billing/', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(BILLING_STATUS),
        });
        return;
      }
      checkoutRequests += 1;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          checkout_id: 42,
          approval_url: 'https://paypal.test/checkout/42',
        }),
      });
    });

    await page.goto('/account/billing');
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
    await expect(page.getByText('Price: 0.00 USD / month')).toBeVisible();
    await expect(page.getByText('Available paid plan: 19.99 USD / month')).toBeVisible();
    await expect(page.getByText('Subscription status: not started')).toBeVisible();

    await page.getByRole('button', { name: 'Subscribe with PayPal' }).click();
    await expect.poll(() => checkoutRequests).toBe(1);
  });

  test('return-like query parameters do not grant access', async ({ page }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    await page.route('**/api/account/billing/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BILLING_STATUS),
      });
    });

    await page.goto('/account/billing?subscription_id=unverified&token=fake');
    await expect(page.getByText('Your current plan:')).toContainText('free');
    await expect(page.getByText('Subscription status: not started')).toBeVisible();
  });
});

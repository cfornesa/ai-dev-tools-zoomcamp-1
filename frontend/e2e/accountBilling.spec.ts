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
    price: '10.00',
    currency: 'USD',
    interval: 'month',
  },
};
const BILLING_STATUS_POLL_MS = 5000;
const BILLING_VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

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
    await expect(page.getByText('Available paid plan: 10.00 USD / month')).toBeVisible();
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
    await expect(page.getByTestId('paypal-pending-status')).toContainText('can take a few minutes');
    await expect(page.getByText('Your current plan:')).toContainText('free');
    await expect(page.getByText('Subscription status: not started')).toBeVisible();
  });

  test('polls a PayPal return until the active plan is visible', async ({ page }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    let statusRequests = 0;
    await page.route('**/api/account/billing/', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      statusRequests += 1;
      const body =
        statusRequests <= 2
          ? BILLING_STATUS
          : {
              ...BILLING_STATUS,
              plan_key: 'paid',
              plan: { price: '10.00', currency: 'USD', interval: 'month' },
              subscription: { status: 'active', paid_through: null },
            };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await page.goto('/account/billing?subscription_id=approved&ba_token=approved');
    await expect(page.getByTestId('paypal-pending-status')).toBeVisible();
    await expect
      .poll(() => statusRequests, { timeout: BILLING_STATUS_POLL_MS * 2 + 2000 })
      .toBeGreaterThanOrEqual(3);
    await expect(page.getByText('Your current plan:')).toContainText('paid');
    await expect(page.getByText('Subscription status: active')).toBeVisible();
    await expect(page.getByTestId('paypal-pending-status')).toHaveCount(0);
  });

  test('centers the pending Billing surface at desktop and mobile viewports', async ({ page }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);
    await page.route('**/api/account/billing/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BILLING_STATUS),
      });
    });

    for (const viewport of BILLING_VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto(`/account/billing?subscription_id=layout-${viewport.width}`);
      await expect(page.getByTestId('paypal-pending-status')).toBeVisible();

      const geometry = await page.locator('.account-billing').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const body = document.body.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          bodyWidth: body.width,
          bodyHeight: body.height,
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
      });

      expect(geometry.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(geometry.bodyWidth + 1);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
      expect(geometry.top).toBeGreaterThanOrEqual(-1);
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.bodyHeight + 1);
      await page.screenshot({
        path: `test-results/billing-pending-${viewport.width}.png`,
        fullPage: true,
      });
    }
  });
});

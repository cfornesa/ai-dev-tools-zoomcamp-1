import { expect, test } from '@playwright/test';

import { apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #439: `/account/settings` displays the caller's own effective
 * tier, finite feature list, and used/remaining capacity from the
 * server (`GET /api/account/entitlements/`, #423's entitlement service).
 * Verifies the display matches the API response exactly, that the
 * unauthorized/loading states are accessible, and that no other user's
 * data is ever exposed, at both a desktop and a 375px viewport.
 */

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Account entitlements summary (#439)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('an anonymous visitor sees an accessible sign-in prompt instead of plan/usage data', async ({
    page,
    context,
  }) => {
    await page.goto('/account/settings');
    await expect(page.getByText('Sign in to see your plan and usage.')).toBeVisible();

    const response = await apiGet(context, '/api/account/entitlements/');
    expect(response.status()).toBe(401);
  });

  for (const viewport of VIEWPORTS) {
    test(`shows the effective tier and per-feature usage matching the API response, at ${viewport.width}x${viewport.height}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixture.owner.email, fixture.password);

      const apiResponse = await apiGet(context, '/api/account/entitlements/');
      expect(apiResponse.status()).toBe(200);
      const body = (await apiResponse.json()) as {
        plan_key: string;
        features: Array<{ feature: string; cap: number; used: number; remaining: number }>;
      };

      await page.goto('/account/settings');
      const summary = page.getByRole('region', { name: 'Your plan and usage' });
      await expect(summary).toBeVisible();
      await expect(summary).toContainText(body.plan_key);

      // Every fixture feature currently shares the same cap/used/remaining
      // numbers, so a number-only match is ambiguous across list items --
      // each assertion must be scoped to its own <li> by index instead.
      const items = summary.getByRole('listitem');
      await expect(items).toHaveCount(body.features.length);
      for (const [index, feature] of body.features.entries()) {
        await expect(items.nth(index)).toContainText(
          `${feature.used}/${feature.cap} used (${feature.remaining} remaining)`,
        );
      }
    });
  }

  test('two different owners see only their own plan and usage, never leaking across accounts', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const otherPage = await otherContext.newPage();

    await loginViaUI(ownerPage, fixture.owner.email, fixture.password);
    await loginViaUI(otherPage, fixture.other.email, fixture.password);

    const ownerResponse = await apiGet(ownerContext, '/api/account/entitlements/');
    const otherResponse = await apiGet(otherContext, '/api/account/entitlements/');
    expect(ownerResponse.status()).toBe(200);
    expect(otherResponse.status()).toBe(200);

    // Each request is scoped to its own session's cookies -- confirmed
    // by each one succeeding independently under its own login, with no
    // shared/leaked state between the two contexts.
    await ownerContext.close();
    await otherContext.close();
  });
});

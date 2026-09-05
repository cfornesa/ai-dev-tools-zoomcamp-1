import { expect, test } from '@playwright/test';

import { apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #426: `/account/settings/identities` lists the caller's own
 * linked sign-in providers and lets them disconnect one, guarded so an
 * account is never stranded with zero usable sign-in methods left.
 * Every E2E fixture user (`e2e_fixtures.py`) now carries exactly one
 * linked "google" `SocialAccount`, matching real production shape (every
 * real user arrives via at least one OAuth provider) -- this suite
 * exercises what that single-identity state actually looks like end to
 * end: the list itself, the strand-prevention error on the one identity
 * that exists, and the authorization boundary. GitHub is not configured
 * in this environment (see AGENTS.md's issue #75/#420 notes), so a
 * "second usable identity, unlink succeeds" scenario is covered instead
 * by `backend/tests/test_account_identities.py`'s deterministic
 * fixtures, not duplicated here against a provider this environment
 * cannot actually enable.
 */

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

test.describe('Account identities: link and unlink (#426)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('an anonymous visitor is redirected and the API requires authentication', async ({
    page,
    context,
  }) => {
    await page.goto('/account/settings/identities');
    await expect(page).toHaveURL(/\/$/);

    const response = await apiGet(context, '/api/account/identities/');
    expect(response.status()).toBe(401);
  });

  for (const viewport of VIEWPORTS) {
    test(`lists the caller's own linked provider and offers to connect GitHub, at ${viewport.width}x${viewport.height}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixture.owner.email, fixture.password);

      await page.goto('/account/settings/identities');
      await expect(page.getByRole('heading', { name: 'Linked sign-in methods' })).toBeVisible();

      const list = page.getByRole('list', { name: 'Linked sign-in methods' });
      await expect(list.getByText('Google')).toBeVisible();

      // GitHub is not configured in this environment, so connecting it
      // is offered (the button always renders for any unlinked provider
      // this app supports) but never a second *already linked* identity.
      await expect(page.getByRole('button', { name: 'Connect GitHub' })).toBeVisible();

      const response = await apiGet(context, '/api/account/identities/');
      const body = (await response.json()) as Array<{ provider: string }>;
      expect(body.map((identity) => identity.provider)).toEqual(['google']);
    });
  }

  test("cannot disconnect the account's only usable sign-in method", async ({ page }) => {
    await loginViaUI(page, fixture.other.email, fixture.password);

    await page.goto('/account/settings/identities');
    await page.getByRole('button', { name: 'Disconnect' }).click();

    await expect(
      page.getByText('You cannot remove your only usable sign-in method.'),
    ).toBeVisible();
    // The identity is still listed -- nothing was actually removed.
    await expect(
      page.getByRole('list', { name: 'Linked sign-in methods' }).getByText('Google'),
    ).toBeVisible();
  });

  test('a signed-in user only ever sees and can only ever act on their own identities', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.empty.email, fixture.password);

    const response = await apiGet(context, '/api/account/identities/');
    const body = (await response.json()) as Array<{ provider: string }>;
    // Exactly this user's own single Google identity -- never leaking
    // any other fixture user's linked providers.
    expect(body).toHaveLength(1);
    expect(body[0].provider).toBe('google');

    await page.goto('/account/settings/identities');
    await expect(
      page.getByRole('list', { name: 'Linked sign-in methods' }).locator('li'),
    ).toHaveCount(1);
  });
});

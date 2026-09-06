import { expect, test, type BrowserContext } from '@playwright/test';

import { apiDelete, apiGet } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #441: `/account/settings/sessions` lists the caller's own
 * sessions (never a raw session key/cookie) with a current-session
 * marker, and lets them revoke one with a confirm/cancel step. A
 * second browser context signed in as the same fixture user stands in
 * for "user A's second session"; a different fixture user's own
 * session proves cross-user isolation.
 */

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

/**
 * Every real login this file makes against a shared, deterministic
 * fixture user leaves a server-side Django session behind -- closing a
 * `BrowserContext` only drops the client's cookie jar, it never signs
 * the session out. Without this, sessions accumulate across this
 * file's own tests (and any later run against the same fixture users),
 * breaking every test after the first that asserts an exact session
 * count. Each test registers every secondary context it logs a fixture
 * user into here; `afterEach` best-effort-revokes every session left
 * over from both these and the test's own primary `page` login.
 */
let loggedInContexts: BrowserContext[] = [];

/**
 * Revokes every session visible from this context, including its own
 * current one -- run once a test is completely finished with a login,
 * so the next test in this file starts from a clean slate instead of
 * accumulating that test's own primary session as a permanent "ghost"
 * (a fresh `page` fixture per test means it was never "the other
 * session" from anyone's perspective, so nothing else would ever revoke
 * it). A 401 means the context already signed itself out (e.g. the
 * "revoke current session" test) -- nothing left to clean up.
 */
async function revokeAllSessions(context: BrowserContext): Promise<void> {
  const response = await apiGet(context, '/api/account/sessions/');
  if (response.status() !== 200) return;
  const sessions = (await response.json()) as { public_id: string; is_current: boolean }[];
  // Revoking this context's own current session logs it out, so any
  // other session must be revoked first -- otherwise the remaining
  // deletes would themselves 401.
  for (const session of sessions.filter((s) => !s.is_current)) {
    await apiDelete(context, `/api/account/sessions/${session.public_id}/`);
  }
  const current = sessions.find((s) => s.is_current);
  if (current) {
    await apiDelete(context, `/api/account/sessions/${current.public_id}/`);
  }
}

test.describe('Account sessions: list and revoke (#441)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test.beforeEach(() => {
    loggedInContexts = [];
  });

  test.afterEach(async ({ page }) => {
    // The primary page's own login accumulates extra sessions across
    // this file's tests exactly like any secondary context does.
    await revokeAllSessions(page.context());
    for (const context of loggedInContexts) {
      await revokeAllSessions(context);
      await context.close();
    }
  });

  test('an anonymous visitor cannot list sessions', async ({ context }) => {
    const response = await apiGet(context, '/api/account/sessions/');
    expect(response.status()).toBe(401);
  });

  for (const viewport of VIEWPORTS) {
    test(`lists the current session and a second session, without exposing a raw session key, at ${viewport.width}x${viewport.height}`, async ({
      browser,
      page,
    }) => {
      await page.setViewportSize(viewport);
      await loginViaUI(page, fixture.owner.email, fixture.password);

      // A second real browser context, signed in as the same user,
      // stands in for "a second device".
      const secondContext = await browser.newContext();
      loggedInContexts.push(secondContext);
      const secondPage = await secondContext.newPage();
      await loginViaUI(secondPage, fixture.owner.email, fixture.password);

      await page.goto('/account/settings/sessions');
      const list = page.getByRole('list', { name: 'Active sessions' });
      await expect(list.getByText('(this device)')).toBeVisible();
      await expect(list.getByRole('listitem')).toHaveCount(2);

      const pageContent = await page.content();
      // No 40-character Django session key ever appears in the DOM.
      expect(pageContent).not.toMatch(/[a-z0-9]{40}/);
    });
  }

  test('revoking the second session requires confirmation, then invalidates it', async ({
    browser,
    page,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    const secondContext = await browser.newContext();
    loggedInContexts.push(secondContext);
    const secondPage = await secondContext.newPage();
    await loginViaUI(secondPage, fixture.owner.email, fixture.password);
    expect((await apiGet(secondContext, '/api/whoami/')).status()).toBe(200);

    await page.goto('/account/settings/sessions');
    const list = page.getByRole('list', { name: 'Active sessions' });
    const otherItem = list.getByRole('listitem').filter({ hasNotText: '(this device)' });
    await otherItem.getByRole('button', { name: 'Revoke' }).click();
    await expect(otherItem.getByText('Revoke this session?')).toBeVisible();

    // Cancel leaves it untouched.
    await otherItem.getByRole('button', { name: 'Cancel' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(2);

    // Confirm actually revokes it.
    await otherItem.getByRole('button', { name: 'Revoke' }).click();
    await otherItem.getByRole('button', { name: 'Confirm' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(1);

    // The revoked session's own next authenticated request now fails.
    expect((await apiGet(secondContext, '/api/whoami/')).status()).toBe(401);
  });

  test('revoking the current session logs the user out', async ({ page }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    await page.goto('/account/settings/sessions');
    const list = page.getByRole('list', { name: 'Active sessions' });
    const currentItem = list.getByRole('listitem').filter({ hasText: '(this device)' });
    await currentItem.getByRole('button', { name: 'Revoke' }).click();
    await currentItem.getByRole('button', { name: 'Confirm' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Sign in to see your projects.')).toBeVisible();
  });

  test("a different user's own session is never listed or revocable by another account", async ({
    browser,
    page,
  }) => {
    await loginViaUI(page, fixture.owner.email, fixture.password);

    const otherContext = await browser.newContext();
    loggedInContexts.push(otherContext);
    const otherPage = await otherContext.newPage();
    await loginViaUI(otherPage, fixture.other.email, fixture.password);

    await page.goto('/account/settings/sessions');
    await expect(
      page.getByRole('list', { name: 'Active sessions' }).getByRole('listitem'),
    ).toHaveCount(1);

    // fixture.other's own session remains completely unaffected.
    expect((await apiGet(otherContext, '/api/whoami/')).status()).toBe(200);
  });
});

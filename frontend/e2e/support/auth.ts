/**
 * Task 65 (issue #65): signs a Playwright page in through the real
 * `django-allauth` `/accounts/login/` form -- never Google OAuth, which
 * needs real third-party credentials this environment doesn't have (see
 * AGENTS.md's issue #75 note) and never a bypass like `force_authenticate`
 * (that's a Django-test-client-only shortcut with no browser session
 * behind it). `config/settings.py` enables both Google sign-in *and*
 * `django-allauth`'s standard email/password login
 * (`ACCOUNT_LOGIN_METHODS = {'email'}`), so this is a first-class,
 * production-supported sign-in path, not a test-only backdoor -- it's
 * exactly what `scenes/management/commands/e2e_fixtures.py`'s users are
 * built to authenticate through.
 *
 * Field names/labels below were confirmed directly against
 * `allauth.account.forms.LoginForm` (`login` / "Email", `password` /
 * "Password") rather than guessed -- see this task's own investigation
 * notes in the PR/issue comment.
 *
 * After the heading is visible, it forces one authenticated /api/whoami/
 * round-trip through the same APIRequestContext the api helpers use, so
 * Firefox's lagging shared cookie jar resolves before any spec makes a raw
 * API call.
 */
import { expect, type Page } from '@playwright/test';

export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/accounts/login/');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  // LOGIN_REDIRECT_URL = '/' (config/settings.py); Home.tsx then renders
  // the signed-in Gallery, whose heading is the most reliable "login
  // actually succeeded" signal (rather than just asserting the URL, which
  // would also be true for a failed login that re-renders the form at the
  // same path in some allauth configurations).
  await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible({
    timeout: 15000,
  });
  // Issue #474: on Firefox specifically, an APIRequestContext call made
  // immediately after this UI login can 401 even though the page's own
  // session is already authenticated -- Firefox's shared cookie jar for
  // context.request lags the page's own cookie jar by a beat right after
  // a cross-navigation login. Force one authenticated round-trip through
  // the exact same context.request path every apiPost/apiGet/etc. call
  // uses, so any lag resolves here once instead of intermittently in
  // whatever spec happens to call the API next.
  const sessionCheck = await page.context().request.get('/api/whoami/');
  if (sessionCheck.status() !== 200) {
    throw new Error(
      `loginViaUI: post-login session check got HTTP ${sessionCheck.status()} from ` +
        '/api/whoami/, expected 200 -- the session cookie is not yet visible to ' +
        "this BrowserContext's APIRequestContext.",
    );
  }
}

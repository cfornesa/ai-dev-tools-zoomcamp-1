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
  await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();
}

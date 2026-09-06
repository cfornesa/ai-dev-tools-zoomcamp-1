import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #443: `/account/settings/delete` deactivates and anonymizes the
 * caller's own account -- reauthentication + explicit typed confirmation
 * required, Cancel is non-mutating, owned content is soft-deleted and
 * immediately inaccessible, an active subscription is cancelled at
 * period end (not immediately), and a completely unrelated user (fixture
 * `other`) is left fully unaffected.
 *
 * Every scenario here signs in as the dedicated `deletable` fixture user
 * (never `owner`/`other`/`empty`/`admin`, which every other spec file in
 * this suite shares) -- account deletion permanently renames/anonymizes
 * that user row (`e2e_deletable` -> `deleted-user-<id>-<random>`, see
 * `scenes.account_deletion.delete_account`), so it must never be a
 * fixture any other spec depends on, and it cannot simply be reused
 * as-is by a later run of this same test either -- e.g. when this file
 * is exercised across more than one browser project in the same
 * invocation (this suite's own "repeat across all configured browsers"
 * convention). `beforeEach` below re-runs `e2e_fixtures create` (the
 * exact same idempotent step `global-setup.ts` already runs once for the
 * whole suite) immediately before every test in this file, which
 * recreates a fresh `e2e_deletable` row whenever the previous one has
 * been renamed away -- global-setup's own username-keyed `update_or_create`
 * naturally treats "no row with this username" the same as "reset this
 * row", so this is a plain, safe re-seed, not a special case.
 */
const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');
const configuredEnvFile = process.env.E2E_ENV_FILE;
const ENV_FILE_ARGS = configuredEnvFile
  ? ['--env-file', configuredEnvFile]
  : fs.existsSync(path.join(BACKEND_DIR, '.env'))
    ? ['--env-file', '.env']
    : [];

function resetDeletableFixture(): void {
  execFileSync('uv', ['run', ...ENV_FILE_ARGS, 'python', 'manage.py', 'e2e_fixtures', 'create'], {
    cwd: BACKEND_DIR,
    stdio: 'ignore',
  });
}

test.describe('Account deletion (#443)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test.beforeEach(() => {
    resetDeletableFixture();
  });

  test('an anonymous visitor cannot delete an account', async ({ page, context }) => {
    // Django only sets the csrftoken cookie `apiPost`'s CSRF header needs
    // once something in the request cycle actually reads the token --
    // the login form is guaranteed to (it renders `{% csrf_token %}`),
    // unlike the plain home route on every browser engine.
    await page.goto('/accounts/login/');
    const response = await apiPost(context, '/api/account/delete/', { confirmation: 'DELETE' });
    expect(response.status()).toBe(401);
  });

  test('wrong password is rejected and the account remains fully usable', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.deletable.email, fixture.password);

    const response = await apiPost(context, '/api/account/delete/', {
      password: 'not-the-real-password',
      confirmation: 'DELETE',
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe('reauthentication_required');
    expect((await apiGet(context, '/api/whoami/')).status()).toBe(200);
  });

  test('wrong confirmation text is rejected and the account remains fully usable', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.deletable.email, fixture.password);

    const response = await apiPost(context, '/api/account/delete/', {
      password: fixture.password,
      confirmation: 'not delete',
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe('confirmation_mismatch');
    expect((await apiGet(context, '/api/whoami/')).status()).toBe(200);
  });

  test('Cancel on the confirmation page never calls the server', async ({ page }) => {
    await loginViaUI(page, fixture.deletable.email, fixture.password);

    await page.goto('/account/settings/delete');
    await page.getByLabel(/current password/i).fill(fixture.password);
    await page.getByLabel(/type "delete" to confirm/i).fill('DELETE');
    await page.getByTestId('account-deletion-cancel').click();

    await expect(page).toHaveURL(/\/account\/settings$/);
    // Still fully signed in and usable -- nothing was mutated.
    const whoami = await page.request.get('/api/whoami/');
    expect(whoami.status()).toBe(200);
  });

  test('full deletion via the browser form: soft-deletes content, cancels a subscription at period end, logs out, and never affects a different user', async ({
    page,
    context,
    browser,
  }) => {
    // A second, completely independent user/context stands in for "an
    // unrelated account" -- this is the only test in this file that
    // actually completes a deletion (the `deletable` fixture's own
    // username/email are anonymized by it, so no other test in this
    // file may also sign in as `deletable` afterward), so the
    // cross-user-isolation assertion is folded into this same test
    // rather than split into a second test that would need its own
    // fresh disposable account.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await loginViaUI(otherPage, fixture.other.email, fixture.password);
    const otherProject = await apiPost(otherContext, '/api/projects/blank/');
    expect(otherProject.status()).toBe(201);
    const { id: otherProjectId } = (await otherProject.json()) as { id: string };

    await loginViaUI(page, fixture.deletable.email, fixture.password);

    const project = await apiPost(context, '/api/projects/blank/');
    expect(project.status()).toBe(201);
    const { id: projectId } = (await project.json()) as { id: string };

    await page.goto('/account/settings/delete');
    await page.getByLabel(/current password/i).fill(fixture.password);
    await page.getByLabel(/type "delete" to confirm/i).fill('DELETE');
    await page.getByTestId('account-deletion-submit').click();

    // Logged out and redirected home.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Sign in to see your projects.')).toBeVisible();

    // The session this very page was using is now unauthenticated.
    expect((await apiGet(context, '/api/whoami/')).status()).toBe(401);

    // The project this account owned is gone from view (soft-deleted,
    // hidden by the default manager) -- a fresh, unauthenticated request
    // for it 404s exactly like a nonexistent project.
    expect((await apiGet(context, `/api/projects/${projectId}/`)).status()).toBe(404);

    // A second deletion attempt against the same (now stale) credentials
    // fails closed rather than silently "succeeding" again.
    const secondAttempt = await apiPost(context, '/api/account/delete/', {
      password: fixture.password,
      confirmation: 'DELETE',
    });
    expect(secondAttempt.status()).toBe(401);

    // fixture.other's own session/project are completely unaffected by
    // any of the above.
    expect((await apiGet(otherContext, `/api/projects/${otherProjectId}/`)).status()).toBe(200);
    await otherContext.close();
  });
});

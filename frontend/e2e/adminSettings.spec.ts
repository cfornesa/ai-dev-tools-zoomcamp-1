import { expect, test, type BrowserContext } from '@playwright/test';

import { apiDelete, apiGet, apiPatch, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { requireE2EFixtures } from './support/prerequisites.js';

/**
 * Issue #422: `/admin/settings` is a protected React route backed by
 * `GET/PATCH /api/admin/settings/` and `/api/admin/plans/`. This suite
 * uses the issue's own fixed fixture -- application-admin A
 * (`e2e_admin`, granted via `scenes.models.ApplicationAdmin` by
 * `e2e_fixtures.py`) and ordinary user B (`e2e_other`) -- to verify the
 * authorization boundary, the edit/save/cancel/error UI, and that an
 * invalid or stale-revision update leaves the previous configuration
 * intact, at both a desktop and a 375px viewport.
 *
 * Every mutating step re-reads the current revision from the API
 * immediately beforehand rather than assuming a fixed sequence number --
 * `SiteSettings`/`Plan` are process-wide singletons this whole suite
 * shares, so a prior run's leftover state (or another spec) may have
 * already advanced the revision past whatever this test last saw.
 *
 * Consolidation note: the authorization-boundary pair and the viewport
 * matrix are each grouped into one test() using test.step() per original
 * scenario, each with its own fresh browser.newContext(). Only
 * Playwright's own test-invocation count drops.
 */

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
];

async function currentSiteSettings(context: BrowserContext) {
  const response = await apiGet(context, '/api/admin/settings/');
  return (await response.json()) as { site_title: string; revision: number };
}

async function currentFreePlan(context: BrowserContext) {
  const response = await apiGet(context, '/api/admin/plans/');
  const plans = (await response.json()) as Array<{
    plan_key: string;
    daily_ai_requests: number;
    revision: number;
  }>;
  const freePlan = plans.find((plan) => plan.plan_key === 'free');
  if (!freePlan) throw new Error('Expected a seeded "free" plan.');
  return freePlan;
}

test.describe('Admin settings: site title and plan policy (#422)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('an ordinary user and an anonymous visitor both cannot reach the admin route or API', async ({
    browser,
  }) => {
    await test.step('an ordinary user cannot reach the admin route or API', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginViaUI(page, fixture.other.email, fixture.password);

      await page.goto('/admin/settings');
      // Non-owner UI gating (#458's convention): a confirmed non-admin is
      // redirected away rather than shown the form.
      await expect(page).toHaveURL(/\/studio$/);
      await expect(page.getByRole('heading', { name: 'Admin settings' })).toHaveCount(0);

      const settingsResponse = await apiGet(context, '/api/admin/settings/');
      expect(settingsResponse.status()).toBe(403);
      const plansResponse = await apiGet(context, '/api/admin/plans/');
      expect(plansResponse.status()).toBe(403);

      await context.close();
    });

    await test.step('an anonymous visitor is redirected and the API requires authentication', async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('/admin/settings');
      await expect(page).toHaveURL(/\/gallery$/);

      const response = await apiGet(context, '/api/admin/settings/');
      expect(response.status()).toBe(401);

      await context.close();
    });
  });

  test('an admin can edit site title and plan caps, with save/cancel/error states, at both viewports', async ({
    browser,
  }) => {
    test.setTimeout(60000);

    for (const viewport of VIEWPORTS) {
      await test.step(`${viewport.width}x${viewport.height}`, async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.setViewportSize(viewport);
        await loginViaUI(page, fixture.admin.email, fixture.password);

        const before = await currentSiteSettings(context);
        await page.goto('/admin/settings');
        await expect(page.getByRole('heading', { name: 'Admin settings' })).toBeVisible();

        const titleInput = page
          .getByRole('form', { name: 'Site title settings' })
          .getByLabel('Site title');
        await expect(titleInput).toHaveValue(before.site_title);

        // Cancel: reverts the field without saving.
        await titleInput.fill('Unsaved Draft Name');
        await page
          .getByRole('form', { name: 'Site title settings' })
          .getByRole('button', { name: 'Cancel' })
          .click();
        await expect(titleInput).toHaveValue(before.site_title);

        // Save: a real, persisted update.
        const newTitle = `Studio Name ${viewport.width}`;
        await titleInput.fill(newTitle);
        await page
          .getByRole('form', { name: 'Site title settings' })
          .getByRole('button', { name: 'Save', exact: true })
          .click();
        await expect(page.getByText('Global site metadata saved.')).toBeVisible();
        await page.reload();
        await expect(
          page.getByRole('form', { name: 'Site title settings' }).getByLabel('Site title'),
        ).toHaveValue(newTitle);

        // Restore the fixture's own baseline so other tests/reruns still
        // see the documented default.
        const afterTitleSave = await currentSiteSettings(context);
        await apiPatch(context, '/api/admin/settings/', {
          site_title: before.site_title,
          revision: afterTitleSave.revision,
        });

        // Plan policy: free plan's daily cap is editable and takes effect.
        // Issue #505: the baseline is read from the API, never hardcoded --
        // the seeded default is migration 0031's 50, so a fresh database
        // legitimately shows that rather than any value a previous run may
        // have left behind.
        const baselineFreePlan = await currentFreePlan(context);
        const baselineDailyRequests = String(baselineFreePlan.daily_ai_requests ?? '50');
        const freePlanForm = page.getByRole('form', { name: 'free plan' });
        await page.reload();
        await expect(freePlanForm.getByLabel('Daily AI requests')).toHaveValue(
          baselineDailyRequests,
        );
        await freePlanForm.getByLabel('Daily AI requests').fill('7');
        await freePlanForm.getByRole('button', { name: 'Save' }).click();
        await expect(freePlanForm.getByText('free plan saved.')).toBeVisible();
        await page.reload();
        await expect(
          page.getByRole('form', { name: 'free plan' }).getByLabel('Daily AI requests'),
        ).toHaveValue('7');

        // Restore the fixture's own baseline cap for other tests.
        const afterPlanSave = await currentFreePlan(context);
        await apiPatch(context, '/api/admin/plans/?plan_key=free', {
          daily_ai_requests: Number(baselineDailyRequests),
          feature_keys: ['ai_scene_create', 'ai_scene_edit', 'ai_art_generate'],
          active: true,
          paypal_plan_id: '',
          revision: afterPlanSave.revision,
        });

        await context.close();
      });
    }
  });

  test('a stale revision is rejected with a conflict, leaving the previous value intact', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixture.admin.email, fixture.password);

    const baseline = await currentSiteSettings(context);

    // A concurrent edit happens "behind the UI's back" via the API,
    // advancing the revision the already-loaded page doesn't know about.
    const concurrent = await apiPatch(context, '/api/admin/settings/', {
      site_title: 'Changed Out From Under The Page',
      revision: baseline.revision,
    });
    expect(concurrent.status()).toBe(200);
    const afterConcurrentEdit = await currentSiteSettings(context);

    await page.goto('/admin/settings');
    await expect(
      page.getByRole('form', { name: 'Site title settings' }).getByLabel('Site title'),
    ).toHaveValue('Changed Out From Under The Page');

    // Restore the baseline immediately so this test's own concurrent
    // write doesn't leak into other tests, then verify the page's own
    // stale-revision path (its in-memory revision is now behind).
    const restore = await apiPatch(context, '/api/admin/settings/', {
      site_title: baseline.site_title,
      revision: afterConcurrentEdit.revision,
    });
    expect(restore.status()).toBe(200);

    await page
      .getByRole('form', { name: 'Site title settings' })
      .getByLabel('Site title')
      .fill('Attempted Stale Write');
    await page
      .getByRole('form', { name: 'Site title settings' })
      .getByRole('button', { name: 'Save', exact: true })
      .click();
    await expect(page.getByText(/someone else changed this/i)).toBeVisible();

    const stillCurrent = await currentSiteSettings(context);
    expect(stillCurrent.site_title).toBe(baseline.site_title);
  });
});

test.describe('Admin AI model catalog (#523)', () => {
  let fixture: ReturnType<typeof requireE2EFixtures>;
  test.beforeAll(() => {
    fixture = requireE2EFixtures();
  });

  test('an admin can add, edit, and delete a catalog entry at both viewports', async ({
    browser,
  }) => {
    test.setTimeout(60000);

    for (const viewport of VIEWPORTS) {
      await test.step(`${viewport.width}x${viewport.height}`, async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.setViewportSize(viewport);
        await loginViaUI(page, fixture.admin.email, fixture.password);

        const modelSlug = `e2e-catalog-model-${viewport.width}-${Date.now()}`;
        await page.goto('/admin/settings');
        await expect(page.getByRole('heading', { name: 'AI model catalog' })).toBeVisible();

        const createForm = page.getByRole('form', { name: 'Add AI model catalog entry' });
        await createForm.getByLabel('Provider').selectOption('gemini');
        await createForm.getByLabel('Model slug').fill(modelSlug);
        await createForm.getByLabel('Display label').fill('E2E catalog model');
        await createForm.getByLabel('Agent run (2D)').check();
        await createForm.getByLabel('Agentic supported').check();
        await createForm.getByRole('button', { name: 'Add model' }).click();

        const row = page.getByRole('form', { name: `Catalog entry gemini/${modelSlug}` });
        await expect(row).toBeVisible();
        await expect(row.getByText(/product capability declaration/i)).toBeVisible();

        // Edit: turn off agentic support and save.
        await row.getByLabel('Agentic supported', { exact: false }).uncheck();
        await row.getByRole('button', { name: 'Save' }).click();
        await expect(row.getByText('Saved.')).toBeVisible();
        await page.reload();
        await expect(
          page
            .getByRole('form', { name: `Catalog entry gemini/${modelSlug}` })
            .getByLabel('Agentic supported', { exact: false }),
        ).not.toBeChecked();

        // Delete: confirm the dialog and the row disappears.
        page.once('dialog', (dialog) => void dialog.accept());
        await page
          .getByRole('form', { name: `Catalog entry gemini/${modelSlug}` })
          .getByRole('button', { name: 'Delete' })
          .click();
        await expect(
          page.getByRole('form', { name: `Catalog entry gemini/${modelSlug}` }),
        ).toHaveCount(0);

        await context.close();
      });
    }
  });

  test('a non-admin cannot reach the catalog API', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginViaUI(page, fixture.other.email, fixture.password);

    const response = await apiGet(context, '/api/admin/ai-models/');
    expect(response.status()).toBe(403);

    await context.close();
  });

  test('a stale revision on the catalog is rejected with a conflict', async ({ page, context }) => {
    await loginViaUI(page, fixture.admin.email, fixture.password);

    const modelSlug = `e2e-catalog-stale-${Date.now()}`;
    const created = await apiPost(context, '/api/admin/ai-models/', {
      vendor: 'gemini',
      model_slug: modelSlug,
      display_label: 'Stale test model',
      task_kinds: ['one_shot_2d'],
      agentic_supported: false,
    });
    expect(created.status()).toBe(201);
    const { id, revision } = (await created.json()) as { id: number; revision: number };

    // A concurrent edit happens "behind the UI's back" via the API.
    const concurrent = await apiPatch(context, `/api/admin/ai-models/${id}/`, {
      revision,
      display_label: 'Changed Out From Under The Page',
    });
    expect(concurrent.status()).toBe(200);

    await page.goto('/admin/settings');
    const row = page.getByRole('form', { name: `Catalog entry gemini/${modelSlug}` });
    await expect(row.getByLabel('Display label')).toHaveValue('Changed Out From Under The Page');

    // A second concurrent edit happens after the page has already loaded
    // (and cached) the first revision -- this is what makes the page's
    // in-memory revision stale by the time it tries to save.
    const afterFirstEdit = await apiGet(context, '/api/admin/ai-models/');
    const rowsAfterFirstEdit = (await afterFirstEdit.json()) as Array<{
      id: number;
      revision: number;
    }>;
    const currentRevision = rowsAfterFirstEdit.find((r) => r.id === id)?.revision;
    const secondConcurrent = await apiPatch(context, `/api/admin/ai-models/${id}/`, {
      revision: currentRevision,
      display_label: 'Changed Out From Under The Page Again',
    });
    expect(secondConcurrent.status()).toBe(200);

    await row.getByLabel('Display label').fill('Attempted Stale Write');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(row.getByText(/changed elsewhere/i)).toBeVisible();

    // Clean up regardless of outcome.
    const current = await apiGet(context, '/api/admin/ai-models/');
    const rows = (await current.json()) as Array<{ id: number; revision: number }>;
    const stillThere = rows.find((r) => r.id === id);
    if (stillThere) {
      await apiDelete(context, `/api/admin/ai-models/${id}/`, { revision: stillThere.revision });
    }
  });
});

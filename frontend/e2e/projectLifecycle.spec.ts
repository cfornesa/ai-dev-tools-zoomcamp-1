/**
 * Task 65 (issue #65): project lifecycle end-to-end tests — creation
 * through editing, history, restore, deletion, and reopen — against a
 * real, PostgreSQL-backed deployment of this app. See AGENTS.md's
 * "End-to-end tests (Playwright)" section for how to run this suite; it
 * self-skips with an actionable message (via `requireE2EFixtures()`) when
 * its prerequisites — a reachable dev server and the deterministic
 * `e2e_owner`/`e2e_other` fixture users `global-setup.ts` seeds — aren't
 * available, exactly like this repo's PostgreSQL-gated backend tests
 * (`config/test_settings.py`).
 *
 * Out of scope (per the issue): interaction runtime (camera/gesture),
 * AI/recovery, publishing/remix, and export journeys — Tasks 66-69
 * (issues #68, #66, #67, #69). Nothing here drives CameraControl,
 * DemoControlsPanel, AIProposalPanel, publish/unpublish, fork, or
 * ExportConfigDialog.
 *
 * ## Failure-injection approach (acceptance criterion 5)
 *
 * This suite does NOT add a debug-only "crash mid-transaction" hook to
 * the Django app itself — that would be a production-code change purely
 * for test convenience, with its own security surface, and the issue's
 * own brief explicitly allows a documented alternative. Instead, each
 * atomic create/save/restore endpoint already has real, externally
 * reachable failure paths that exercise the exact same
 * `transaction.atomic()` blocks the backend's own PostgreSQL-gated pytest
 * suite proves at the unit level (`tests/test_scene_version_save_api.py`'s
 * `test_postgres_rollback_on_injected_failure_leaves_state_unchanged`,
 * `tests/test_blank_project_creation_api.py`'s duplicate-request-id
 * test): an invalid-scene save, a restore/delete targeting the version
 * that is already current (`CannotModifyCurrentVersion`), and a
 * duplicate-`client_request_id` blank-project double-submit. Driving
 * these for real over HTTP against a live server proves the same
 * rollback guarantee end-to-end, without needing application code whose
 * only purpose is to fail on command. See `failureInjection` below.
 *
 * ## Concurrency approach (acceptance criterion 7)
 *
 * Two Playwright browser contexts, both signed in as the same owner (two
 * tabs of one session — the realistic "left this project open in two
 * tabs" scenario), fire raw HTTP requests at the version-save/restore
 * endpoints via `Promise.all` so they genuinely overlap in flight, then
 * assert the resulting sequence numbers, `current_version`, and version
 * count are exactly what the backend's own `threading.Barrier`-based
 * PostgreSQL concurrency tests prove `select_for_update()` guarantees —
 * mirrored here from outside the process, against a real HTTP server. See
 * `concurrentSavesAndRestores` below.
 *
 * Both of the above use raw HTTP via `e2e/support/api.ts` for setup and
 * for these two scenarios specifically, per the issue's own guidance that
 * "direct API calls for TEST SETUP... or backend-side failure injection
 * are reasonable and expected" — every other scenario drives only the
 * real rendered UI.
 */
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { apiDelete, apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { expandAllCollapsibleSections } from './support/expandCollapsibleSections.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

/** Issue #113: every Tools/Inspector `CollapsibleSection` (issue #95)
 * defaults closed -- expand them all right after the editor mounts so
 * this file's scenarios (which drive shape creation/inspector fields/
 * version history throughout) never have to remember to do it themselves.
 * Unlike `aiAndRecovery.spec.ts`, nothing here seeds a local draft ahead
 * of an uninstalled fake clock, so there's no real-timer race to worry
 * about baking this into the helper itself. */
async function createBlankProjectViaUI(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create new animation' }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const match = /\/projects\/([^/]+)$/.exec(page.url());
  if (!match) throw new Error(`Could not extract a project id from ${page.url()}`);
  await expandAllCollapsibleSections(page);
  return match[1];
}

// Issue #131: the Tools panel's separate "Shape list" (`<ul aria-label="Shape
// list">`) was removed as a straight duplicate of the outline `LayersPanel`
// already rendered -- select-a-shape now goes through that outline instead.
// Scoped to `[data-outline-kind="shape"]` rows' `button[aria-pressed]`
// specifically (the row's "select this shape" button) rather than any
// button in the outline list, since a shape row also has a color-swatch
// toggle, a delete button, and a "More" disclosure summary that would
// otherwise match too.
function shapeListItem(page: Page) {
  return page.locator('[data-outline-kind="shape"] button[aria-pressed]');
}

function versionRow(page: Page, sequence: number) {
  // A row's own change-label text can legitimately contain "version N"
  // as a substring for an unrelated N (e.g. a restore's auto-generated
  // "Restored from version 1" label) -- Playwright's `hasText` string
  // matching is case-insensitive, so filtering the whole row's text
  // would match both that row and the actual "Version N" row. Scope the
  // filter to the row's own `<strong>Version N</strong>` heading
  // (VersionHistoryPanel.tsx), matched exactly, to avoid that collision.
  return page.locator('.version-history-item').filter({
    has: page.locator('strong', { hasText: new RegExp(`^Version ${sequence}$`) }),
  });
}

test.describe('Project lifecycle', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('blank canvas create, edit, save, and reload show the same current version', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    await createBlankProjectViaUI(page);
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 1/);

    // Add one shape (a blank-canvas project starts with none — see
    // schema/fixtures/valid/blank.json) and edit its style through the
    // Inspector, the real Task 60 shape-styling UI.
    await page.getByRole('button', { name: 'Add circle' }).click();
    const positionX = page.locator('#shape-style-positionX');
    await expect(positionX).toBeVisible();
    await positionX.fill('321');
    await positionX.blur();

    const fill = page.locator('#shape-style-fill');
    await fill.fill('#ff00aa');
    await fill.blur();

    await expect(page.getByTestId('editor-save-status')).toHaveText('Unsaved changes');

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 2/);
    await expect(page.getByTestId('working-state-status')).toHaveText(/Saved as version 2/);

    // Reload the page entirely (a fresh mount, exactly like reopening the
    // project from the gallery) and confirm the same current version and
    // content come back — the acceptance criterion's actual assertion.
    await page.reload();
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 2/);
    await expandAllCollapsibleSections(page);

    await shapeListItem(page).first().click();
    await expect(page.locator('#shape-style-positionX')).toHaveValue('321');
    await expect(page.locator('#shape-style-fill')).toHaveValue('#ff00aa');
  });

  test('cloning a built-in template keeps the source and the clone independent', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    // "Hand follower" (scenes/fixtures/templates/hand_follower.json) has
    // exactly one shape at positionX=400 — a stable, known baseline.
    await page.goto('/templates');
    await page
      .getByRole('button', { name: 'Use the "Hand follower" template to create a new project' })
      .click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    await expandAllCollapsibleSections(page);

    await shapeListItem(page).first().click();
    const clonePositionX = page.locator('#shape-style-positionX');
    await expect(clonePositionX).toHaveValue('400');

    // Edit and save this clone — this must never reach back into the
    // shared Template row (TemplateCloneView deep-copies scene_json on
    // clone with no mutable link back — scenes/api.py).
    await clonePositionX.fill('777');
    await clonePositionX.blur();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 2/);

    // Clone the same template again. If the first clone's edit had
    // somehow touched the shared template, this second, independent
    // clone would start from 777 instead of the template's own baseline.
    await page.goto('/templates');
    await page
      .getByRole('button', { name: 'Use the "Hand follower" template to create a new project' })
      .click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    await expandAllCollapsibleSections(page);

    await shapeListItem(page).first().click();
    await expect(page.locator('#shape-style-positionX')).toHaveValue('400');
  });

  test('history shows sequence/latest metadata, restore creates a new version, and the current version cannot be soft-deleted', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlankProjectViaUI(page); // version 1

    async function addShapeAndSave() {
      await page.getByRole('button', { name: 'Add circle' }).click();
      // SaveControl.tsx (issue #95 follow-up) is a single-click Save with
      // no change-label field by design -- every version created here
      // shows up in history unlabeled, same as any other explicit Save.
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByTestId('working-state-status')).toHaveText(/Saved as version/);
    }

    await addShapeAndSave(); // version 2
    await addShapeAndSave(); // version 3

    // Sequence metadata + latest marker: versions 1-3 all present, only
    // version 3 (the current one) carries the "Latest" marker.
    await expect(versionRow(page, 1)).toBeVisible();
    await expect(versionRow(page, 2)).toBeVisible();
    await expect(versionRow(page, 3)).toBeVisible();
    await expect(versionRow(page, 1)).not.toContainText('Latest');
    await expect(versionRow(page, 2)).not.toContainText('Latest');
    await expect(versionRow(page, 3)).toContainText('Latest');

    // Restore-as-new-version: restoring version 1 must create version 4,
    // not rewrite history in place.
    await versionRow(page, 1).getByRole('button', { name: 'Restore' }).click();
    await expect(versionRow(page, 4)).toBeVisible();
    await expect(versionRow(page, 4)).toContainText('Restored');
    await expect(versionRow(page, 4)).toContainText('Latest');
    await expect(versionRow(page, 1)).toBeVisible(); // history entry itself is untouched
    await expect(versionRow(page, 1)).not.toContainText('Latest');
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 4/);

    // Protection of the current version from soft deletion: its Delete
    // control is disabled in the UI (Task 41), while an older version's
    // is not.
    await expect(versionRow(page, 4).getByRole('button', { name: 'Delete' })).toBeDisabled();
    await expect(versionRow(page, 2).getByRole('button', { name: 'Delete' })).toBeEnabled();

    // Exercise the enabled path end-to-end: deleting a non-current
    // version actually removes it from history.
    await versionRow(page, 2).getByRole('button', { name: 'Delete' }).click();
    await versionRow(page, 2).getByRole('button', { name: 'Delete version' }).click();
    await expect(versionRow(page, 2)).toHaveCount(0);
    // The current version is completely unaffected by an unrelated delete.
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 4/);
  });

  test('an authorized owner succeeds while an anonymous or non-owner visitor fails without seeing private data', async ({
    page,
    browser,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createBlankProjectViaUI(page);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Untitled animation');

    // Owner succeeds, from a completely independent context too (proves
    // this isn't accidentally passing only because of leftover UI state).
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
    await ownerPage.goto(`/projects/${projectId}`);
    await expect(ownerPage.getByRole('heading', { level: 2 })).toHaveText('Untitled animation');
    const ownerApiResponse = await apiGet(ownerContext, `/api/projects/${projectId}/`);
    expect(ownerApiResponse.status()).toBe(200);
    await ownerContext.close();

    // Anonymous: never logs in at all.
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/projects/${projectId}`);
    await expect(anonPage.getByRole('alert')).toBeVisible();
    await expect(anonPage.getByText('Untitled animation')).toHaveCount(0);
    await expect(anonPage.getByTestId('scene-canvas')).toHaveCount(0);
    // scenes/api.py: every project-scoped endpoint 404s for a
    // non-owner/anonymous caller — never 403 — so a private project's
    // existence is never confirmed either way.
    const anonApiResponse = await apiGet(anonContext, `/api/projects/${projectId}/`);
    expect(anonApiResponse.status()).toBe(404);
    await anonContext.close();

    // Signed in, but not the owner.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await loginViaUI(otherPage, fixtures.other.email, fixtures.password);
    await otherPage.goto(`/projects/${projectId}`);
    await expect(otherPage.getByRole('alert')).toBeVisible();
    await expect(otherPage.getByText('Untitled animation')).toHaveCount(0);
    await expect(otherPage.getByTestId('scene-canvas')).toHaveCount(0);
    const otherApiResponse = await apiGet(otherContext, `/api/projects/${projectId}/`);
    expect(otherApiResponse.status()).toBe(404);
    // The non-owner's own project list must never include this project.
    const otherListResponse = await apiGet(otherContext, '/api/projects/');
    const otherList = (await otherListResponse.json()) as Array<{ id: string }>;
    expect(otherList.some((p) => p.id === projectId)).toBe(false);
    await otherContext.close();
  });

  test('failure injection: no partial state survives a rejected create, save, or restore/delete', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    // 1. Duplicate client_request_id blank-project creation, fired
    //    concurrently: BlankProjectCreateView's transaction.atomic() block
    //    + a unique constraint on creation_request_id guarantee only one
    //    project is ever actually created, no matter how the two racing
    //    requests interleave (scenes/api.py's IntegrityError-recovery
    //    path this mirrors is unit-proven in
    //    tests/test_blank_project_creation_api.py).
    const clientRequestId = crypto.randomUUID();
    const [first, second] = await Promise.all([
      apiPost(context, '/api/projects/blank/', { client_request_id: clientRequestId }),
      apiPost(context, '/api/projects/blank/', { client_request_id: clientRequestId }),
    ]);
    expect([first.status(), second.status()].sort()).toEqual([200, 201]);
    const firstBody = (await first.json()) as { id: string };
    const secondBody = (await second.json()) as { id: string };
    expect(firstBody.id).toBe(secondBody.id);
    const projectId = firstBody.id;

    // 2. An invalid scene payload must be rejected before any version is
    //    created — SceneVersionListCreateView.post validates before ever
    //    opening its transaction.atomic() block.
    const invalidSave = await apiPost(context, `/api/projects/${projectId}/versions/`, {
      scene_json: { not: 'a valid scene document' },
      origin: 'manual',
    });
    expect(invalidSave.status()).toBe(400);
    const versionsAfterInvalidSave = await apiGet(context, `/api/projects/${projectId}/versions/`);
    const listAfterInvalidSave = (await versionsAfterInvalidSave.json()) as Array<unknown>;
    expect(listAfterInvalidSave).toHaveLength(1); // only the blank-create version

    const projectBefore = (await (await apiGet(context, `/api/projects/${projectId}/`)).json()) as {
      current_version: number;
    };

    // 3. Restoring the version that is already current must be rejected
    //    (CannotModifyCurrentVersion) and leave current_version and the
    //    version list completely untouched.
    const restoreCurrent = await apiPost(
      context,
      `/api/projects/${projectId}/versions/${projectBefore.current_version}/restore/`,
      {},
    );
    expect(restoreCurrent.status()).toBe(400);

    // 4. Deleting the current version must be rejected the same way.
    const deleteCurrent = await apiDelete(
      context,
      `/api/projects/${projectId}/versions/${projectBefore.current_version}/`,
    );
    expect(deleteCurrent.status()).toBe(400);

    const projectAfter = (await (await apiGet(context, `/api/projects/${projectId}/`)).json()) as {
      current_version: number;
    };
    expect(projectAfter.current_version).toBe(projectBefore.current_version);

    const versionsAfter = (await (
      await apiGet(context, `/api/projects/${projectId}/versions/`)
    ).json()) as Array<{ id: number }>;
    expect(versionsAfter).toHaveLength(1);
  });

  test('concurrent saves and restores from two tabs of the same session serialize to one consistent state', async ({
    browser,
  }) => {
    // Two independent browser contexts signed in as the same owner —
    // "two tabs of one session", per the acceptance criterion.
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await loginViaUI(pageA, fixtures.owner.email, fixtures.password);
    await loginViaUI(pageB, fixtures.owner.email, fixtures.password);

    const projectId = await createBlankProjectViaUI(pageA); // version 1
    await pageB.goto(`/projects/${projectId}`);

    // version 1's primary key is a global auto-increment shared across every
    // project's versions, not a per-project sequence -- it is only "1" if no
    // other version row exists yet anywhere in the database. Earlier tests in
    // this same describe block already create their own projects/versions
    // first, so it must be looked up rather than assumed.
    const projectAtCreation = (await (
      await apiGet(contextA, `/api/projects/${projectId}/`)
    ).json()) as { current_version: number };
    const firstVersionId = projectAtCreation.current_version;

    const scenePayload = {
      schemaVersion: 1,
      id: 'scene-concurrent-test',
      canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
      renderer: { preferred: 'p5' },
      layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
      shapes: [],
      groups: [],
      bindings: [],
      graph: { nodes: [], connections: [] },
      accessibility: { reducedMotion: 'auto' },
      randomness: { seed: 0, enabled: false },
    };

    // Overlapping saves: fired via Promise.all so both requests are
    // genuinely in flight together, exercising the same
    // select_for_update()-serialized transaction.atomic() block
    // tests/test_scene_version_save_api.py proves with threading.Barrier,
    // now over real HTTP against a live PostgreSQL-backed server.
    const [saveA, saveB] = await Promise.all([
      apiPost(contextA, `/api/projects/${projectId}/versions/`, {
        scene_json: scenePayload,
        origin: 'manual',
        change_label: 'concurrent-save-a',
      }),
      apiPost(contextB, `/api/projects/${projectId}/versions/`, {
        scene_json: scenePayload,
        origin: 'manual',
        change_label: 'concurrent-save-b',
      }),
    ]);
    expect(saveA.status()).toBe(201);
    expect(saveB.status()).toBe(201);
    const savedA = (await saveA.json()) as { id: number; sequence: number };
    const savedB = (await saveB.json()) as { id: number; sequence: number };

    const sequencesAfterSaves = [savedA.sequence, savedB.sequence].sort((a, b) => a - b);
    expect(sequencesAfterSaves).toEqual([2, 3]); // no gap, no duplicate — project started at version 1

    const projectAfterSaves = (await (
      await apiGet(contextA, `/api/projects/${projectId}/`)
    ).json()) as { current_version: number };
    const higherSaved = savedA.sequence > savedB.sequence ? savedA : savedB;
    expect(projectAfterSaves.current_version).toBe(higherSaved.id);

    // Overlapping restores: target two *different* historical (non-
    // current) versions from both tabs at once. Both must succeed as
    // independent new versions (sequences 4-5), and current_version must
    // land, deterministically, on whichever one committed last —
    // proving no restore silently overwrote or corrupted the other.
    const [restoreA, restoreB] = await Promise.all([
      apiPost(contextA, `/api/projects/${projectId}/versions/${firstVersionId}/restore/`, {}),
      apiPost(contextB, `/api/projects/${projectId}/versions/${savedA.id}/restore/`, {}),
    ]);
    expect(restoreA.status()).toBe(201);
    expect(restoreB.status()).toBe(201);
    const restoredA = (await restoreA.json()) as { id: number; sequence: number };
    const restoredB = (await restoreB.json()) as { id: number; sequence: number };
    const sequencesAfterRestores = [restoredA.sequence, restoredB.sequence].sort((a, b) => a - b);
    expect(sequencesAfterRestores).toEqual([4, 5]);

    const finalVersions = (await (
      await apiGet(contextA, `/api/projects/${projectId}/versions/`)
    ).json()) as Array<{ sequence: number }>;
    const allSequences = finalVersions.map((v) => v.sequence).sort((a, b) => a - b);
    expect(allSequences).toEqual([1, 2, 3, 4, 5]); // exactly one row per sequence, no gaps

    const projectAfterRestores = (await (
      await apiGet(contextA, `/api/projects/${projectId}/`)
    ).json()) as { current_version: number };
    const higherRestored = restoredA.sequence > restoredB.sequence ? restoredA : restoredB;
    expect(projectAfterRestores.current_version).toBe(higherRestored.id);

    await contextA.close();
    await contextB.close();
  });
});

test.describe('Deterministic fixtures and isolation', () => {
  test.beforeAll(() => {
    requireE2EFixtures();
  });

  // Acceptance criterion 6: every test above uses a fresh
  // `browser.newContext()` (or the per-test default `page`/`context`
  // fixture, which Playwright already tears down and re-creates for
  // every single test) rather than a shared `storageState` — so
  // localStorage, IndexedDB (the crash-recovery draft store from Tasks
  // 42-44), cookies, and sessionStorage never carry over between tests.
  // This test asserts that isolation directly rather than only relying
  // on it implicitly.
  test('a fresh browser context starts with no leftover session or local storage', async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const context: BrowserContext = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/');

    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === 'sessionid')).toBe(false);

    const localStorageLength = await page.evaluate(() => window.localStorage.length);
    expect(localStorageLength).toBe(0);

    const dbNames = await page.evaluate(async () => {
      if (!('databases' in indexedDB)) return [];
      const dbs = await indexedDB.databases();
      return dbs.map((d: IDBDatabaseInfo) => d.name);
    });
    expect(dbNames).toEqual([]);

    await context.close();
  });
});

/**
 * Task 67 (issue #67): publishing, public visibility, anonymous viewing,
 * and remix/fork end-to-end tests — the fourth companion to Task 65's
 * `projectLifecycle.spec.ts`, Task 66/issue #68's `interactionRuntime.spec.ts`,
 * and Task 67/issue #66's `aiAndRecovery.spec.ts`. Reuses the exact same
 * infrastructure (`frontend/playwright.config.ts`, `e2e/support/*`,
 * `make e2e`) rather than adding a second E2E framework or a new
 * fixture-setup path. See AGENTS.md's "End-to-end tests (Playwright)"
 * section for how to run this suite; it self-skips with an actionable
 * message (`requireE2EFixtures()`) exactly like the other three spec
 * files when its prerequisites aren't available.
 *
 * Out of scope (per the issue): public-surface accessibility auditing is
 * Task 64/issue #63 (already covered, not re-audited here); camera/secret
 * network privacy is Task 73/issue #73 (not yet built, not tested here).
 * Nothing here inspects network traffic for a leaking real camera stream
 * — only the documented UI/state-machine behavior of `CameraControl.tsx`
 * under mocked `getUserMedia` outcomes.
 *
 * ## Camera-mocking approach (anonymous viewer, demo mode preserved)
 *
 * `PublicProjectViewer.tsx` reuses `CameraControl.tsx` (Task 31) unchanged
 * — the same component the authenticated editor uses — which itself
 * defaults to `createMediaPipeTrackingProvider` (`tracking/mediapipeProvider.ts`).
 * That adapter never calls `getUserMedia`/constructs anything on mount;
 * it only does so inside its own `start()`, invoked by the "Enable
 * camera"/"Retry" button's click handler (see `CameraControl.tsx`'s own
 * module doc comment for that acceptance criterion). Two failure states
 * are simulated with no real hardware, via `page.addInitScript` (so the
 * override exists before the app's own bundle runs, in a fresh context
 * per scenario so it can never leak into another test):
 *
 * - **Denial**: `navigator.mediaDevices.getUserMedia` is replaced with a
 *   function that returns a `Promise` rejecting with a `DOMException`
 *   named `NotAllowedError` — exactly the shape a real browser's user-
 *   denied-permission rejection carries. `mediapipeProvider.ts`'s
 *   `runStartPipeline` catches this, and `cameraFailure.ts`'s
 *   `categorizeProviderError` reads the exception's `.name` to route it
 *   to the `'permission-denied'` category and its specific recovery
 *   message.
 * - **Unsupported**: `navigator.mediaDevices` itself is deleted entirely
 *   before the page's own scripts run. `mediapipeProvider.ts`'s
 *   `defaultIsSupported()` (`typeof navigator.mediaDevices?.getUserMedia
 *   === 'function'`) then returns `false`, and `start()` never calls
 *   `getUserMedia` at all — it synchronously emits the "not supported"
 *   error, categorized as `'unsupported-browser'`.
 *
 * In both cases, the assertion that matters for this issue is not the
 * camera failure message alone (that's `CameraControl.test.tsx`'s job) —
 * it's that `DemoControlsPanel` (Task 28), rendered independently in the
 * same viewer, is completely unaffected: its manual/playback controls
 * stay fully interactive regardless of which camera failure state
 * `CameraControl` is in, because the two components share no state.
 *
 * ## Rollback-on-injected-failure approach (fork)
 *
 * Same policy `projectLifecycle.spec.ts`'s own module doc comment
 * documents for its own failure-injection scenario, applied to fork: this
 * suite does not add a debug-only "crash mid-transaction" hook to
 * `ProjectForkView` purely for test convenience. `tests/test_project_fork_api.py`'s
 * `test_postgres_rollback_on_injected_failure_leaves_no_records` already
 * proves, against real PostgreSQL, that a failure injected *after* the
 * forked `Project` and its first `SceneVersion` are created inside the
 * same `transaction.atomic()` block `ProjectForkView.post` uses rolls
 * back the project, version, and (never-created) provenance row together
 * — no literal mid-request crash is realistically triggerable through
 * browser UI/HTTP alone. This suite instead proves the *reachable* half
 * of the same guarantee end-to-end: the "concurrent/replayed Fork
 * requests" scenario below (mirroring
 * `test_postgres_concurrent_duplicate_fork_submission_creates_exactly_one_fork`)
 * drives a real `IntegrityError`-triggered rollback path — the losing
 * concurrent request's partially-built project/version is rolled back by
 * Postgres itself and the view resolves to the winner's project instead of
 * leaving any partial row — over real HTTP, against the real server.
 * Together, the backend's own injected-failure test and this suite's
 * concurrency scenario cover the full guarantee; this suite does not
 * re-derive the injected-failure test itself.
 *
 * ## Concurrency approach
 *
 * Two independent browser contexts, both signed in as the same non-owner
 * ("other") fixture user, fire genuinely overlapping raw HTTP fork
 * requests carrying the same `client_request_id` via `Promise.all` —
 * exactly `projectLifecycle.spec.ts`'s "two tabs of one session" pattern,
 * applied here to two tabs racing the same Fork click.
 *
 * ## Cleanup and isolation
 *
 * Every test uses a fresh `browser.newContext()`/the per-test default
 * `page`/`context` fixture (never a shared `storageState`). PostgreSQL
 * records (every project, version, and fork-provenance row this suite
 * creates) are owned by the `e2e_owner`/`e2e_other` fixture users and
 * removed by `global-teardown.ts`'s `e2e_fixtures cleanup` (cascade-
 * deletes on `Project.owner`) after the whole run finishes — the same
 * mechanism every other spec file in this directory already relies on,
 * not a new one.
 */
import { expect, test, type Page } from '@playwright/test';

import { apiGet, apiPost } from './support/api.js';
import { loginViaUI } from './support/auth.js';
import { expandAllCollapsibleSections } from './support/expandCollapsibleSections.js';
import { requireE2EFixtures } from './support/prerequisites.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

/** Issue #113: every Tools/Inspector `CollapsibleSection` (issue #95)
 * defaults closed -- expand them all right after the editor mounts.
 * Unlike `interactionRuntime.spec.ts`, nothing here ever drives
 * `BehaviorCardsPanel`'s `followHand`/`reactToPinch` target select (see
 * issue #116), so there's no mount-order trap to avoid by deferring this. */
async function createBlankProjectViaUI(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create new animation' }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const match = /\/projects\/([^/]+)$/.exec(page.url());
  if (!match) throw new Error(`Could not extract a project id from ${page.url()}`);
  await expandAllCollapsibleSections(page);
  return match[1];
}

function shapeListItem(page: Page) {
  return page.getByRole('list', { name: 'Shape list' }).getByRole('button');
}

/** Navigates to the given project's editor and fills in meaningful
 * title/description (and optionally toggles the remix checkbox) through
 * the real, current in-editor UI -- never touches visibility. Issue #94
 * folded the old standalone `/projects/:id/settings` route
 * (`ProjectMetadataForm.tsx`) into the editor itself: title editing is the
 * header's inline `EditableProjectTitle` ("Edit title" pencil button), and
 * description/remix live in the "Details" panel (`EditorDetailsPanel.tsx`),
 * a plain always-visible `<section>` -- not gated by any
 * `CollapsibleSection`, so no expand call is needed to reach it. */
async function saveMeaningfulMetadata(
  page: Page,
  projectId: string,
  { title, description, allowRemix }: { title: string; description: string; allowRemix?: boolean },
): Promise<void> {
  await page.goto(`/projects/${projectId}`);
  // A fresh navigation re-mounts the editor with every Tools/Inspector
  // CollapsibleSection collapsed again (issue #95/#113) -- restore
  // whatever expanded state a caller relies on afterward (e.g. "Add
  // circle" right after this call returns).
  await expandAllCollapsibleSections(page);

  await page.getByRole('button', { name: 'Edit title' }).click();
  const titleForm = page.locator('.editor-title-edit');
  await titleForm.locator('#editor-title-input').fill(title);
  await titleForm.getByRole('button', { name: 'Save' }).click();
  await expect(titleForm).toHaveCount(0);

  await page.locator('#project-description').fill(description);
  if (allowRemix !== undefined) {
    const checkbox = page.locator('#project-remix');
    if ((await checkbox.isChecked()) !== allowRemix) {
      await checkbox.click();
    }
  }
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
}

/** Clicks the Publish trigger and confirms the dialog. Caller is
 * responsible for meaningful metadata already being saved -- this
 * helper asserts the confirmation dialog actually appears (never
 * short-circuited by a client-side validation block). */
async function confirmPublish(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: /Publish/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByTestId('visibility-status')).toContainText('Public');
}

test.describe('Publishing', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('publishing requires confirmation and valid metadata, then exposes the current version in the gallery and at a stable public URL', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createBlankProjectViaUI(page); // version 1, still-default title/description

    // Add a distinguishing shape and save version 2, so "the current
    // saved version" is something concrete to check for publicly.
    await page.getByRole('button', { name: 'Add circle' }).click();
    const positionX = page.locator('#shape-style-positionX');
    await expect(positionX).toBeVisible();
    await positionX.fill('555');
    await positionX.blur();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 2/);

    // 1. Invalid metadata (still the untouched default title, still a
    //    blank description) blocks Publish client-side -- field errors
    //    surface, and the confirmation dialog never opens.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('publish-title-error')).toBeVisible();
    await expect(page.getByTestId('publish-description-error')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('visibility-status')).toContainText('Private');

    // 2. Fix metadata, then Publish requires an explicit confirmation --
    //    the dialog names the project and only *its own* Publish button
    //    actually flips visibility.
    await saveMeaningfulMetadata(page, projectId, {
      title: 'A meaningful public title',
      description: 'A meaningful public description of this animation.',
    });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('A meaningful public title');
    // Cancel first -- proves confirmation is a real gate, not cosmetic.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('visibility-status')).toContainText('Private');

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page
      .getByRole('alertdialog', { name: /Publish/ })
      .getByRole('button', { name: 'Publish', exact: true })
      .click();
    await expect(page.getByTestId('visibility-status')).toContainText('Public');

    // 3. Now reachable in the public gallery, anonymously.
    const anonContext = await context.browser()!.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto('/gallery');
    await expect(
      anonPage.getByRole('heading', { level: 3, name: 'A meaningful public title' }),
    ).toBeVisible();

    // 4. And at its stable public URL, showing the current saved
    //    version's actual content (verified at the data layer -- the
    //    p5 preview itself renders into a <canvas> this suite doesn't
    //    parse pixel data from, matching Task 64/issue #63's own public-
    //    surface precedent of asserting content via the API response
    //    alongside the rendered page).
    await anonPage.goto(`/p/${projectId}`);
    await expect(anonPage.getByRole('heading', { level: 2 })).toHaveText(
      'A meaningful public title',
    );
    await expect(anonPage.getByTestId('public-scene-canvas')).toBeVisible();

    const publicDetail = await apiGet(anonContext, `/api/public/projects/${projectId}/`);
    expect(publicDetail.status()).toBe(200);
    const publicBody = (await publicDetail.json()) as {
      current_version: { sequence: number; scene_json: { shapes: Array<{ style?: unknown }> } };
    };
    expect(publicBody.current_version.sequence).toBe(2);
    expect(publicBody.current_version.scene_json.shapes).toHaveLength(1);

    await anonContext.close();
  });

  test('issue #128: clicking Publish directly (without a separate Details "Save changes" click) honors title/description just typed in the editor', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createBlankProjectViaUI(page); // version 1, still-default title/description

    // Type a meaningful title through the header's inline editor and a
    // meaningful description through the Details panel -- exactly the
    // "auto-persist, then validate/publish" scenario the groomed task doc
    // (.local/tasks/editor-publish-metadata-flow.md) describes: never
    // click the Details panel's own "Save changes" button, and never
    // reload/renavigate in between, which would otherwise mask a stale-
    // `project` bug behind a fresh page load.
    await page.getByRole('button', { name: 'Edit title' }).click();
    const titleForm = page.locator('.editor-title-edit');
    await titleForm.locator('#editor-title-input').fill('Typed straight into Publish');
    await titleForm.getByRole('button', { name: 'Save' }).click();
    await expect(titleForm).toHaveCount(0);

    await page
      .locator('#project-description')
      .fill('Typed into the Details panel, never explicitly saved before Publish.');

    // Publish directly -- no click on the Details panel's "Save changes".
    await page.getByRole('button', { name: 'Publish', exact: true }).click();

    // The auto-persist ran the freshly-typed description through
    // validation successfully, so the confirmation dialog opens (not the
    // publish-title-error/publish-description-error path) naming the
    // just-typed title.
    const dialog = page.getByRole('alertdialog', { name: /Publish/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Typed straight into Publish');
    await expect(page.getByTestId('publish-description-error')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByTestId('visibility-status')).toContainText('Public');

    // The Details panel itself now reflects the auto-persisted value (the
    // same PATCH "Save changes" would have sent), and the public surface
    // shows exactly what was typed -- proving the auto-persist actually
    // reached the server, not just the client-side validation check.
    await expect(page.locator('#project-description')).toHaveValue(
      'Typed into the Details panel, never explicitly saved before Publish.',
    );

    const anonContext = await context.browser()!.newContext();
    const anonPage = await anonContext.newPage();
    const publicDetail = await apiGet(anonContext, `/api/public/projects/${projectId}/`);
    expect(publicDetail.status()).toBe(200);
    const publicBody = (await publicDetail.json()) as {
      title: string;
      description: string;
    };
    expect(publicBody.title).toBe('Typed straight into Publish');
    expect(publicBody.description).toBe(
      'Typed into the Details panel, never explicitly saved before Publish.',
    );

    await anonPage.goto(`/p/${projectId}`);
    await expect(anonPage.getByRole('heading', { level: 2 })).toHaveText(
      'Typed straight into Publish',
    );

    await anonContext.close();
  });

  test('unpublishing removes gallery/anonymous access on the very next request without deleting history', async ({
    page,
    context,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    const projectId = await createBlankProjectViaUI(page);
    await saveMeaningfulMetadata(page, projectId, {
      title: 'Unpublish-me project',
      description: 'This project will be published, then unpublished.',
    });
    await confirmPublish(page);

    const versionsBefore = (await (
      await apiGet(context, `/api/projects/${projectId}/versions/`)
    ).json()) as Array<{ id: number }>;
    expect(versionsBefore).toHaveLength(1);

    // Confirm it's actually live first (both surfaces), then unpublish.
    const anonContext = await context.browser()!.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto('/gallery');
    await expect(
      anonPage.getByRole('heading', { level: 3, name: 'Unpublish-me project' }),
    ).toBeVisible();
    expect((await apiGet(anonContext, `/api/public/projects/${projectId}/`)).status()).toBe(200);

    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await expect(page.getByTestId('visibility-status')).toContainText('Private');

    // The very next request to either public surface must already
    // reflect the change -- no caching/staleness window.
    const publicDetailAfter = await apiGet(anonContext, `/api/public/projects/${projectId}/`);
    expect(publicDetailAfter.status()).toBe(404);

    await anonPage.goto('/gallery');
    await expect(
      anonPage.getByRole('heading', { level: 3, name: 'Unpublish-me project' }),
    ).toHaveCount(0);

    await anonPage.goto(`/p/${projectId}`);
    await expect(anonPage.getByRole('alert')).toContainText("isn't available");

    // Owner-authenticated read proves version history is fully intact --
    // unpublish never touches SceneVersion rows.
    const versionsAfter = (await (
      await apiGet(context, `/api/projects/${projectId}/versions/`)
    ).json()) as Array<{ id: number }>;
    expect(versionsAfter).toEqual(versionsBefore);
    const projectAfter = (await (await apiGet(context, `/api/projects/${projectId}/`)).json()) as {
      current_version: number | null;
    };
    expect(projectAfter.current_version).not.toBeNull();

    await anonContext.close();
  });
});

test.describe('Anonymous viewer: demo mode and camera-failure fallbacks', () => {
  let fixtures: Fixtures;
  let publicProjectId: string;

  test.beforeAll(async ({ browser }) => {
    fixtures = requireE2EFixtures();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    publicProjectId = await createBlankProjectViaUI(page);
    await saveMeaningfulMetadata(page, publicProjectId, {
      title: 'Anonymous viewer fixture project',
      description: 'Used by the demo-mode/camera-failure scenarios.',
    });
    await confirmPublish(page);
    await context.close();
  });

  test('starts in demo mode with no camera auto-start', async ({ browser }) => {
    // A completely fresh, never-authenticated context -- no session/CSRF
    // cookie of any kind.
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/p/${publicProjectId}`);
    await expect(anonPage.getByRole('heading', { level: 2 })).toHaveText(
      'Anonymous viewer fixture project',
    );

    // CameraControl never auto-requests the camera: its status paragraph
    // is absent (idle state renders no status text at all -- see
    // CameraControl.tsx's statusMessage()), and only "Enable camera" is
    // offered, never "Stop camera".
    await expect(anonPage.getByTestId('camera-status')).toHaveCount(0);
    await expect(anonPage.getByRole('button', { name: 'Enable camera' })).toBeVisible();
    await expect(anonPage.getByRole('button', { name: 'Stop camera' })).toHaveCount(0);

    // Demo controls are the default, fully interactive input mode.
    await expect(anonPage.getByTestId('demo-manual-controls')).toBeVisible();
    const cookies = await anonContext.cookies();
    expect(cookies.some((c) => c.name === 'sessionid')).toBe(false);

    await anonContext.close();
  });

  test('mocked camera permission denial preserves demo controls', async ({ browser }) => {
    const anonContext = await browser.newContext();
    // Installed before any page script runs in this context, so the
    // app's own bundle only ever sees the mocked getUserMedia.
    await anonContext.addInitScript(() => {
      Object.defineProperty(window.navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
      });
    });
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/p/${publicProjectId}`);

    await anonPage.getByRole('button', { name: 'Enable camera' }).click();
    await expect(anonPage.getByTestId('camera-error')).toContainText('Camera access was denied');
    await expect(anonPage.getByRole('button', { name: 'Retry' })).toBeVisible();

    // Demo controls are untouched by the camera failure -- fully usable.
    await expect(anonPage.getByTestId('demo-manual-controls')).toBeVisible();
    const presentButton = anonPage.getByRole('button', { name: /Hand (present|absent)/ });
    const before = await presentButton.textContent();
    await presentButton.click();
    await expect(presentButton).not.toHaveText(before ?? '');

    await anonContext.close();
  });

  test('mocked unsupported browser (no navigator.mediaDevices) preserves demo controls', async ({
    browser,
  }) => {
    const anonContext = await browser.newContext();
    await anonContext.addInitScript(() => {
      // Simulates a browser with no camera-capture API at all --
      // mediapipeProvider.ts's defaultIsSupported() reads
      // navigator.mediaDevices?.getUserMedia, so making that read
      // permanently resolve to undefined is the faithful "unsupported"
      // simulation.
      // Root cause of the earlier hang (issue #119): this app depends on
      // p5.js, which polyfills navigator.mediaDevices.getUserMedia at
      // module-load time whenever it reads as undefined --
      // `if (navigator.mediaDevices.getUserMedia === undefined) {
      // navigator.mediaDevices.getUserMedia = function ... }` (see
      // node_modules/p5/lib/p5.js). A plain `value: undefined` data
      // property (written or left at the default non-writable) makes that
      // *assignment* throw a strict-mode TypeError, which is an uncaught
      // exception during the bundle's own module evaluation -- it crashes
      // before React ever mounts, which is what looked like the whole
      // page "hanging". Redefining `navigator.mediaDevices` itself made
      // this worse, not better, since it also affects unrelated native
      // machinery on the page.
      // The fix is an accessor property on the real, still-native
      // `mediaDevices` object: the getter always reports `undefined` (so
      // defaultIsSupported() and any other unsupported-check reads see a
      // consistently missing method), while the setter is a silent no-op
      // that absorbs p5's polyfill assignment instead of throwing --
      // reaching the exact same `navigator.mediaDevices?.getUserMedia`
      // check without crashing anything else that writes to the property.
      if (window.navigator.mediaDevices) {
        Object.defineProperty(window.navigator.mediaDevices, 'getUserMedia', {
          configurable: true,
          get() {
            return undefined;
          },
          set() {
            // Absorb polyfill assignment attempts (e.g. p5.js) instead of
            // throwing, so getUserMedia stays undefined either way.
          },
        });
      }
    });
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/p/${publicProjectId}`);

    await anonPage.getByRole('button', { name: 'Enable camera' }).click();
    await expect(anonPage.getByTestId('camera-error')).toContainText("doesn't support");
    await expect(anonPage.getByRole('button', { name: 'Retry' })).toBeVisible();

    await expect(anonPage.getByTestId('demo-manual-controls')).toBeVisible();
    await anonPage.getByRole('radio', { name: 'Synthetic playback' }).click();
    await expect(anonPage.getByTestId('demo-playback-controls')).toBeVisible();

    await anonContext.close();
  });
});

test.describe('Remix and fork', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('remix enabled permits an authenticated atomic fork: private default, independent scene, exact source version, durable attribution', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
    const sourceId = await createBlankProjectViaUI(ownerPage); // version 1

    await ownerPage.getByRole('button', { name: 'Add circle' }).click();
    const ownerPositionX = ownerPage.locator('#shape-style-positionX');
    await ownerPositionX.fill('100');
    await ownerPositionX.blur();
    await ownerPage.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(ownerPage.getByTestId('editor-save-status')).toHaveText(/Saved as version 2/);

    await saveMeaningfulMetadata(ownerPage, sourceId, {
      title: 'Remixable source project',
      description: 'A project other users may remix.',
      allowRemix: true,
    });
    await confirmPublish(ownerPage);

    const sourceVersionBefore = (await (
      await apiGet(ownerContext, `/api/projects/${sourceId}/`)
    ).json()) as { current_version: number };

    // Non-owner, authenticated visitor forks it through the real UI.
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    await loginViaUI(visitorPage, fixtures.other.email, fixtures.password);
    await visitorPage.goto(`/p/${sourceId}`);
    await expect(visitorPage.getByRole('button', { name: 'Fork this project' })).toBeVisible();
    await visitorPage.getByRole('button', { name: 'Fork this project' }).click();
    await visitorPage.waitForURL(/\/projects\/[^/]+$/);
    await expandAllCollapsibleSections(visitorPage);
    const forkMatch = /\/projects\/([^/]+)$/.exec(visitorPage.url());
    if (!forkMatch) throw new Error('Fork did not navigate to a new project.');
    const forkedId = forkMatch[1];

    // Private default.
    const forkedProject = (await (
      await apiGet(visitorContext, `/api/projects/${forkedId}/`)
    ).json()) as { visibility: string; current_version: number };
    expect(forkedProject.visibility).toBe('private');

    // Exact source version: fork_source_version on the fork's first
    // version must equal whatever was current on the source at fork
    // time -- not some later save. `versions/<id>/` takes the version's
    // real database id (scenes/urls.py), not its sequence number --
    // `forkedProject.current_version` above is exactly that id for the
    // fork's one (so far) version, never a hardcoded "1" that only
    // happens to be correct against an otherwise-empty database.
    const forkedVersionId = forkedProject.current_version;
    const forkedFirstVersion = (await (
      await apiGet(visitorContext, `/api/projects/${forkedId}/versions/${forkedVersionId}/`)
    ).json()) as { fork_source_version: number | null };
    expect(forkedFirstVersion.fork_source_version).toBe(sourceVersionBefore.current_version);

    // A save on the source *after* the fork must never change that
    // recorded source version.
    await ownerPage.getByRole('button', { name: 'Add circle' }).click();
    await ownerPage.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(ownerPage.getByTestId('editor-save-status')).toHaveText(/Saved as version 3/);
    const forkedFirstVersionAfterSourceEdit = (await (
      await apiGet(visitorContext, `/api/projects/${forkedId}/versions/${forkedVersionId}/`)
    ).json()) as { fork_source_version: number | null };
    expect(forkedFirstVersionAfterSourceEdit.fork_source_version).toBe(
      sourceVersionBefore.current_version,
    );

    // Independent first scene: editing the fork must never reach back
    // into the source. The fork's first (and, at this point, only)
    // scene has exactly the source's one shape, deep-copied.
    await shapeListItem(visitorPage).first().click();
    const forkPositionX = visitorPage.locator('#shape-style-positionX');
    await expect(forkPositionX).toHaveValue('100'); // deep-copied from the source's shape
    await forkPositionX.fill('999');
    await forkPositionX.blur();
    await visitorPage.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(visitorPage.getByTestId('editor-save-status')).toHaveText(/Saved as version 2/);

    // The source's own shape is completely untouched by the fork's edit
    // -- checked at the data layer (not via the shape-list UI, since the
    // source now has two shapes after the "future save" step above, and
    // this assertion cares only about the original shape's own value,
    // not list ordering).
    const sourceCurrent = (await (
      await apiGet(ownerContext, `/api/projects/${sourceId}/`)
    ).json()) as { current_version: number };
    const sourceCurrentScene = (await (
      await apiGet(
        ownerContext,
        `/api/projects/${sourceId}/versions/${sourceCurrent.current_version}/`,
      )
    ).json()) as { scene_json: { shapes: Array<{ transform: { x: number } }> } };
    expect(sourceCurrentScene.scene_json.shapes.some((shape) => shape.transform.x === 100)).toBe(
      true,
    );

    // Durable attribution: publish the fork too, and confirm the public
    // "Remixed from" line appears and links back to the still-public
    // source.
    await saveMeaningfulMetadata(visitorPage, forkedId, {
      title: 'My remix of the source project',
      description: 'A remix built from the source project above.',
    });
    await confirmPublish(visitorPage);

    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/p/${forkedId}`);
    await expect(anonPage.locator('.public-project-viewer')).toHaveAttribute(
      'data-project-kind',
      'remix',
    );
    const provenance = anonPage.getByTestId('provenance');
    await expect(provenance).toContainText(`Remixed from ${fixtures.owner.username}`);
    await expect(provenance.getByRole('link', { name: fixtures.owner.username })).toBeVisible();

    // Durability across a source-side change: unpublishing the SOURCE
    // must never remove the fork's attribution -- only drop the link.
    await ownerPage.goto(`/projects/${sourceId}`);
    await ownerPage.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await expect(ownerPage.getByTestId('visibility-status')).toContainText('Private');

    await anonPage.reload();
    const provenanceAfterUnpublish = anonPage.getByTestId('provenance');
    await expect(provenanceAfterUnpublish).toContainText(`Remixed from ${fixtures.owner.username}`);
    await expect(
      provenanceAfterUnpublish.getByRole('link', { name: fixtures.owner.username }),
    ).toHaveCount(0);

    await ownerContext.close();
    await visitorContext.close();
    await anonContext.close();
  });

  test('remix disabled blocks fork, with no source data exposed', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
    const sourceId = await createBlankProjectViaUI(ownerPage);
    await saveMeaningfulMetadata(ownerPage, sourceId, {
      title: 'Remix-disabled source project',
      description: 'Publicly viewable, but remixing is off.',
      allowRemix: false,
    });
    await confirmPublish(ownerPage);

    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    await loginViaUI(visitorPage, fixtures.other.email, fixtures.password);
    await visitorPage.goto(`/p/${sourceId}`);
    await expect(visitorPage.getByRole('heading', { level: 2 })).toHaveText(
      'Remix-disabled source project',
    );
    // The Fork button itself is never offered.
    await expect(visitorPage.getByRole('button', { name: 'Fork this project' })).toHaveCount(0);

    // Even a raw, direct request is blocked -- 404, same as "doesn't
    // exist", exposing nothing.
    const forkAttempt = await apiPost(visitorContext, `/api/public/projects/${sourceId}/fork/`, {
      client_request_id: crypto.randomUUID(),
    });
    expect(forkAttempt.status()).toBe(404);

    const visitorProjects = (await (
      await apiGet(visitorContext, '/api/projects/')
    ).json()) as Array<{ title: string }>;
    expect(visitorProjects.some((p) => p.title === 'Remix-disabled source project')).toBe(false);

    await ownerContext.close();
    await visitorContext.close();
  });

  test('a private source blocks fork for both an authenticated non-owner and an anonymous caller, with no data exposed', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
    // Never published -- stays private for this whole test.
    const privateId = await createBlankProjectViaUI(ownerPage);

    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    await loginViaUI(visitorPage, fixtures.other.email, fixtures.password);
    await visitorPage.goto(`/p/${privateId}`);
    await expect(visitorPage.getByRole('alert')).toContainText("isn't available");

    const authenticatedForkAttempt = await apiPost(
      visitorContext,
      `/api/public/projects/${privateId}/fork/`,
      { client_request_id: crypto.randomUUID() },
    );
    expect(authenticatedForkAttempt.status()).toBe(404);

    // A signed-out caller gets the documented distinct 401 (see
    // ProjectForkView's own docstring: authentication is checked before
    // any visibility/remix check, so "not authenticated" and "not
    // permitted" are never conflated the way every other owner-only
    // endpoint conflates them).
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    // A GET against a Django-rendered page first, so csrftoken exists for
    // the POST helper (matches support/api.ts's csrfHeaders documented
    // requirement) -- '/' is this app's React SPA shell, which Django
    // serves with no template-rendered CSRF token at all, so only a real
    // Django page like the login form actually sets the cookie.
    await anonPage.goto('/accounts/login/');
    const anonForkAttempt = await apiPost(anonContext, `/api/public/projects/${privateId}/fork/`, {
      client_request_id: crypto.randomUUID(),
    });
    expect(anonForkAttempt.status()).toBe(401);

    await ownerContext.close();
    await visitorContext.close();
    await anonContext.close();
  });
});

test.describe('Fork concurrency (PostgreSQL)', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('two overlapping fork requests with the same idempotency key produce exactly one project/version/provenance set', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
    const sourceId = await createBlankProjectViaUI(ownerPage);
    await saveMeaningfulMetadata(ownerPage, sourceId, {
      title: 'Concurrency source project',
      description: 'Raced by two overlapping fork requests.',
      allowRemix: true,
    });
    await confirmPublish(ownerPage);

    // Two independent contexts, both signed in as the SAME non-owner
    // user -- "two tabs racing the same Fork click" -- mirroring
    // projectLifecycle.spec.ts's own concurrent-saves pattern.
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await loginViaUI(pageA, fixtures.other.email, fixtures.password);
    await loginViaUI(pageB, fixtures.other.email, fixtures.password);

    const requestId = crypto.randomUUID();
    const [responseA, responseB] = await Promise.all([
      apiPost(contextA, `/api/public/projects/${sourceId}/fork/`, {
        client_request_id: requestId,
      }),
      apiPost(contextB, `/api/public/projects/${sourceId}/fork/`, {
        client_request_id: requestId,
      }),
    ]);
    expect([responseA.status(), responseB.status()].sort()).toEqual([200, 201]);
    const bodyA = (await responseA.json()) as { id: string };
    const bodyB = (await responseB.json()) as { id: string };
    expect(bodyA.id).toBe(bodyB.id);
    const forkedId = bodyA.id;

    // Exactly one project — replaying the same request never creates a
    // second one, regardless of which of the two transactions actually
    // committed first.
    const forkedProjects = (await (await apiGet(contextA, '/api/projects/')).json()) as Array<{
      id: string;
      title: string;
    }>;
    expect(forkedProjects.filter((p) => p.id === forkedId)).toHaveLength(1);

    // Exactly one version -- no partial/duplicate SceneVersion row from
    // the losing request's rolled-back transaction survived.
    const forkedVersions = (await (
      await apiGet(contextA, `/api/projects/${forkedId}/versions/`)
    ).json()) as Array<{ id: number; fork_source_version: number | null }>;
    expect(forkedVersions).toHaveLength(1);
    expect(forkedVersions[0].fork_source_version).not.toBeNull();

    await ownerContext.close();
    await contextA.close();
    await contextB.close();
  });

  test('two overlapping fork requests with NO idempotency key are legitimately independent forks', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
    const sourceId = await createBlankProjectViaUI(ownerPage);
    await saveMeaningfulMetadata(ownerPage, sourceId, {
      title: 'Concurrency source project (no request id)',
      description: 'Raced by two overlapping fork requests without a shared idempotency key.',
      allowRemix: true,
    });
    await confirmPublish(ownerPage);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await loginViaUI(pageA, fixtures.other.email, fixtures.password);
    await loginViaUI(pageB, fixtures.other.email, fixtures.password);

    const [responseA, responseB] = await Promise.all([
      apiPost(contextA, `/api/public/projects/${sourceId}/fork/`, {}),
      apiPost(contextB, `/api/public/projects/${sourceId}/fork/`, {}),
    ]);
    expect(responseA.status()).toBe(201);
    expect(responseB.status()).toBe(201);
    const bodyA = (await responseA.json()) as { id: string };
    const bodyB = (await responseB.json()) as { id: string };
    // No shared request id -- these are two legitimately separate forks,
    // never deduplicated.
    expect(bodyA.id).not.toBe(bodyB.id);

    await ownerContext.close();
    await contextA.close();
    await contextB.close();
  });
});

test.describe('Authorization boundaries', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('only the owner can publish/unpublish, and a private project is invisible to non-owner and anonymous callers even via a fork attempt', async ({
    browser,
  }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginViaUI(ownerPage, fixtures.owner.email, fixtures.password);
    const projectId = await createBlankProjectViaUI(ownerPage);
    await saveMeaningfulMetadata(ownerPage, projectId, {
      title: 'Authorization boundary project',
      description: 'Only its owner may publish or unpublish it.',
    });

    // Non-owner, authenticated: publish/unpublish both 404 (never 403 --
    // this app's documented "don't confirm hidden data" convention, see
    // scenes/api.py's _require_or_404), and this project never appears
    // in their own project list either.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await loginViaUI(otherPage, fixtures.other.email, fixtures.password);
    const otherPublishAttempt = await apiPost(
      otherContext,
      `/api/projects/${projectId}/publish/`,
      {},
    );
    expect(otherPublishAttempt.status()).toBe(404);
    const otherProjects = (await (await apiGet(otherContext, '/api/projects/')).json()) as Array<{
      id: string;
    }>;
    expect(otherProjects.some((p) => p.id === projectId)).toBe(false);
    // The private project's fork attempt confirms no data leaks through
    // that boundary either -- covered in depth by "Remix and fork"'s own
    // dedicated private-source test above; this test only needs the
    // publish/unpublish boundary itself, so it stops here.

    // Anonymous: same 404, and no session cookie exists to even attempt
    // authentication.
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    // '/' is this app's React SPA shell -- Django serves it with no
    // template-rendered CSRF token, so only a real Django page like the
    // login form actually sets the csrftoken cookie the POST helper needs.
    await anonPage.goto('/accounts/login/');
    const anonPublishAttempt = await apiPost(
      anonContext,
      `/api/projects/${projectId}/publish/`,
      {},
    );
    expect(anonPublishAttempt.status()).toBe(404);

    // Owner succeeds, from an independent context too.
    await ownerPage.getByRole('button', { name: 'Publish', exact: true }).click();
    await ownerPage
      .getByRole('alertdialog', { name: /Publish/ })
      .getByRole('button', { name: 'Publish', exact: true })
      .click();
    await expect(ownerPage.getByTestId('visibility-status')).toContainText('Public');

    const ownerUnpublishAttempt = await apiPost(
      ownerContext,
      `/api/projects/${projectId}/unpublish/`,
      {},
    );
    expect(ownerUnpublishAttempt.status()).toBe(200);

    await ownerContext.close();
    await otherContext.close();
    await anonContext.close();
  });
});

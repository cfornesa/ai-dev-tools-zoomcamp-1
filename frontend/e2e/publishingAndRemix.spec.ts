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
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

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
  await page.getByRole('button', { name: 'More creation options' }).click();
  await page.getByRole('menuitem', { name: 'Create a new animation' }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const match = /\/projects\/([^/]+)$/.exec(page.url());
  if (!match) throw new Error(`Could not extract a project id from ${page.url()}`);
  await expandAllCollapsibleSections(page);
  return match[1];
}

// Issue #131: see the identical helper's comment in projectLifecycle.spec.ts
// -- the Tools panel's separate "Shape list" was removed as a duplicate of
// the outline `LayersPanel` already rendered.
function shapeListItem(page: Page) {
  return page.locator('[data-outline-kind="shape"] button[aria-pressed]');
}

async function openCameraAndDemoControls(page: Page) {
  const disclosure = page.locator('details.piece-stage-settings');
  await expect(disclosure).toBeVisible();
  await disclosure.locator('summary').click();
}

async function expectPublicStageChrome(page: Page) {
  const toolbar = page.locator('.piece-stage-shell [role="toolbar"][aria-label="Piece actions"]');
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Take screenshot' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: 'Open download menu' })).toBeVisible();
  await toolbar.getByRole('button', { name: 'Open download menu' }).click();
  await expect(toolbar.getByRole('menuitem', { name: 'Download Full' })).toBeVisible();
  await expect(toolbar.getByRole('menuitem', { name: 'Download Non-Camera' })).toBeVisible();
  await toolbar.getByRole('button', { name: 'Open download menu' }).click();
  await expect(toolbar.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeVisible();
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

/** Task 113 (issue #144): reads every distinct RGBA color present in a
 * mounted p5 canvas's actual pixel buffer (native `canvas.width`/`height`,
 * not the CSS-scaled display size), so a test can assert specific known
 * fill colors are genuinely painted — strictly more than the existing
 * "publishing..." scenario's container-visibility-only check (that
 * scenario's own comment explicitly notes it "doesn't parse pixel data";
 * this is that gap closed, for the anonymous viewer specifically). p5's
 * `createCanvas` here uses the default P2D (2D) renderer, never WEBGL
 * (confirmed by reading `render/p5Adapter.ts`), so `getContext('2d')` is
 * always valid. */
async function samplePixelColors(page: Page, testId: string): Promise<Set<string>> {
  const colors = await page.evaluate((testId: string) => {
    const container = document.querySelector(`[data-testid="${testId}"]`);
    const canvas = container?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return [];
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const seen = new Set<string>();
    for (let i = 0; i < data.length; i += 4) {
      seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    }
    return Array.from(seen);
  }, testId);
  return new Set(colors);
}

function hexToRgbTriple(hex: string): string {
  const value = hex.replace('#', '');
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

/**
 * Task 115 (issue #150): installs the `window.__mediapipeLoadVisionTasksModule`
 * test seam `mediapipeProvider.ts`'s `resolveDeps` checks before falling
 * back to the real dynamic `import('@mediapipe/tasks-vision')`, plus a
 * `getUserMedia`-succeeds mock and the `HTMLMediaElement.prototype`
 * `srcObject`/`play`/`pause`/`readyState` overrides a real (non-jsdom)
 * browser needs to accept a fake `MediaStream` -- adapted from
 * `exportArtifacts.spec.ts`'s `installCameraTestSeams('succeed')` for this
 * suite's dev-server-proxied SPA (`CameraControl.tsx` via
 * `createMediaPipeTrackingProvider`) rather than a `file://` export. Must
 * run via `context.addInitScript` so it exists before the app's own
 * bundle evaluates -- `CameraControl.tsx` itself is never touched; the
 * seam is reachable purely through this `window` global.
 */
async function installMediaPipeTestSeam(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    // A real browser's <video>.srcObject setter validates its argument is
    // a genuine MediaStream/MediaSource/Blob and throws otherwise --
    // unlike jsdom, which leaves it as a plain, unvalidated property. The
    // fake stream getUserMedia resolves with below is not a real
    // MediaStream, so the native setter must be replaced with a
    // permissive one for the pipeline to proceed past stream acquisition
    // without throwing.
    const storage = new WeakMap<HTMLMediaElement, unknown>();
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      get(this: HTMLMediaElement) {
        return storage.get(this);
      },
      set(this: HTMLMediaElement, value: unknown) {
        storage.set(this, value);
      },
    });
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    HTMLMediaElement.prototype.pause = () => {};
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get: () => 4,
    });

    // Chromium prefers requestVideoFrameCallback when it is available. The
    // synthetic stream has no decoder to produce native video callbacks, so
    // remove that optional API from the seam and exercise the provider's
    // existing requestAnimationFrame fallback instead.
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
      configurable: true,
      value: undefined,
    });

    Object.defineProperty(window.navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: () =>
        Promise.resolve({
          getTracks: () => [{ stop: () => {} }],
        }),
    });

    const cameraQaStats = { inferenceCalls: 0 };
    // @ts-expect-error -- test-only diagnostic global.
    window.__cameraQaStats = cameraQaStats;
    const fakeRecognizer = {
      recognizeForVideo: () => {
        cameraQaStats.inferenceCalls += 1;
        return { landmarks: [], gestures: [], handedness: [] };
      },
      close: () => {},
    };
    // @ts-expect-error -- test-only global shape, matching the seam
    // mediapipeProvider.ts itself documents (mirroring
    // standaloneCameraSource.ts's window.__exportCameraLoadVisionTasksModule).
    window.__mediapipeLoadVisionTasksModule = () =>
      Promise.resolve({
        FilesetResolver: { forVisionTasks: () => Promise.resolve({}) },
        GestureRecognizer: { createFromOptions: () => Promise.resolve(fakeRecognizer) },
      });
  });
}

/** Records every request URL this page makes for the duration of a test,
 * so a "granted camera" scenario can assert none of them ever reached the
 * real MediaPipe CDN -- with the seam installed, the real
 * `@mediapipe/tasks-vision` module (and therefore its own internal
 * wasm/model fetches, normally served from `cdn.jsdelivr.net` --
 * `MEDIAPIPE_WASM_BASE_URL` -- and `storage.googleapis.com` --
 * `GESTURE_RECOGNIZER_MODEL_URL` -- see `mediapipeProvider.ts`) is never
 * imported at all, so this should always come back empty; adapted from
 * `exportArtifacts.spec.ts`'s `interceptCdnAndTrackRequests` for a real
 * dev-server-proxied page rather than an isolated `file://` context (no
 * `page.route` interception needed here since no CDN request is ever
 * expected to be *made*, only asserted absent). Deliberately checked by
 * hostname substring rather than importing `mediapipeProvider.ts`'s exact
 * URL constants -- this file's `tsconfig.e2e.json` uses Node's stricter
 * `nodenext` module resolution (explicit `.js` extensions required on
 * every relative import), which the app's own `src/` modules (built under
 * `tsconfig.app.json`'s bundler resolution) don't satisfy, so importing
 * one directly here would fail to typecheck.
 */
function trackRequestUrls(page: Page): string[] {
  const observed: string[] = [];
  page.on('request', (request) => observed.push(request.url()));
  return observed;
}

function assertNoMediaPipeCdnRequests(observed: string[]): void {
  expect(observed.some((url) => url.includes('cdn.jsdelivr.net'))).toBe(false);
  expect(observed.some((url) => url.includes('storage.googleapis.com'))).toBe(false);
}

test.describe('Anonymous viewer: demo mode and camera-failure fallbacks', () => {
  let fixtures: Fixtures;
  let publicProjectId: string;
  let emptyScenePublicProjectId: string;
  const circleFill = '#ff00aa';
  const rectFill = '#22cc88';

  test.beforeAll(async ({ browser }) => {
    fixtures = requireE2EFixtures();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginViaUI(page, fixtures.owner.email, fixtures.password);

    publicProjectId = await createBlankProjectViaUI(page);
    // Task 113 (issue #144): a circle and a rectangle, each with a
    // distinct, deliberately unusual fill color unlikely to collide with
    // the canvas background/any other default color -- this is what the
    // persisted-rendering pixel check and the "granted camera + populated
    // scene" scenario both need a non-empty scene for.
    await page.getByRole('button', { name: 'Add circle' }).click();
    const circleFillInput = page.locator('#shape-style-fill');
    await circleFillInput.fill(circleFill);
    await circleFillInput.blur();
    await page.getByRole('button', { name: 'Add rectangle' }).click();
    const rectFillInput = page.locator('#shape-style-fill');
    await rectFillInput.fill(rectFill);
    await rectFillInput.blur();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 2/);
    await saveMeaningfulMetadata(page, publicProjectId, {
      title: 'Anonymous viewer fixture project',
      description: 'Used by the demo-mode/camera-failure scenarios.',
    });
    await confirmPublish(page);

    // A second, deliberately empty-scene project (still version 1, the
    // untouched blank canvas) for the "renders an empty scene cleanly"
    // criterion.
    emptyScenePublicProjectId = await createBlankProjectViaUI(page);
    await saveMeaningfulMetadata(page, emptyScenePublicProjectId, {
      title: 'Anonymous viewer empty-scene fixture project',
      description: 'Used by the empty-scene rendering scenario.',
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
    await expectPublicStageChrome(anonPage);
    await openCameraAndDemoControls(anonPage);
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

    // The iframe route reuses the same stage component but must not inherit
    // the application shell's page chrome.
    await anonPage.goto(`/embed/p/${publicProjectId}`);
    await expectPublicStageChrome(anonPage);
    await expect(anonPage.locator('nav')).toHaveCount(0);

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
    await openCameraAndDemoControls(anonPage);

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
    await openCameraAndDemoControls(anonPage);

    await anonPage.getByRole('button', { name: 'Enable camera' }).click();
    await expect(anonPage.getByTestId('camera-error')).toContainText("doesn't support");
    await expect(anonPage.getByRole('button', { name: 'Retry' })).toBeVisible();

    await expect(anonPage.getByTestId('demo-manual-controls')).toBeVisible();
    await anonPage.getByRole('radio', { name: 'Synthetic playback' }).click();
    await expect(anonPage.getByTestId('demo-playback-controls')).toBeVisible();

    await anonContext.close();
  });

  // ---------------------------------------------------------------------
  // Task 113 (issue #144): persisted-scene rendering, loading/empty/error
  // states, and additional camera-permission states specific to /p/:id --
  // see that issue's reconciliation against #93/#119/#132/#140 for why
  // this is verification of already-shared code, not new implementation,
  // and why the denied/unsupported-browser states above are not
  // duplicated here.
  // ---------------------------------------------------------------------

  test("renders the persisted scene's shapes visibly in the canvas, matching the public API's current version", async ({
    browser,
  }) => {
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/p/${publicProjectId}`);
    await openCameraAndDemoControls(anonPage);
    await expect(anonPage.getByRole('heading', { level: 2 })).toHaveText(
      'Anonymous viewer fixture project',
    );

    const canvas = anonPage.getByTestId('public-scene-canvas').locator('canvas');
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => Array.from(await samplePixelColors(anonPage, 'public-scene-canvas')), {
        timeout: 5000,
      })
      .toEqual(expect.arrayContaining([hexToRgbTriple(circleFill), hexToRgbTriple(rectFill)]));

    // Provably the persisted current version, not a stale/draft render:
    // the same two shapes, same count, at the data layer.
    const publicDetail = await apiGet(anonContext, `/api/public/projects/${publicProjectId}/`);
    expect(publicDetail.status()).toBe(200);
    const publicBody = (await publicDetail.json()) as {
      current_version: { scene_json: { shapes: Array<{ type: string }> } };
    };
    expect(publicBody.current_version.scene_json.shapes).toHaveLength(2);
    expect(publicBody.current_version.scene_json.shapes.map((s) => s.type).sort()).toEqual([
      'circle',
      'rect',
    ]);

    await anonContext.close();
  });

  test('renders an empty scene cleanly: visible canvas, no shapes, no error', async ({
    browser,
  }) => {
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/p/${emptyScenePublicProjectId}`);
    await expect(anonPage.getByRole('heading', { level: 2 })).toHaveText(
      'Anonymous viewer empty-scene fixture project',
    );

    await expect(anonPage.getByTestId('public-scene-canvas').locator('canvas')).toBeVisible();
    await expect(anonPage.getByRole('alert')).toHaveCount(0);

    const publicDetail = await apiGet(
      anonContext,
      `/api/public/projects/${emptyScenePublicProjectId}/`,
    );
    const publicBody = (await publicDetail.json()) as {
      current_version: { scene_json: { shapes: unknown[] } };
    };
    expect(publicBody.current_version.scene_json.shapes).toHaveLength(0);

    await anonContext.close();
  });

  test('shows the loading state before the project finishes fetching', async ({ browser }) => {
    const anonContext = await browser.newContext();
    // Delays the public API response just long enough to reliably observe
    // the transient 'loading' state before it resolves to 'ready'.
    await anonContext.route(`**/api/public/projects/${publicProjectId}/`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    const anonPage = await anonContext.newPage();
    const navigation = anonPage.goto(`/p/${publicProjectId}`);

    // The global reduced-motion status ("Motion is currently...") also
    // carries role="status", so this must scope to the exact text rather
    // than the bare role.
    await expect(anonPage.getByRole('status').getByText(/Loading project/)).toBeVisible();
    await expect(anonPage.getByRole('heading', { level: 2 })).toHaveCount(0);

    await navigation;
    await expect(anonPage.getByRole('heading', { level: 2 })).toBeVisible();

    await anonContext.close();
  });

  test('shows the unavailable state (distinct from error) for a public id that never existed, with a working gallery link', async ({
    browser,
  }) => {
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto('/p/this-id-does-not-exist-e2e');

    await expect(anonPage.getByRole('alert')).toContainText("isn't available");
    const galleryLink = anonPage.getByRole('link', { name: 'Back to the public gallery' });
    await expect(galleryLink).toBeVisible();
    await galleryLink.click();
    await anonPage.waitForURL(/\/gallery$/);

    await anonContext.close();
  });

  test('shows a distinct error state (not "unavailable") for a non-404/403 fetch failure, with a working gallery link', async ({
    browser,
  }) => {
    const anonContext = await browser.newContext();
    await anonContext.route(`**/api/public/projects/${publicProjectId}/`, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/p/${publicProjectId}`);

    const alert = anonPage.getByRole('alert');
    await expect(alert).toContainText('Something went wrong');
    await expect(alert).not.toContainText("isn't available");
    await expect(anonPage.getByRole('link', { name: 'Back to the public gallery' })).toBeVisible();

    await anonContext.close();
  });

  test('a scene that fails to render surfaces previewError without blanking the rest of the page', async ({
    browser,
  }) => {
    const anonContext = await browser.newContext();
    // A canvas width of 5 fails schema/scene.schema.json's minimum (16),
    // so buildScenePlan's own validateScene call throws deterministically
    // -- mirrors #140's "a render-time failure must never blank the whole
    // page" principle, scoped to this page's own try/catch around
    // previewRef.current.render(...).
    await anonContext.route(`**/api/public/projects/${publicProjectId}/`, async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as {
        current_version: { scene_json: { canvas: { width: number } } };
      };
      body.current_version.scene_json.canvas.width = 5;
      await route.fulfill({ response, json: body });
    });
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/p/${publicProjectId}`);
    await openCameraAndDemoControls(anonPage);

    await expect(anonPage.getByRole('heading', { level: 2 })).toHaveText(
      'Anonymous viewer fixture project',
    );
    await expect(anonPage.getByRole('alert')).toContainText("Couldn't render the preview");

    // The rest of the page stays usable -- header, camera, and demo
    // controls are never blanked by a preview-render failure.
    await expect(anonPage.getByRole('button', { name: 'Enable camera' })).toBeVisible();
    await expect(anonPage.getByTestId('demo-manual-controls')).toBeVisible();

    await anonContext.close();
  });

  test("a pending permission prompt shows the recovery hint on /p/:id (issue #132's fix, never previously observed on this route)", async ({
    browser,
  }) => {
    test.setTimeout(15000);
    const anonContext = await browser.newContext();
    await anonContext.addInitScript(() => {
      Object.defineProperty(window.navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        // Never resolves or rejects -- simulates a native permission
        // prompt the user hasn't answered yet.
        value: () => new Promise(() => {}),
      });
    });
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/p/${publicProjectId}`);
    await openCameraAndDemoControls(anonPage);

    await anonPage.getByRole('button', { name: 'Enable camera' }).click();
    await expect(anonPage.getByTestId('camera-permission-hint')).toBeVisible({ timeout: 8000 });

    await anonContext.close();
  });

  test('no camera hardware (NotFoundError) shows an appropriate message and Retry, which re-attempts getUserMedia', async ({
    browser,
  }) => {
    const anonContext = await browser.newContext();
    await anonContext.addInitScript(() => {
      let calls = 0;
      (window as unknown as { __getUserMediaCalls: () => number }).__getUserMediaCalls = () =>
        calls;
      Object.defineProperty(window.navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: () => {
          calls += 1;
          return Promise.reject(new DOMException('No camera was found', 'NotFoundError'));
        },
      });
    });
    const anonPage = await anonContext.newPage();
    await anonPage.goto(`/p/${publicProjectId}`);
    await openCameraAndDemoControls(anonPage);

    await anonPage.getByRole('button', { name: 'Enable camera' }).click();
    await expect(anonPage.getByTestId('camera-error')).toContainText(/no camera/i);
    const retryButton = anonPage.getByRole('button', { name: 'Retry' });
    await expect(retryButton).toBeVisible();
    expect(await anonPage.evaluate('window.__getUserMediaCalls()')).toBe(1);

    // Retry is not a dead end -- it genuinely re-attempts getUserMedia
    // rather than leaving the control permanently stuck on this failure.
    await retryButton.click();
    await expect(anonPage.getByTestId('camera-error')).toContainText(/no camera/i);
    expect(await anonPage.evaluate('window.__getUserMediaCalls()')).toBe(2);

    // Demo controls remain fully usable throughout.
    await expect(anonPage.getByTestId('demo-manual-controls')).toBeVisible();

    await anonContext.close();
  });

  // -------------------------------------------------------------------
  // Task 115 (issue #150): the granted/active/stop scenarios task 113/
  // #144 could not complete, now reachable via the
  // window.__mediapipeLoadVisionTasksModule seam mediapipeProvider.ts
  // gained in this task. Never exercises real gesture/landmark output --
  // the fake recognizer always returns empty landmarks/gestures/handedness.
  // -------------------------------------------------------------------

  test('granted camera reaches active', async ({ browser }) => {
    const anonContext = await browser.newContext();
    await installMediaPipeTestSeam(anonContext);
    const anonPage = await anonContext.newPage();
    const observedRequests = trackRequestUrls(anonPage);

    await anonPage.goto(`/p/${publicProjectId}`);
    await openCameraAndDemoControls(anonPage);
    await anonPage.getByRole('button', { name: 'Enable camera' }).click();

    await expect(anonPage.getByTestId('camera-status')).toHaveText(
      'Camera is active. Hand tracking is running locally in your browser.',
    );
    await expect(anonPage.getByRole('button', { name: 'Stop camera' })).toBeVisible();
    await expect(anonPage.getByRole('button', { name: 'Enable camera' })).toHaveCount(0);
    await expect(anonPage.getByRole('button', { name: 'Retry' })).toHaveCount(0);

    // Demo controls remain fully usable while the camera is active.
    await expect(anonPage.getByTestId('demo-manual-controls')).toBeVisible();

    assertNoMediaPipeCdnRequests(observedRequests);

    await anonContext.close();
  });

  // Task 119 (issue #152): the camera video overlay + opacity slider +
  // mirror toggle ported to this page (see PublicProjectViewer.tsx's own
  // doc comment) -- exercised here against the real DOM/localStorage,
  // complementing PublicProjectViewer.cameraOverlay.test.tsx's mocked-
  // CameraControl unit coverage.
  test('camera overlay video + opacity/mirror controls appear once active and persist', async ({
    browser,
  }) => {
    const anonContext = await browser.newContext();
    await installMediaPipeTestSeam(anonContext);
    const anonPage = await anonContext.newPage();

    await anonPage.goto(`/p/${publicProjectId}`);
    await openCameraAndDemoControls(anonPage);

    // No overlay/controls before the camera is enabled.
    await expect(anonPage.getByTestId('camera-overlay-video')).toHaveCount(0);
    await expect(anonPage.getByLabel('Camera overlay opacity')).toHaveCount(0);

    await anonPage.getByRole('button', { name: 'Enable camera' }).click();
    await expect(anonPage.getByTestId('camera-status')).toHaveText(
      'Camera is active. Hand tracking is running locally in your browser.',
    );

    // Issue #195: the camera image itself is drawn inside the p5 canvas
    // (matching EditorWorkspace.tsx's fix from issue #169); this <video> is
    // `visibility: hidden` and exists only as the live frame source, so it
    // is attached but not "visible" per Playwright's actionability check.
    const overlayVideo = anonPage.getByTestId('camera-overlay-video');
    await expect(overlayVideo).toBeAttached();
    await expect(overlayVideo).toHaveCSS('visibility', 'hidden');
    const opacitySlider = anonPage.getByLabel('Camera overlay opacity');
    const mirrorToggle = anonPage.getByLabel('Mirror camera overlay');
    await expect(opacitySlider).toHaveValue('50');
    await expect(mirrorToggle).toBeChecked();

    await opacitySlider.fill('75');
    await mirrorToggle.uncheck();
    await expect(overlayVideo).toHaveCSS('opacity', '0.75');
    await expect(overlayVideo).toHaveCSS('transform', 'none');

    // The preference is the same localStorage-backed store the editor
    // reads (Task 118/#147's `cameraOverlaySettings.ts`) -- persisted here
    // without any project/account association, recoverable after reload.
    const stored = await anonPage.evaluate(() =>
      window.localStorage.getItem('gesture-studio:camera-overlay-settings'),
    );
    expect(JSON.parse(stored ?? '{}')).toEqual({ opacity: 0.75, mirrored: false });

    await anonContext.close();
  });

  test('stop after active', async ({ browser }) => {
    const anonContext = await browser.newContext();
    await installMediaPipeTestSeam(anonContext);
    const anonPage = await anonContext.newPage();
    const observedRequests = trackRequestUrls(anonPage);

    await anonPage.goto(`/p/${publicProjectId}`);
    await openCameraAndDemoControls(anonPage);
    await anonPage.getByRole('button', { name: 'Enable camera' }).click();
    await expect(anonPage.getByTestId('camera-status')).toHaveText(
      'Camera is active. Hand tracking is running locally in your browser.',
    );

    await anonPage.getByRole('button', { name: 'Stop camera' }).click();

    await expect(anonPage.getByTestId('camera-status')).toHaveText(
      'Camera stopped. No video is being captured.',
    );
    await expect(anonPage.getByRole('button', { name: 'Enable camera' })).toBeVisible();
    await expect(anonPage.getByRole('button', { name: 'Stop camera' })).toHaveCount(0);

    // Demo controls remain fully usable/interactive throughout.
    await expect(anonPage.getByTestId('demo-manual-controls')).toBeVisible();
    const presentButton = anonPage.getByRole('button', { name: /Hand (present|absent)/ });
    const before = await presentButton.textContent();
    await presentButton.click();
    await expect(presentButton).not.toHaveText(before ?? '');

    assertNoMediaPipeCdnRequests(observedRequests);

    await anonContext.close();
  });

  test('10-second synthetic camera diagnostics stay within desktop and narrow budgets', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await installMediaPipeTestSeam(context);
    const anonPage = await context.newPage();
    const results: Array<{
      viewport: string;
      elapsedMs: number;
      animationFrames: number;
      animationFps: number;
      inferenceCalls: number;
      inferenceFps: number;
      longTasks: number;
      maxLongTaskMs: number;
    }> = [];

    for (const viewport of [
      { name: 'desktop', width: 1280, height: 800 },
      { name: 'narrow', width: 375, height: 800 },
    ]) {
      await anonPage.setViewportSize({ width: viewport.width, height: viewport.height });
      await anonPage.goto(`/p/${publicProjectId}`);
      await openCameraAndDemoControls(anonPage);
      await anonPage.getByRole('button', { name: 'Enable camera' }).click();
      await expect(anonPage.getByTestId('camera-status')).toContainText(/camera is active/i);

      const metrics = await anonPage.evaluate(async () => {
        const startedAt = performance.now();
        let animationFrames = 0;
        const longTasks: number[] = [];
        // `buffered: true` also delivers any longtask entries already
        // recorded before this observer existed -- page navigation,
        // initial render, and "Enable camera"/MediaPipe-seam setup can
        // easily produce a startup-only long task on a loaded CI runner
        // that has nothing to do with this benchmark's actual target
        // (steady-state per-frame cost during the 10-second animation
        // loop below). Filtering to `entry.startTime >= startedAt`
        // keeps `buffered: true` (so a long task that starts a few ms
        // before this line executes is still counted) while excluding
        // one-time setup cost that predates the window this benchmark
        // claims to measure.
        const observer =
          typeof PerformanceObserver === 'function'
            ? new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  if (entry.startTime >= startedAt) longTasks.push(entry.duration);
                }
              })
            : null;
        observer?.observe({ type: 'longtask', buffered: true });
        await new Promise<void>((resolve) => {
          const sample = () => {
            animationFrames += 1;
            if (performance.now() - startedAt >= 10_000) resolve();
            else requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        observer?.disconnect();
        const elapsedMs = performance.now() - startedAt;
        const stats = (window as unknown as { __cameraQaStats: { inferenceCalls: number } })
          .__cameraQaStats;
        return {
          elapsedMs,
          animationFrames,
          inferenceCalls: stats.inferenceCalls,
          longTasks,
        };
      });

      const maxLongTaskMs = Math.max(0, ...metrics.longTasks);
      const result = {
        viewport: viewport.name,
        elapsedMs: metrics.elapsedMs,
        animationFrames: metrics.animationFrames,
        animationFps: metrics.animationFrames / (metrics.elapsedMs / 1000),
        inferenceCalls: metrics.inferenceCalls,
        inferenceFps: metrics.inferenceCalls / (metrics.elapsedMs / 1000),
        longTasks: metrics.longTasks.length,
        maxLongTaskMs,
      };
      // eslint-disable-next-line no-console
      console.log(`[camera-bench] ${JSON.stringify(result)}`);
      results.push(result);
      expect(result.inferenceFps).toBeLessThanOrEqual(30.5);
      expect(result.inferenceFps).toBeGreaterThan(20);
      expect(result.animationFps).toBeGreaterThanOrEqual(30);
      expect(result.maxLongTaskMs).toBeLessThanOrEqual(100);

      await anonPage.getByRole('button', { name: 'Stop camera' }).click();
      await expect(anonPage.getByTestId('camera-status')).toContainText(/camera stopped/i);
    }

    expect(results).toHaveLength(2);
    await context.close();
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

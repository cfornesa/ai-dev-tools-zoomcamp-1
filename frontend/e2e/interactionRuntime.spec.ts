/**
 * Task 66 (issue #68): interaction-runtime end-to-end tests — demo
 * tracking input, gesture binding conflicts, and behavior-graph authoring
 * — against a real, PostgreSQL-backed deployment of this app. Companion
 * to Task 65's `projectLifecycle.spec.ts`: reuses the exact same
 * infrastructure (`frontend/playwright.config.ts`, `e2e/support/*`, `make
 * e2e`) rather than adding a second E2E framework or a new fixture-setup
 * path. See AGENTS.md's "End-to-end tests (Playwright)" section for how
 * to run this suite; it self-skips with an actionable message (via
 * `requireE2EFixtures()`) exactly like `projectLifecycle.spec.ts` when its
 * prerequisites aren't available.
 *
 * ## No camera, no external model, no real sleeps, no network provider
 *
 * Every scenario below drives `DemoControlsPanel`
 * (`frontend/src/pages/DemoControlsPanel.tsx`, Task 28) — sliders,
 * toggles, and buttons wired to `manualProvider.ts`/`demoPlaybackScript.ts`
 * (Task 27/28), never `CameraControl`/MediaPipe. Every wait is either
 * Playwright's own auto-retrying `expect(...).toHaveText(...)` (polls the
 * real DOM until it settles, no fixed delay) or a deterministic UI action
 * (click "Step", which synchronously advances the scripted playback by
 * exactly one entry — see `demoController.ts`'s `advancePlayback`). This
 * file contains no `page.waitForTimeout` and no dependency on
 * `Date.now()`/wall-clock timing anywhere, and nothing here calls the AI
 * proposal endpoints (Mistral) or any other network provider.
 *
 * ## What this suite can and cannot observe (read before extending)
 *
 * This app's live editor does **not** wire `runtime/behaviorRuntime.ts`
 * (Task 35) into the rendered p5 preview: `EditorWorkspace.tsx` calls
 * `previewRef.current.render(workingCopy)` with no particle/trail
 * snapshot and no per-frame tracking loop, and `p5Adapter.ts`'s own module
 * doc comment says evaluating bindings/the graph is explicitly out of its
 * scope. The compact runtime that *does* execute bindings against a
 * tracking stream (`export/standaloneRuntimeSource.ts`) only ever runs
 * inside a downloaded, exported standalone HTML file — never inside this
 * app's own pages. Concretely, that means:
 *
 * - **Observable end to end, and asserted here**: everything authored
 *   through the real UI — `DemoControlsPanel`'s manual/playback frame
 *   descriptions (a real `TrackingProvider` emitting real frames),
 *   `BehaviorCardsPanel`'s conflict-resolution dialog and resulting card
 *   list, `GraphListView`'s node/param/connection state, all of it
 *   surviving an explicit Save and a full page reload exactly like
 *   `projectLifecycle.spec.ts` proves for shapes/versions.
 * - **Not observable at the E2E layer, and not asserted here**: the
 *   *evaluated* numeric/temporal output of a transform/condition/timing
 *   node (e.g. "Map range with these params turns 0.7 into 560"), particle
 *   cap enforcement/cleanup, trail rendering, physics force integration,
 *   and the actual random *values* randomness produces. These have no
 *   rendered pixel or DOM proxy anywhere in this application today (no
 *   live tracking-to-canvas loop, and — for particles/trails/physics — no
 *   authoring UI for their numeric parameters at all: `particleEmitter`'s
 *   graph node has zero configurable params, and
 *   `sceneShapes.ts`/`ShapeInspectorPanel.tsx` explicitly leave
 *   `particleEmitter` shape editing out of scope). This is exactly the
 *   surface `behaviorRuntime.test.ts`, `particleSystem.test.ts`,
 *   `trailSystem.test.ts`, and `physicsForces.test.ts` already prove at
 *   the unit level with fake/injected clocks — re-proving it here would
 *   duplicate, not extend, that coverage, which the issue's own brief
 *   says to avoid.
 * - **Two-hand distance, specifically**: `manualProvider.ts`'s own module
 *   doc comment states manual demo input is deliberately single-hand only
 *   ("two-hand demo input is out of scope... live camera/two-hand work
 *   belongs to later tasks"), and no later task added a two-hand demo
 *   control — `demoPlaybackScript.ts`'s scripted sequence is also
 *   single-hand. There is therefore no UI control anywhere in this app
 *   that can drive a live `handDistance`/`twoHandState` signal. The
 *   two-hand scenario below instead proves the *authoring* path — a
 *   `handSignal` graph node reading `handDistance` feeding an exact-
 *   threshold `ifElse` node, saved and reloaded correctly — and the gap
 *   is documented inline. Real two-hand extraction (smoothing, hysteresis,
 *   hold time, `handsBecameClose`/`handsBecameFar`) is `twoHandSignals.test.ts`'s
 *   job, not this suite's.
 *
 * ## Determinism (acceptance criterion 5)
 *
 * `demoPlaybackScript.ts` is a pure function with fixed timestamps and no
 * `Math.random`/`Date.now` (see its own doc comment). "Synthetic playback
 * is deterministic" below drives the identical script twice — once via
 * Reset+replay in the same page, once via a fresh page reload — and
 * asserts byte-identical frame-description text at every step, which is
 * only possible if the same seeded fixture and mock tracking timeline
 * produce the same output on repeated runs.
 */
import { expect, test, type Page } from '@playwright/test';

import { requireE2EFixtures } from './support/prerequisites.js';
import { loginViaUI } from './support/auth.js';
import {
  expandAllCollapsibleSections,
  expandSection,
} from './support/expandCollapsibleSections.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

/**
 * Issue #113: every Tools/Inspector `CollapsibleSection` (issue #95)
 * defaults closed. Opens only "Add & edit shapes" -- enough for every
 * scenario's own "Add circle" -- rather than every section
 * (`expandAllCollapsibleSections`), because `BehaviorCardsPanel.tsx`'s
 * target `<select>` (inside "Behaviors") seeds its selected option from
 * `targetOptions[0]` only once, at mount (`useState`'s initializer) --
 * opening "Behaviors" before a shape exists mounts that panel with zero
 * target options, and it never recovers even after a shape is added
 * later (issue #116). Each scenario below calls
 * `expandAllCollapsibleSections` itself once it's safe to (immediately,
 * if it never adds a shape; after `Add circle`, if it does and drives
 * `BehaviorCardsPanel`'s `followHand`/`reactToPinch`/`emitParticles`
 * cards) to open everything else.
 */
async function createBlankProjectViaUI(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create new animation' }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  const match = /\/projects\/([^/]+)$/.exec(page.url());
  if (!match) throw new Error(`Could not extract a project id from ${page.url()}`);
  await expandSection(page, 'Add & edit shapes');
  return match[1];
}

function lastFrameStatus(page: Page) {
  return page.locator('.demo-last-frame');
}

function playbackProgress(page: Page) {
  return page.getByRole('status').filter({ hasText: /of \d+ events played/ });
}

/** Reads every currently rendered shape's id off the canvas's own
 * `data-testid="scene-shape-<id>"` markers -- the same convention
 * `projectLifecycle.spec.ts` relies on for shape assertions. */
async function firstShapeId(page: Page): Promise<string> {
  const handle = page.locator('[data-testid^="scene-shape-"]').first();
  const testId = await handle.getAttribute('data-testid');
  if (!testId) throw new Error('No scene-shape-* element found on the canvas.');
  return testId.replace('scene-shape-', '');
}

/** Reads the most recently added graph node's id off `GraphListView`'s own
 * `id: <uuid>` text -- the list is append-only in creation order, so "last"
 * is always the node just added by `addNode()` below. */
async function lastGraphNodeId(page: Page): Promise<string> {
  const idText = await page
    .locator('.graph-list-node-list li .graph-list-node-id')
    .last()
    .textContent();
  if (!idText) throw new Error('No graph nodes found in the list view.');
  return idText.replace('id: ', '').trim();
}

async function addNode(page: Page, typeLabel: string): Promise<string> {
  await page.locator('#graph-list-new-node-type').selectOption({ label: typeLabel });
  await page.getByRole('button', { name: 'Add node', exact: true }).click();
  return lastGraphNodeId(page);
}

async function connectNodes(
  page: Page,
  from: { nodeId: string; port: string },
  to: { nodeId: string; port: string },
): Promise<void> {
  await page.locator('#graph-list-from-node').selectOption({ value: from.nodeId });
  await page.locator('#graph-list-from-port').selectOption({ value: from.port });
  await page.locator('#graph-list-to-node').selectOption({ value: to.nodeId });
  await page.locator('#graph-list-to-port').selectOption({ value: to.port });
  await page.getByRole('button', { name: 'Add connection', exact: true }).click();
}

async function openLogicPanel(page: Page): Promise<void> {
  // "Show logic" lives inside "Behaviors" (EditorWorkspace.tsx), alongside
  // BehaviorCardsPanel -- see createBlankProjectViaUI's own comment on
  // why that section isn't opened any earlier than each scenario needs.
  await expandSection(page, 'Behaviors');
  const toggle = page.getByRole('button', { name: /^(Show logic|Hide logic)$/ });
  if ((await toggle.textContent()) === 'Show logic') {
    await toggle.click();
  }
  await expect(page.getByRole('heading', { name: 'Advanced graph' })).toBeVisible();
}

async function saveAndReload(page: Page, expectedVersionText: RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('editor-save-status')).toHaveText(expectedVersionText);
  await page.reload();
  await expect(page.getByTestId('editor-save-status')).toHaveText(expectedVersionText);
  await expandAllCollapsibleSections(page);
}

test.describe('Interaction runtime', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('one-hand manual controls produce live, observable frame state', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlankProjectViaUI(page);
    await expandAllCollapsibleSections(page);

    await expect(lastFrameStatus(page)).toHaveText('No frame emitted yet.');

    // Presence: hand appears -> a real handAppear event on a real frame.
    await page.getByRole('button', { name: 'Hand absent' }).click();
    await expect(lastFrameStatus(page)).toContainText('right hand');
    await expect(lastFrameStatus(page)).toContainText('events: handAppear');

    // Continuous signal: dragging the indexTipX slider changes the
    // reported confidence/position summary deterministically -- no
    // interpolation or animation involved, a slider change is a single
    // synchronous emitted frame.
    const confidenceSlider = page.locator('#demo-signal-confidence');
    await confidenceSlider.fill('0.42');
    await expect(page.locator('output[for="demo-signal-confidence"]')).toHaveText('0.42');
    await expect(lastFrameStatus(page)).toContainText('confidence 0.42');

    // Gesture state: selecting a gesture radio emits gestureEnter for
    // exactly that gesture, and the radio group reflects the new checked
    // state -- both the event stream and the control state are asserted.
    const openPalmRadio = page.getByRole('radio', { name: 'Open palm' });
    await openPalmRadio.click();
    await expect(openPalmRadio).toHaveAttribute('aria-checked', 'true');
    await expect(lastFrameStatus(page)).toContainText('events: gestureEnter');

    // Gesture event (one-shot): pinch start/end fire distinct events, not
    // a persisted "gesture" state.
    await page.getByRole('button', { name: 'Pinch start' }).click();
    await expect(lastFrameStatus(page)).toContainText('events: pinchStart');
    await page.getByRole('button', { name: 'Pinch end' }).click();
    await expect(lastFrameStatus(page)).toContainText('events: pinchEnd');

    // Presence off: hand disappears, exiting the active gesture first.
    await page.getByRole('button', { name: 'Hand present' }).click();
    await expect(lastFrameStatus(page)).toContainText('no hands');
    await expect(lastFrameStatus(page)).toContainText('gestureExit');
    await expect(lastFrameStatus(page)).toContainText('handDisappear');
  });

  test('synthetic playback is deterministic across replay and a fresh reload', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlankProjectViaUI(page);
    await expandAllCollapsibleSections(page);

    await page.getByRole('radio', { name: 'Synthetic playback' }).click();
    await expect(playbackProgress(page)).toHaveText('0 of 9 events played');

    // Step through the entire deterministic script (see
    // `demoPlaybackScript.ts`) and record the frame description text at
    // every step -- no timers, no waitForTimeout, one synchronous "Step"
    // click per scripted entry.
    const stepButton = page.getByRole('button', { name: 'Step', exact: true });
    const firstRunFrames: string[] = [];
    for (let i = 0; i < 9; i += 1) {
      await stepButton.click();
      firstRunFrames.push((await lastFrameStatus(page).textContent()) ?? '');
    }
    await expect(playbackProgress(page)).toHaveText('9 of 9 events played');
    await expect(stepButton).toBeDisabled();

    // Reset rewinds without emitting anything, then replaying the exact
    // same script in the exact same page produces byte-identical frames.
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(playbackProgress(page)).toHaveText('0 of 9 events played');
    const replayFrames: string[] = [];
    for (let i = 0; i < 9; i += 1) {
      await stepButton.click();
      replayFrames.push((await lastFrameStatus(page).textContent()) ?? '');
    }
    expect(replayFrames).toEqual(firstRunFrames);

    // A fresh page load (a brand new DemoTrackingController instance, the
    // same "same seeded fixture and mock tracking timeline" the issue
    // asks for) reproduces the same sequence again from a clean start.
    await page.reload();
    await expandAllCollapsibleSections(page);
    await page.getByRole('radio', { name: 'Synthetic playback' }).click();
    const reloadedFrames: string[] = [];
    for (let i = 0; i < 9; i += 1) {
      await stepButton.click();
      reloadedFrames.push((await lastFrameStatus(page).textContent()) ?? '');
    }
    expect(reloadedFrames).toEqual(firstRunFrames);
  });

  test('reduced motion replaces playback auto-advance with manual stepping', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlankProjectViaUI(page);
    await expandAllCollapsibleSections(page);

    await page.getByRole('radio', { name: 'Synthetic playback' }).click();
    // Full motion (the default in a fresh Chromium profile, no OS
    // preference set): Play/Pause is offered.
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

    // The global Reduce motion control lives in the header (Layout.tsx),
    // available on every route including the editor.
    await page.getByRole('radio', { name: 'Reduced' }).click();
    await expect(page.getByText('Motion is currently reduced.')).toBeVisible();

    // Task 29's documented substitution: auto-advance turns off entirely
    // (Play/Pause disappears) and only the manual Step control remains --
    // the same scripted frames are still fully reachable, just gated
    // behind an explicit action instead of a timer.
    await expect(page.getByRole('button', { name: 'Play' })).toHaveCount(0);
    await expect(
      page.getByText('Auto-advance is off while motion is reduced. Use Step to advance manually.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Step', exact: true }).click();
    await expect(playbackProgress(page)).toHaveText('1 of 9 events played');

    // Switching back to Full restores Play/Pause.
    await page.getByRole('radio', { name: 'Full', exact: true }).click();
    await expect(page.getByText('Motion is currently full.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^(Play|Pause)$/ })).toBeVisible();
  });

  test('compatible parallel bindings coexist; a target-channel conflict requires explicit replacement', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlankProjectViaUI(page);
    await page.getByRole('button', { name: 'Add circle' }).click();
    // Issue #113/#116: open "Behaviors" only after the shape exists --
    // BehaviorCardsPanel.tsx's target select otherwise mounts with no
    // options and never recovers (see createBlankProjectViaUI's comment).
    await expandAllCollapsibleSections(page);

    // Two "Follow hand" cards on the same target but different axes
    // occupy different channels (positionX vs positionY) -- compatible
    // parallel bindings that must both coexist without any prompt.
    await page.getByRole('radio', { name: 'Follow hand' }).click();
    await page.locator('#behavior-card-follow-axis').selectOption('x');
    await page.getByRole('button', { name: 'Add card', exact: true }).click();
    await expect(
      page.getByRole('list', { name: 'Behavior card list' }).getByRole('listitem'),
    ).toHaveCount(1);

    await page.locator('#behavior-card-follow-axis').selectOption('y');
    await page.getByRole('button', { name: 'Add card', exact: true }).click();
    await expect(
      page.getByRole('list', { name: 'Behavior card list' }).getByRole('listitem'),
    ).toHaveCount(2);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    // Scoped to the card list itself -- the live draft preview just above
    // it (`BehaviorCardsPanel.tsx`'s "Preview: ...") can describe the same
    // axis in its own text, which would make an unscoped page-wide
    // `getByText` ambiguous once a card matching it actually exists.
    const cardList = page.getByRole('list', { name: 'Behavior card list' });
    await expect(cardList.getByText('horizontal axis')).toBeVisible();
    await expect(cardList.getByText('vertical axis')).toBeVisible();

    // A second CONTINUOUS binding back on the already-occupied horizontal
    // (positionX) channel must trigger BehaviorCardsPanel's conflict
    // dialog rather than silently overwriting it.
    await page.locator('#behavior-card-follow-axis').selectOption('x');
    await page.getByRole('button', { name: 'Add card', exact: true }).click();
    const conflictDialog = page.getByRole('alertdialog', { name: 'Target already has a binding' });
    await expect(conflictDialog).toBeVisible();
    await expect(conflictDialog).toContainText('horizontal axis');
    await expect(conflictDialog).toContainText('already controls this channel');

    // Cancel leaves the original two-card set untouched.
    await conflictDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(
      page.getByRole('list', { name: 'Behavior card list' }).getByRole('listitem'),
    ).toHaveCount(2);

    // Retry and explicitly confirm the replacement this time.
    await page.getByRole('button', { name: 'Add card', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Replace existing binding' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    // Final binding set: still exactly two cards (positionY untouched,
    // positionX replaced -- not duplicated) -- both axes still present.
    const cards = page.getByRole('list', { name: 'Behavior card list' }).getByRole('listitem');
    await expect(cards).toHaveCount(2);
    // Scoped for the same reason as the earlier assertion above.
    await expect(cardList.getByText('horizontal axis')).toBeVisible();
    await expect(cardList.getByText('vertical axis')).toBeVisible();

    // Persists through an explicit save and a full reload.
    await saveAndReload(page, /Saved as version 2/);
    await expect(
      page.getByRole('list', { name: 'Behavior card list' }).getByRole('listitem'),
    ).toHaveCount(2);
  });

  test('graph authoring: numeric transform, exact condition threshold, elapsed-time, and cooldown suppression', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlankProjectViaUI(page);
    await page.getByRole('button', { name: 'Add circle' }).click();
    const shapeId = await firstShapeId(page);

    await openLogicPanel(page);

    // --- Numeric transform: Hand signal -> Map range -> Shape property ---
    const handSignalId = await addNode(page, 'Input: Hand signal');
    const mapRangeId = await addNode(page, 'Transform: Map range');
    const shapePropertyId = await addNode(page, 'Visual: Shape property');

    await page.locator(`#graph-list-node-${mapRangeId}-outMax`).fill('800');
    await page.locator(`#graph-list-node-${shapePropertyId}-targetId`).fill(shapeId);
    await page.locator(`#graph-list-node-${shapePropertyId}-property`).selectOption('positionX');

    await connectNodes(
      page,
      { nodeId: handSignalId, port: 'value' },
      { nodeId: mapRangeId, port: 'in' },
    );
    await connectNodes(
      page,
      { nodeId: mapRangeId, port: 'out' },
      { nodeId: shapePropertyId, port: 'in' },
    );

    // --- Exact condition threshold: If/Else at threshold=0.5 ---
    const conditionSignalId = await addNode(page, 'Input: Hand signal');
    await page.locator(`#graph-list-node-${conditionSignalId}-signal`).fill('pinchStrength');
    const ifElseId = await addNode(page, 'Condition: If / Else');
    await page.locator(`#graph-list-node-${ifElseId}-comparison`).selectOption('greaterThan');
    await page.locator(`#graph-list-node-${ifElseId}-threshold`).fill('0.5');
    await connectNodes(
      page,
      { nodeId: conditionSignalId, port: 'value' },
      { nodeId: ifElseId, port: 'in' },
    );

    // --- Elapsed-time node: Timer in "elapsed" mode ---
    const timerId = await addNode(page, 'Input: Timer');
    await expect(page.locator(`#graph-list-node-${timerId}-mode`)).toHaveValue('elapsed');

    // --- Cooldown suppression: Gesture event -> Cooldown -> Particle emitter ---
    const gestureEventId = await addNode(page, 'Input: Gesture event');
    await page.locator(`#graph-list-node-${gestureEventId}-signal`).fill('event:pinchStart');
    const cooldownId = await addNode(page, 'Flow: Cooldown');
    await page.locator(`#graph-list-node-${cooldownId}-milliseconds`).fill('500');
    const particleEmitterId = await addNode(page, 'Visual: Particle emitter');
    await connectNodes(
      page,
      { nodeId: gestureEventId, port: 'event' },
      { nodeId: cooldownId, port: 'trigger' },
    );
    await connectNodes(
      page,
      { nodeId: cooldownId, port: 'trigger' },
      { nodeId: particleEmitterId, port: 'trigger' },
    );

    await expect(page.getByRole('alert')).toHaveCount(0);
    // 5 connections: handSignal->mapRange, mapRange->shapeProperty,
    // conditionSignal->ifElse, gestureEvent->cooldown,
    // cooldown->particleEmitter.
    await expect(
      page.getByRole('list', { name: 'Graph connection list' }).getByRole('listitem'),
    ).toHaveCount(5);

    // The whole authored graph -- 9 nodes (handSignal, mapRange,
    // shapeProperty, conditionSignal, ifElse, timer, gestureEvent,
    // cooldown, particleEmitter), 5 connections, every configured param --
    // round-trips through an explicit save and a full reload, proving the
    // authoring path (not the runtime evaluation, see this file's module
    // doc comment) is correct end to end.
    await saveAndReload(page, /Saved as version 2/);
    await openLogicPanel(page);
    await expect(
      page.getByRole('list', { name: 'Graph node list' }).getByRole('listitem'),
    ).toHaveCount(9);
    await expect(
      page.getByRole('list', { name: 'Graph connection list' }).getByRole('listitem'),
    ).toHaveCount(5);
    await expect(page.locator(`#graph-list-node-${mapRangeId}-outMax`)).toHaveValue('800');
    await expect(page.locator(`#graph-list-node-${ifElseId}-threshold`)).toHaveValue('0.5');
    await expect(page.locator(`#graph-list-node-${ifElseId}-comparison`)).toHaveValue(
      'greaterThan',
    );
    await expect(page.locator(`#graph-list-node-${cooldownId}-milliseconds`)).toHaveValue('500');
  });

  test('two-hand distance threshold is authorable as a graph condition (no live two-hand UI exists)', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlankProjectViaUI(page);
    await openLogicPanel(page);

    // `handDistance` is a documented `$defs.signal` name
    // (`behaviorRuntime.ts`) that `twoHandSignals.ts` produces at runtime,
    // but -- see this file's module doc comment -- no demo control in
    // this app can ever emit a two-hand frame to actually drive it live.
    // What IS provable end to end through the real UI is that the graph
    // editor accepts this exact signal name feeding an exact-threshold
    // condition, and persists it correctly.
    const handDistanceId = await addNode(page, 'Input: Hand signal');
    await page.locator(`#graph-list-node-${handDistanceId}-signal`).fill('handDistance');

    const ifElseId = await addNode(page, 'Condition: If / Else');
    // Matches `DEFAULT_TWO_HAND_SIGNAL_OPTIONS.farEnterThreshold` --
    // chosen to demonstrate a realistic exact threshold, not because this
    // graph is ever actually evaluated against a live two-hand signal.
    await page.locator(`#graph-list-node-${ifElseId}-comparison`).selectOption('greaterThan');
    await page.locator(`#graph-list-node-${ifElseId}-threshold`).fill('0.6');

    await connectNodes(
      page,
      { nodeId: handDistanceId, port: 'value' },
      { nodeId: ifElseId, port: 'in' },
    );

    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator(`#graph-list-node-${handDistanceId}-signal`)).toHaveValue(
      'handDistance',
    );
    await expect(
      page.getByRole('list', { name: 'Graph connection list' }).getByRole('listitem'),
    ).toHaveCount(1);

    await saveAndReload(page, /Saved as version 2/);
    await openLogicPanel(page);
    await expect(page.locator(`#graph-list-node-${handDistanceId}-signal`)).toHaveValue(
      'handDistance',
    );
    await expect(page.locator(`#graph-list-node-${ifElseId}-threshold`)).toHaveValue('0.6');
  });

  test('deterministic randomness indicator and particle-trigger wiring persist across reload', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlankProjectViaUI(page);

    // A freshly created blank project carries `randomness: { seed: 0,
    // enabled: false }` (schema/fixtures/valid/blank.json) -- no
    // indicator yet.
    await expect(page.locator('.randomness-indicator')).toHaveCount(0);

    await openLogicPanel(page);
    // Adding a Task 40 random node is enough to flip
    // `sceneUsesRandomness` -- see `behaviorRuntime.ts`'s own doc comment
    // -- without the author separately toggling anything.
    await addNode(page, 'Input: Random range');

    const indicator = page.locator('.randomness-indicator');
    await expect(indicator).toHaveText('Randomness enabled — seed 0');

    // "the same seeded fixture ... produce equivalent assertions on
    // repeated runs": the same seed is reported identically after an
    // explicit save and a completely fresh page load -- proving the
    // *seed* a real export/runtime would consume is stable and
    // deterministic, which is the one randomness-related fact this app's
    // own UI can observe (see this file's module doc comment for why the
    // actual random *values* are a unit-test-only concern).
    await saveAndReload(page, /Saved as version 2/);
    await expect(indicator).toHaveText('Randomness enabled — seed 0');

    // Effects trigger wiring: an "Emit particles" card is the one
    // particle-related affordance with a real UI surface (particleEmitter
    // graph nodes themselves have zero configurable params -- see the
    // module doc comment). Confirm it produces a real, connected trigger
    // graph fragment, visible consistently in both BehaviorCardsPanel and
    // GraphListView.
    await page.getByRole('button', { name: 'Add circle' }).click();
    await expandAllCollapsibleSections(page);
    await page.getByRole('radio', { name: 'Emit particles', exact: true }).click();
    await page.locator('#behavior-card-event').selectOption('pinchStart');
    await page.getByRole('button', { name: 'Add card', exact: true }).click();
    await expect(
      page.getByRole('list', { name: 'Behavior card list' }).getByText('emit particles.'),
    ).toBeVisible();

    // The card's graph fragment (gestureEvent -> particleEmitter) is the
    // same one node/connection pair GraphListView renders -- 2 nodes (the
    // Random range node added above, plus this card's input node) is not
    // asserted by count here since the exact prior graph size varies by
    // test order; instead assert the specific fragment this card must
    // have produced. "Show logic" is a plain toggle, not a
    // CollapsibleSection -- saveAndReload's expandAllCollapsibleSections
    // doesn't touch it, so the reload above closed it again.
    await openLogicPanel(page);
    await expect(
      page.getByRole('list', { name: 'Graph node list' }).filter({ hasText: 'Gesture event' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('list', { name: 'Graph connection list' })
        .filter({ hasText: 'Gesture event' })
        .filter({ hasText: 'Particle emitter' }),
    ).toBeVisible();
  });
});

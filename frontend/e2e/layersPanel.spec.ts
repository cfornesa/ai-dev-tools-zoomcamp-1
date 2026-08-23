/**
 * Issue #127: end-to-end coverage for the dedicated Layers panel
 * (`frontend/src/pages/LayersPanel.tsx`) — pointer drag-and-drop reorder/
 * reparent and keyboard-only reorder parity, against a real,
 * PostgreSQL-backed deployment of this app. Same infrastructure/
 * conventions as `projectLifecycle.spec.ts`/`interactionRuntime.spec.ts`
 * (`frontend/playwright.config.ts`, `e2e/support/*`, `make e2e`); see
 * `AGENTS.md`'s "End-to-end tests (Playwright)" section for how to run
 * this suite. It self-skips with an actionable message (via
 * `requireE2EFixtures()`) when its prerequisites aren't available.
 *
 * `frontend/e2e/editor.spec.ts`, named in the original issue's "Relevant
 * files", does not exist in this repo (see
 * `.local/tasks/editor-dedicated-layers-panel.md`'s "Out of scope" for
 * why); this new file is the chosen home for this task's browser coverage
 * instead — `interactionRuntime.spec.ts` covers tracking/behavior-graph
 * interaction, not the outline/stacking surface this task changes, so a
 * new file keeps that suite's own scope intact rather than bolting on an
 * unrelated concern.
 *
 * ## Simulating native HTML5 drag-and-drop
 *
 * Real Chromium (unlike jsdom — see `EditorWorkspace.layers.test.tsx`'s
 * own module doc comment for that suite's workaround) implements a real
 * `DragEvent`/`DataTransfer`, so this dispatches the exact
 * `dragstart`/`dragover`/`drop`/`dragend` sequence `LayersPanel.tsx`
 * listens for directly inside the page via `page.evaluate` against real
 * DOM element handles, with `clientY` computed from the target row's own
 * `getBoundingClientRect()` at a chosen vertical fraction — deterministic
 * regardless of actual pixel layout, and exercises the same code path a
 * real mouse-driven drag would (`Locator.dragTo()` was deliberately not
 * used: its target point defaults to dead-center, which can't reach a
 * shape row's "before" zone — only "after" — since shape rows never offer
 * an "into" zone; see `LayersPanel.tsx`'s `zoneForRow`).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { requireE2EFixtures } from './support/prerequisites.js';
import { loginViaUI } from './support/auth.js';
import type { E2EState } from './support/state.js';

type Fixtures = Extract<E2EState, { available: true }>;

async function createBlankProjectViaUI(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create new animation' }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  // Issue #131: "Add circle/rectangle/line/polygon" moved from the Tools
  // panel's (formerly collapsed) "Add & edit shapes" section into the
  // always-visible LayersPanel toolbar, so no section needs expanding to
  // reach them anymore.
}

function outlineList(page: Page): Locator {
  return page.getByRole('list', { name: 'Scene outline' });
}

function outlineRows(page: Page): Locator {
  return outlineList(page).locator('[data-outline-kind]');
}

async function shapeRow(page: Page, label: string): Promise<Locator> {
  return page.getByRole('button', { name: label, exact: true }).locator('xpath=ancestor::li[1]');
}

async function layerRow(page: Page, name: string): Promise<Locator> {
  return page.getByLabel(`Layer name for ${name}`).locator('xpath=ancestor::li[1]');
}

/** Fires the real `dragstart`/`dragover`/`drop`/`dragend` sequence against
 * `source`/`target`'s actual DOM nodes, with `clientY` placed at
 * `targetFraction` of `target`'s own height (0 = top edge/"before" zone,
 * 0.5 = middle/"into" zone for a group or layer row, 1 = bottom edge/
 * "after" zone) — see `LayersPanel.tsx`'s `zoneForRow` for the exact
 * thresholds this lines up with. */
async function fireLayerDrag(
  page: Page,
  source: Locator,
  target: Locator,
  targetFraction: number,
): Promise<void> {
  const sourceHandle = await source.elementHandle();
  const targetHandle = await target.elementHandle();
  if (!sourceHandle || !targetHandle) {
    throw new Error('fireLayerDrag: source/target row not found in the DOM.');
  }
  await page.evaluate(
    ({ source, target, targetFraction }) => {
      const rect = target.getBoundingClientRect();
      const clientY = rect.top + rect.height * targetFraction;
      const clientX = rect.left + rect.width / 2;
      const dataTransfer = new DataTransfer();
      const fire = (type: string, el: Element) => {
        el.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }),
        );
      };
      fire('dragstart', source);
      fire('dragover', target);
      fire('drop', target);
      fire('dragend', source);
    },
    { source: sourceHandle, target: targetHandle, targetFraction },
  );
}

/** Every currently rendered shape's id, in the SVG overlay's own DOM
 * (i.e. z-) order — the same `data-testid="scene-shape-<id>"` convention
 * `interactionRuntime.spec.ts`/`projectLifecycle.spec.ts` already rely on.
 * `EditorWorkspace.tsx` renders this list straight from
 * `sceneEditor.shapes` (raw scene-document array order), so this is
 * exactly what a `moveItemBySteps`-driven top-level reorder changes. */
async function canvasZOrder(page: Page): Promise<string[]> {
  const testIds = await page
    .locator('[data-testid^="scene-shape-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
  return testIds.map((id) => (id ?? '').replace('scene-shape-', ''));
}

async function outlineRowIds(page: Page): Promise<(string | null)[]> {
  return outlineRows(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-outline-id')),
  );
}

/** No duplicate/missing rows: unique ids, no `null`s from a row missing
 * its own `data-outline-id`. */
async function assertNoDuplicateOutlineRows(page: Page): Promise<void> {
  const ids = await outlineRowIds(page);
  expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
  expect(new Set(ids).size).toBe(ids.length);
}

test.describe('Layers panel', () => {
  let fixtures: Fixtures;

  test.beforeAll(() => {
    fixtures = requireE2EFixtures();
  });

  test('renders as its own dedicated landmark, distinct from Tools', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlankProjectViaUI(page);

    const layersRegion = page.getByRole('region', { name: 'Layers' });
    await expect(layersRegion).toBeVisible();
    await expect(layersRegion.getByRole('list', { name: 'Scene outline' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Tools' }).getByRole('list', { name: 'Scene outline' }),
    ).toHaveCount(0);
  });

  test('pointer drag-and-drop and keyboard reorder both land in the same canonical scene order, verified on the canvas and after reload', async ({
    page,
  }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlankProjectViaUI(page);

    // Three shapes across a group and a second layer (this task's own
    // "creates at least three shapes across layers/groups" criterion).
    await page.getByRole('button', { name: 'Add layer' }).click(); // Layer 2
    await page.getByRole('button', { name: 'Add circle' }).click(); // Circle 1 (Layer 1)
    await page.getByRole('button', { name: 'Add rectangle' }).click(); // Rectangle 1 (Layer 1)
    await page.getByRole('button', { name: 'Add circle' }).click(); // Circle 2 (Layer 1)
    await assertNoDuplicateOutlineRows(page);

    await page.getByRole('checkbox', { name: 'Add Circle 1 to group selection' }).click();
    await page.getByRole('checkbox', { name: 'Add Rectangle 1 to group selection' }).click();
    await page.getByRole('button', { name: 'Combine into group' }).click(); // -> Group 1
    await assertNoDuplicateOutlineRows(page);

    // Reparent the loose Circle 2 onto Layer 2 by dragging it onto that
    // layer's row (its middle third is always an "into"/reparent zone for
    // a layer target, regardless of before/after — see `planDrop`).
    const circle2Row = await shapeRow(page, 'Circle 2');
    const layer2Row = await layerRow(page, 'Layer 2');
    await fireLayerDrag(page, circle2Row, layer2Row, 0.5);
    await assertNoDuplicateOutlineRows(page);
    // Circle 2's row now sits after the "Layer 2" row rather than
    // immediately after "Layer 1" — the same before/after-position check
    // `EditorWorkspace.layers.test.tsx`'s reparent-to-layer tests use.
    const idsAfterReparent = await outlineRowIds(page);
    const kindsAfterReparent = await outlineRows(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-outline-kind')),
    );
    const layer2RowId: string | null = await layer2Row.getAttribute('data-outline-id');
    const circle2RowId: string | null = await (
      await shapeRow(page, 'Circle 2')
    ).getAttribute('data-outline-id');
    const layer2Index = idsAfterReparent.indexOf(layer2RowId);
    const circle2Index = idsAfterReparent.indexOf(circle2RowId);
    expect(kindsAfterReparent[layer2Index]).toBe('layer');
    expect(circle2Index).toBeGreaterThan(layer2Index);

    // Two more loose top-level shapes on Layer 1, alongside Group 1 —
    // the pair this test actually reorders/asserts z-order against.
    await page.getByRole('button', { name: 'Add rectangle' }).click(); // Rectangle 2 (Layer 1)
    await page.getByRole('button', { name: 'Add circle' }).click(); // Circle 3 (Layer 1)
    const rectangle2Label = 'Rectangle 2';
    const thirdCircleLabel = 'Circle 3';
    await expect(await shapeRow(page, thirdCircleLabel)).toBeVisible();
    await assertNoDuplicateOutlineRows(page);

    const zBefore = await canvasZOrder(page);
    expect(zBefore.length).toBe(5); // 5 shapes created above, none deleted

    // Pointer drag: move the last-added circle above Rectangle 2 (both
    // top-level, loose, same layer -- a same-container reorder).
    const rectangle2Row = await shapeRow(page, rectangle2Label);
    const thirdCircleRow = await shapeRow(page, thirdCircleLabel!);
    await fireLayerDrag(page, thirdCircleRow, rectangle2Row, 0.1); // top zone: "before"

    const zAfterDrag = await canvasZOrder(page);
    expect(zAfterDrag).not.toEqual(zBefore);
    expect(zAfterDrag.slice(-2)).toEqual(zBefore.slice(-2).reverse());
    await assertNoDuplicateOutlineRows(page);

    // Keyboard-only reorder: the existing "Move up" button swaps the same
    // pair straight back -- the exact position a drag could also reach,
    // reachable with no pointer at all. Issue #131 moved this button behind
    // a per-row <details>/<summary> disclosure, so it must be opened first.
    const thirdCircleRowAfterDrag = await shapeRow(page, thirdCircleLabel!);
    await thirdCircleRowAfterDrag.getByRole('button', { name: 'More' }).click();
    await thirdCircleRowAfterDrag.getByRole('button', { name: /^Move .* down$/ }).click();

    const zAfterKeyboard = await canvasZOrder(page);
    expect(zAfterKeyboard).toEqual(zBefore);
    await assertNoDuplicateOutlineRows(page);

    // Persisted order survives a real save + full page reload.
    const rowIdsBeforeSave = await outlineRowIds(page);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 2/);
    await page.reload();
    await expect(page.getByTestId('editor-save-status')).toHaveText(/Saved as version 2/);

    await assertNoDuplicateOutlineRows(page);
    const rowIdsAfterReload = await outlineRowIds(page);
    expect(rowIdsAfterReload).toEqual(rowIdsBeforeSave);
    const zAfterReload = await canvasZOrder(page);
    expect(zAfterReload).toEqual(zAfterKeyboard);
  });

  test('rejects a drop onto a locked layer, leaving the outline unchanged', async ({ page }) => {
    await loginViaUI(page, fixtures.owner.email, fixtures.password);
    await createBlankProjectViaUI(page);

    await page.getByRole('button', { name: 'Add layer' }).click(); // Layer 2
    const layer2Row = await layerRow(page, 'Layer 2');
    await layer2Row.getByRole('button', { name: 'Unlocked' }).click();
    await expect(layer2Row.getByRole('button', { name: 'Locked' })).toBeVisible();

    await page.getByRole('button', { name: 'Add circle' }).click(); // Circle 1, on Layer 1
    const rowIdsBefore = await outlineRowIds(page);

    const shapeRowEl = await shapeRow(page, 'Circle 1');
    const layer2RowAfter = await layerRow(page, 'Layer 2');
    await fireLayerDrag(page, shapeRowEl, layer2RowAfter, 0.5);

    // Rejected: no scene mutation, no duplicate/missing rows.
    const rowIdsAfter = await outlineRowIds(page);
    expect(rowIdsAfter).toEqual(rowIdsBefore);
    await assertNoDuplicateOutlineRows(page);
  });
});

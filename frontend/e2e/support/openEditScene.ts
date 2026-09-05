import type { Page } from '@playwright/test';

/**
 * Issue #427: shape authoring, Undo/Redo, and Save moved from an
 * inline/sidebar toolbar into the stage-local "Edit scene" popover
 * (`PieceStageToolbar`/`StageControlsPopover` in
 * `frontend/src/pages/EditorWorkspace.tsx`), nested behind the stage's
 * "Open piece controls menu" trigger. Mirrors the working sequence already
 * proven by `manual2dCanvasContainment.spec.ts` and
 * `manual2dStageChrome.spec.ts`: open the piece-controls menu, click Edit
 * scene, then wait for the nested "Editor actions" toolbar (Add
 * circle/rectangle/line/polygon, Undo, Redo, Save) to actually be visible
 * before any caller resolves a button inside it.
 *
 * Idempotent by design -- a caller that already has the authoring toolbar
 * open (e.g. a helper invoked twice across two saves in the same test) gets
 * a no-op instead of accidentally toggling the outer menu closed again.
 */
export async function openEditScene(page: Page): Promise<void> {
  const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
  const authoringToolbar = toolbar.getByRole('toolbar', { name: 'Editor actions' });
  if (await authoringToolbar.isVisible().catch(() => false)) return;

  const menuTrigger = toolbar.getByRole('button', { name: 'Open piece controls menu' });
  if (await menuTrigger.isVisible().catch(() => false)) {
    await menuTrigger.click();
  }
  await toolbar.getByRole('button', { name: 'Edit scene', exact: true }).click();
  await authoringToolbar.waitFor({ state: 'visible' });
}

/**
 * Counterpart to `openEditScene`: the outer "piece controls menu" renders
 * as a modal overlay (`aria-modal="true"`) across the whole Preview panel
 * while open, so it intercepts pointer events aimed at anything outside
 * the stage (e.g. Version History's Restore/Delete buttons) and adds a
 * second `<h2>` ("Piece actions") that breaks strict-mode heading
 * locators. Call this once a scenario is done adding shapes/saving and is
 * about to interact with or assert on something outside the stage.
 */
export async function closeEditScene(page: Page): Promise<void> {
  const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
  const authoringToolbar = toolbar.getByRole('toolbar', { name: 'Editor actions' });
  if (!(await authoringToolbar.isVisible().catch(() => false))) return;
  await page.keyboard.press('Escape');
  await authoringToolbar.waitFor({ state: 'hidden' });
}

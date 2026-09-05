import type { Page } from '@playwright/test';

/**
 * Issues #427/#444: shape authoring (Add circle/Undo/Redo/Save) and
 * publication status (Publish/Unpublish, via `PublishControl.tsx`) both
 * moved from inline/sidebar controls into stage-local `StageControlsPopover`
 * panels, all nested behind the stage's single "Open piece controls menu"
 * trigger (`PieceStageToolbar`/`EditorWorkspace.tsx`). Mirrors the working
 * sequence already proven by `manual2dCanvasContainment.spec.ts` and
 * `manual2dStageChrome.spec.ts`: open the piece-controls menu once, then
 * click whichever nested popover trigger ("Edit scene",
 * "Publication status: Draft/Published") a scenario needs.
 *
 * Idempotent by design -- a caller that already has the menu open gets a
 * no-op instead of accidentally toggling it closed again.
 */
export async function openPieceControlsMenu(page: Page): Promise<void> {
  const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
  // `waitFor` (unlike a bare `isVisible()` check) actually retries, which
  // matters right after a fresh `page.goto()` -- the stage may not have
  // mounted yet when a caller checks immediately.
  await toolbar.waitFor({ state: 'visible' });
  const menuTrigger = toolbar.getByRole('button', { name: 'Open piece controls menu' });
  if (!(await menuTrigger.isVisible().catch(() => false))) return; // already open
  await menuTrigger.click();
}

/**
 * The outer "piece controls menu" renders as a modal overlay
 * (`aria-modal="true"`) across the whole Preview panel while open, so it
 * intercepts pointer events aimed at anything outside the stage (e.g.
 * Version History's Restore/Delete buttons) and adds extra `<h2>`/dialog
 * content that breaks strict-mode locators. Call this once a scenario is
 * done with stage-local controls and is about to interact with or assert
 * on something outside the stage.
 */
export async function closePieceControlsMenu(page: Page): Promise<void> {
  const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
  const menuTrigger = toolbar.getByRole('button', { name: 'Close piece controls menu' });
  if (!(await menuTrigger.isVisible().catch(() => false))) return; // already closed
  await page.keyboard.press('Escape');
  await menuTrigger.waitFor({ state: 'hidden' }).catch(() => {});
}

/** Opens the piece-controls menu, then the nested "Edit scene" popover,
 * and waits for its authoring toolbar (Add circle/rectangle/line/polygon,
 * Undo, Redo, Save) to actually be visible before any caller resolves a
 * button inside it. */
export async function openEditScene(page: Page): Promise<void> {
  const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
  const authoringToolbar = toolbar.getByRole('toolbar', { name: 'Editor actions' });
  if (await authoringToolbar.isVisible().catch(() => false)) return;

  await openPieceControlsMenu(page);
  await toolbar.getByRole('button', { name: 'Edit scene', exact: true }).click();
  await authoringToolbar.waitFor({ state: 'visible' });
}

/** Counterpart to `openEditScene` -- see `closePieceControlsMenu` for why
 * this matters once a scenario moves on to non-stage assertions. */
export async function closeEditScene(page: Page): Promise<void> {
  const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
  const authoringToolbar = toolbar.getByRole('toolbar', { name: 'Editor actions' });
  if (!(await authoringToolbar.isVisible().catch(() => false))) return;
  await page.keyboard.press('Escape');
  await authoringToolbar.waitFor({ state: 'hidden' });
}

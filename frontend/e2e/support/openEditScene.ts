import type { Page } from '@playwright/test';

/**
 * The editor authoring toolbar is a page-level control panel for 2D editing.
 * At desktop widths it is visible in document flow; at narrow widths it is
 * behind the accessible "Editor tools" disclosure. The helper keeps the
 * existing tests independent of that responsive presentation.
 *
 * Idempotent by design -- a caller that already has the menu open gets a
 * no-op instead of accidentally toggling it closed again.
 */
export async function openPieceControlsMenu(page: Page): Promise<void> {
  const toolbar = page.getByRole('toolbar', { name: 'Piece actions' });
  // Inline editor surfaces expose the actionable controls directly. Their
  // compatibility menu trigger is intentionally screen-reader-only and must
  // not be clicked through the overlay (issue #917).
  if ((await toolbar.getAttribute('data-toolbar-mode')) === 'inline') return;
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
  // Bug fixed in this session: this used to check the "Close piece
  // controls menu" *button*'s visibility, but that accessible name is
  // shared by both the outer hamburger toggle and the dialog's own "x"
  // dismiss button while open (`PieceStageToolbar.tsx`) -- a strict-mode
  // violation `.isVisible().catch(() => false)` silently swallowed as
  // "already closed", so this never actually pressed Escape. The dialog
  // itself (labelled by its own "Piece actions" heading) has no such
  // ambiguity.
  const dialog = toolbar.getByRole('dialog', { name: 'Piece actions' });
  if (!(await dialog.isVisible().catch(() => false))) return; // already closed
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' }).catch(() => {});
}

/** Opens the piece-controls menu, then the nested "Edit scene" popover,
 * and waits for its authoring toolbar (Add circle/rectangle/line/polygon,
 * Undo, Redo, Save) to actually be visible before any caller resolves a
 * button inside it. */
export async function openEditScene(page: Page): Promise<void> {
  const previewTab = page.getByRole('tab', { name: 'Preview', exact: true });
  if (await previewTab.isVisible().catch(() => false)) {
    await previewTab.click();
  }
  // `getByRole` intentionally excludes the toolbar while its responsive
  // disclosure is closed. Use the semantic attributes for the attachment
  // wait, then switch back to the role locator for visible assertions.
  const authoringToolbar = page.locator('[role="toolbar"][aria-label="Editor actions"]');
  await authoringToolbar.waitFor({ state: 'attached' });
  if (await authoringToolbar.isVisible().catch(() => false)) return;

  const toggle = page.getByRole('button', { name: 'Editor tools' });
  await toggle.waitFor({ state: 'visible' });
  await toggle.click();
  await authoringToolbar.waitFor({ state: 'visible' });
}

/** Counterpart to `openEditScene` -- see `closePieceControlsMenu` for why
 * this matters once a scenario moves on to non-stage assertions. */
export async function closeEditScene(page: Page): Promise<void> {
  const authoringToolbar = page.getByRole('toolbar', { name: 'Editor actions' });
  const toggle = page.getByRole('button', { name: 'Editor tools' });
  if (!(await toggle.isVisible().catch(() => false))) return;
  if (!(await authoringToolbar.isVisible().catch(() => false))) return;
  await page.keyboard.press('Escape');
  await authoringToolbar.waitFor({ state: 'hidden' }).catch(() => {});
}

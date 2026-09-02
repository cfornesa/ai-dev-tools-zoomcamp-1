import { fireEvent, screen } from '@testing-library/react';

/**
 * Issue #95, point 6: every `CollapsibleSection` (CollapsibleSection.tsx)
 * now defaults to closed instead of open. Most `EditorWorkspace*.test.tsx`
 * suites were written against the old always-open default and need their
 * panel content immediately visible to exercise it — this expands the
 * mounted top-level panels first, then every currently-collapsed nested
 * accordion toggle, so each suite's own loader can call this once after the
 * workspace mounts rather than re-deriving which toggles apply to it.
 */
export function expandAllCollapsibleSections(): void {
  // Stage-local camera/demo controls are intentionally disclosed separately
  // from the editor sidebars. Open the shared disclosure for legacy suites
  // that exercise those controls after expanding editor panels.
  const pieceControls = screen.queryByRole('button', { name: 'Piece controls' });
  if (pieceControls?.getAttribute('aria-expanded') === 'false') {
    fireEvent.click(pieceControls);
  }
  screen
    .queryAllByRole('button', { expanded: false, hidden: true })
    .filter((toggle) => toggle.classList.contains('editor-panel-disclosure-toggle'))
    .forEach((toggle) => fireEvent.click(toggle));
  screen
    .queryAllByRole('button', { expanded: false })
    .filter((toggle) => toggle.classList.contains('editor-collapsible-section-toggle'))
    .forEach((toggle) => fireEvent.click(toggle));
}

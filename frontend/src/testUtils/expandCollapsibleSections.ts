import { fireEvent, screen } from '@testing-library/react';

/**
 * Issue #95, point 6: every `CollapsibleSection` (CollapsibleSection.tsx)
 * now defaults to closed instead of open. Most `EditorWorkspace*.test.tsx`
 * suites were written against the old always-open default and need a
 * given panel's content immediately visible to exercise it — this expands
 * every currently-collapsed accordion toggle in one pass (there are no
 * further toggles to discover after that single pass: expanding a section
 * only reveals its own content, never another section's toggle), so each
 * suite's own loader can call this once after the workspace mounts rather
 * than re-deriving which toggles apply to it.
 */
export function expandAllCollapsibleSections(): void {
  screen
    .queryAllByRole('button', { expanded: false })
    .filter((toggle) => toggle.classList.contains('editor-collapsible-section-toggle'))
    .forEach((toggle) => fireEvent.click(toggle));
}

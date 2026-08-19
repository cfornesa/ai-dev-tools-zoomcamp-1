import { useEffect, useRef, type KeyboardEvent } from 'react';

/**
 * Task 64 (issue #64): shared focus-management behavior for this app's
 * `role="alertdialog"` confirmation prompts (`EditorWorkspace`'s
 * exit-without-saving confirm, `BehaviorCardsPanel`'s binding-conflict
 * confirm, `VersionHistoryPanel`'s delete-version confirm). Before this
 * task, all three rendered valid ARIA structure but never moved focus,
 * never closed on Escape, and never returned focus to their trigger — real
 * defects found by this task's keyboard-accessibility audit (see the issue
 * #64 tracking comment for the full audit writeup).
 *
 * Per the WAI-ARIA Alert and Message Dialogs pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/):
 * - Focus moves to an element inside the dialog when it opens (here: the
 *   dialog container itself, via `tabIndex={-1}` — every caller already has
 *   an `aria-labelledby` pointing at a heading inside it, so a screen
 *   reader announces that heading as soon as focus lands).
 * - Escape dismisses the dialog. Every caller here maps Escape to the same
 *   action as its own Cancel/dismiss control specifically — never to a
 *   destructive confirm action ("Exit without saving", "Replace existing
 *   binding", "Delete version") — so pressing Escape can never itself
 *   perform the action the dialog exists to gate.
 * - Focus returns to whatever had it immediately before the dialog opened,
 *   once the dialog closes (including via Escape) — this is what actually
 *   lets a keyboard-only user continue exactly where they left off, rather
 *   than losing their place in a long panel.
 *
 * This hook does not trap Tab focus inside the dialog while it's open —
 * none of these three alertdialogs are rendered in a portal or otherwise
 * pulled out of normal document flow, and issue #64's own acceptance
 * criterion is "no interaction traps focus," not that one gets added here.
 */
export function useAlertDialogFocus<T extends HTMLElement>(onDismiss: () => void) {
  const dialogRef = useRef<T>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus();
    };
    // Runs once per mount/unmount of the dialog itself — every caller here
    // conditionally *mounts* the dialog component rather than toggling a
    // prop on an always-mounted one, so "on mount" and "on open" coincide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(event: KeyboardEvent<T>) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onDismiss();
  }

  return { dialogRef, onKeyDown };
}

import { useState } from 'react';

import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import type { RecoveryCandidate } from './useDraftRecovery';

/**
 * Task 44: the recovery prompt from `_docs/plan.md`'s "Recovery prompt"
 * section — shown BEFORE `EditorWorkspace.tsx` renders its interactive
 * panels whenever a valid active draft (local or server, already
 * reconciled by `useDraftRecovery`) exists for the project being opened.
 *
 * An accessible confirmation dialog, matching the conventions already
 * established by `BehaviorCardsPanel.tsx`'s conflict dialog,
 * `VersionHistoryPanel.tsx`'s soft-delete confirmation, and
 * `EditorWorkspace.tsx`'s own "Exit without saving" dialog: `alertdialog`
 * role, an `aria-labelledby` heading, plain buttons (no custom modal
 * library).
 */
function formatAutosaveTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export type DraftRecoveryPromptProps = {
  candidate: RecoveryCandidate;
  onRecover: () => void;
  onDiscard: () => void | Promise<void>;
  onCancel: () => void;
};

function DraftRecoveryPrompt({
  candidate,
  onRecover,
  onDiscard,
  onCancel,
}: DraftRecoveryPromptProps) {
  const [isDiscarding, setIsDiscarding] = useState(false);
  // Task 64 (issue #64): this dialog fully replaces `EditorWorkspace`'s
  // rendered content while it's shown (see that file's own render-branch
  // comment) rather than layering over it, so there's no "trigger" element
  // to return focus to on close the way the panel-level confirmation
  // dialogs have. Focus-into-dialog on mount still matters here — without
  // it, a screen reader user lands on the generic document body instead of
  // immediately hearing "Recover unsaved work?" — and Escape is still
  // mapped to the same non-destructive action as the Cancel button.
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onCancel);

  async function handleDiscard() {
    if (isDiscarding) return;
    setIsDiscarding(true);
    await onDiscard();
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="alertdialog"
      aria-labelledby="draft-recovery-title"
      aria-describedby="draft-recovery-summary"
      className="draft-recovery-prompt"
    >
      {/* Task 63 (issue #63): `<h2>`, not `<h4>` — unlike the other
          `alertdialog`s in this app (which layer over an already-rendered
          panel with its own `<h2>`/`<h3>` hierarchy), this one fully
          *replaces* `EditorWorkspace`'s rendered content while shown (see
          this file's own docstring), so it's the first heading after
          `Layout.tsx`'s page-level `<h1>` — an `<h4>` here skipped two
          levels, a real `heading-order` defect this audit found. */}
      <h2 id="draft-recovery-title">Recover unsaved work?</h2>
      <p id="draft-recovery-summary">
        Autosaved {formatAutosaveTime(candidate.savedAt)} &middot; {candidate.changeSummary}
      </p>
      <button type="button" onClick={onRecover} disabled={isDiscarding}>
        Recover draft
      </button>
      <button type="button" onClick={() => void handleDiscard()} disabled={isDiscarding}>
        {isDiscarding ? 'Discarding…' : 'Discard draft'}
      </button>
      <button type="button" onClick={onCancel} disabled={isDiscarding}>
        Cancel
      </button>
    </div>
  );
}

export default DraftRecoveryPrompt;

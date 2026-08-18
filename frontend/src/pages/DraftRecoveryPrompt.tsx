import { useState } from 'react';

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

  async function handleDiscard() {
    if (isDiscarding) return;
    setIsDiscarding(true);
    await onDiscard();
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="draft-recovery-title"
      aria-describedby="draft-recovery-summary"
      className="draft-recovery-prompt"
    >
      <h4 id="draft-recovery-title">Recover unsaved work?</h4>
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

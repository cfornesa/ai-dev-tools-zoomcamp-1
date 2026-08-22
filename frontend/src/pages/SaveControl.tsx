import { useState, type FormEvent } from 'react';

import type { SceneDocument, SceneVersion } from '../api/projects';
import { useVersionHistory } from './useVersionHistory';
import { ActionErrorMessage } from './VersionHistoryPanel';

/**
 * Issue #95 follow-up ("Maybe there needs to be a Save button as well to
 * save changes without publishing"): a prominent explicit-Save action for
 * the editor header, next to Publish — previously the only way to create
 * a new version was to open the Inspector's "Version history" accordion
 * section (collapsed by default since issue #95, point 6), which buried
 * the one action every edit session eventually needs behind an extra
 * click. Ported unchanged from `VersionHistoryPanel.tsx`'s old inline
 * `<form>` (same `save`/change-label/validation-error behavior), which no
 * longer renders its own Save form now that this exists — see that
 * file's own doc comment.
 *
 * Self-contained: calls `useVersionHistory(projectId, false)` for its own
 * `save` action rather than sharing the Inspector panel's instance —
 * `enabled: false` skips that hook's own version-list GET entirely (it
 * only gates `loadHistory`, never `save`), so this never fetches history
 * data it doesn't render, and the Inspector panel's own instance (when
 * its section is later opened) picks up the new version from its own
 * fresh fetch, not a shared cache.
 */
function SaveControl({
  projectId,
  workingCopy,
  isDirty,
  onSaved,
}: {
  projectId: string;
  workingCopy: SceneDocument | null;
  isDirty: boolean;
  onSaved: (version: SceneVersion) => void;
}) {
  const { save, saveState } = useVersionHistory(projectId, false);
  const [changeLabel, setChangeLabel] = useState('');

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!workingCopy) return;
    const saved = await save(workingCopy, 'manual', changeLabel);
    if (saved) {
      setChangeLabel('');
      onSaved(saved);
    }
  }

  return (
    <div className="editor-save-control">
      <form aria-label="Save version" onSubmit={(event) => void handleSave(event)}>
        <label htmlFor="editor-save-change-label">Change label (optional)</label>
        <input
          id="editor-save-change-label"
          type="text"
          value={changeLabel}
          onChange={(event) => setChangeLabel(event.target.value)}
        />
        <button type="submit" disabled={!workingCopy || !isDirty || saveState.pending}>
          {saveState.pending ? 'Saving…' : 'Save'}
        </button>
      </form>

      {saveState.error && <ActionErrorMessage error={saveState.error} testId="save-error" />}
    </div>
  );
}

export default SaveControl;

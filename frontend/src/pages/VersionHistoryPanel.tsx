import { useState, type FormEvent } from 'react';

import type { Project, SceneDocument, SceneVersion, SceneVersionSummary } from '../api/projects';
import { useVersionHistory, type VersionActionError } from './useVersionHistory';

const ORIGIN_LABELS: Record<string, string> = {
  manual: 'Manual save',
  ai_create: 'AI: generated scene',
  ai_edit: 'AI: proposed edit',
  restore: 'Restored',
  fork: 'Forked',
};

function originLabel(origin: string): string {
  return ORIGIN_LABELS[origin] ?? origin;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function ActionErrorMessage({ error, testId }: { error: VersionActionError; testId: string }) {
  return (
    <div role="alert" aria-live="assertive" data-testid={testId}>
      <p>{error.message}</p>
      {error.kind === 'validation' && error.details.length > 0 && (
        <ul>
          {error.details.map((detail, index) => (
            <li key={`${detail.path}-${detail.rule}-${index}`}>
              {detail.path}: {detail.message}
            </li>
          ))}
        </ul>
      )}
      {error.kind === 'auth' && (
        <p>
          <a href="/accounts/login/">Sign in again</a>
        </p>
      )}
    </div>
  );
}

type VersionHistoryPanelProps = {
  projectId: string;
  project: Project | null;
  persistedVersion: SceneVersion | null;
  workingCopy: SceneDocument | null;
  isDirty: boolean;
  onSaved: (version: SceneVersion) => void;
  onRestored: (version: SceneVersion) => void;
};

/**
 * Task 41: explicit save plus the immutable version-history view — save,
 * inspect, restore, and soft-delete, all going through the Task 14/15
 * APIs via `useVersionHistory`. Deliberately separate from Task 42-44's
 * crash-recovery draft UI (autosave, recovery prompt) — this panel only
 * ever acts on an explicit user action (Save / Restore / Delete), never
 * saves anything automatically.
 *
 * Row previews: no thumbnail-generation system exists yet server-side
 * (`scenes/serializers.py`'s `THUMBNAIL_CHOICES` comment — that's Task
 * 54), so each row's preview is the documented fallback described in
 * `_docs/plan.md`'s "Version history UI" section: a small placeholder
 * carrying the version's own metadata (its number) rather than a
 * rendered image of the scene.
 */
function VersionHistoryPanel({
  projectId,
  project,
  persistedVersion,
  workingCopy,
  isDirty,
  onSaved,
  onRestored,
}: VersionHistoryPanelProps) {
  const {
    historyLoadState,
    historyError,
    versions,
    reloadHistory,
    save,
    saveState,
    restore,
    restoreState,
    remove,
    deleteState,
  } = useVersionHistory(projectId, true);

  const [changeLabel, setChangeLabel] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const currentVersionId = project?.current_version ?? null;

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!workingCopy) return;
    const saved = await save(workingCopy, 'manual', changeLabel);
    if (saved) {
      setChangeLabel('');
      onSaved(saved);
    }
  }

  async function handleRestore(versionId: number) {
    const restored = await restore(versionId);
    if (restored) {
      onRestored(restored);
    }
  }

  async function handleConfirmDelete(versionId: number) {
    const deleted = await remove(versionId);
    if (deleted) {
      setPendingDeleteId(null);
    }
  }

  const sortedVersions: SceneVersionSummary[] = [...versions].sort(
    (a, b) => a.sequence - b.sequence,
  );

  return (
    <div className="version-history-panel">
      <h4>Save &amp; version history</h4>

      <p role="status" aria-live="polite" data-testid="working-state-status">
        {isDirty
          ? 'Unsaved changes'
          : `Saved${persistedVersion ? ` as version ${persistedVersion.sequence}` : ''}`}
      </p>

      <form aria-label="Save version" onSubmit={handleSave}>
        <div className="behavior-card-field">
          <label htmlFor="version-change-label">Change label (optional)</label>
          <input
            id="version-change-label"
            type="text"
            value={changeLabel}
            onChange={(event) => setChangeLabel(event.target.value)}
          />
        </div>
        <button type="submit" disabled={!workingCopy || !isDirty || saveState.pending}>
          {saveState.pending ? 'Saving…' : 'Save'}
        </button>
      </form>

      {saveState.error && <ActionErrorMessage error={saveState.error} testId="save-error" />}

      <h5>History</h5>

      {historyLoadState === 'loading' && (
        <p role="status" aria-live="polite">
          Loading version history…
        </p>
      )}

      {historyLoadState === 'error' && (
        <div>
          <p role="alert" aria-live="assertive">
            {historyError?.message ??
              'Could not load version history. Your working changes have not been lost.'}
          </p>
          <button type="button" onClick={() => reloadHistory()}>
            Retry
          </button>
        </div>
      )}

      {historyLoadState === 'ready' && sortedVersions.length === 0 && (
        <p role="alert" aria-live="assertive">
          No saved versions were found for this project. Every project is expected to always have at
          least one saved version, so this is unexpected — your working changes have not been lost.
          Try reloading the page, or use Save above to create the first version.
        </p>
      )}

      {historyLoadState === 'ready' && sortedVersions.length > 0 && (
        <ul aria-label="Version history" className="version-history-list">
          {sortedVersions.map((version) => {
            const isCurrent = version.id === currentVersionId;
            const isRestoringThis = restoreState.pending && restoreState.versionId === version.id;
            const isDeletingThis = deleteState.pending && deleteState.versionId === version.id;
            return (
              <li key={version.id} className="version-history-item">
                <div className="version-history-thumb" aria-hidden="true">
                  v{version.sequence}
                </div>
                <div className="version-history-details">
                  <p>
                    <strong>Version {version.sequence}</strong>
                    {isCurrent && (
                      <span data-testid={`latest-marker-${version.id}`}> · Latest</span>
                    )}
                  </p>
                  <p>
                    {formatTimestamp(version.created_at)} · {version.created_by ?? 'Unknown'} ·{' '}
                    {originLabel(version.origin)}
                  </p>
                  <p>{version.change_label || 'No change label'}</p>
                </div>
                <div className="version-history-actions">
                  <button
                    type="button"
                    disabled={isCurrent || isRestoringThis}
                    onClick={() => handleRestore(version.id)}
                  >
                    {isRestoringThis ? 'Restoring…' : 'Restore'}
                  </button>
                  <button
                    type="button"
                    disabled={isCurrent || isDeletingThis}
                    onClick={() => setPendingDeleteId(version.id)}
                  >
                    Delete
                  </button>
                </div>

                {pendingDeleteId === version.id && (
                  <div
                    role="alertdialog"
                    aria-labelledby={`version-delete-confirm-title-${version.id}`}
                    className="version-delete-confirm"
                  >
                    <h5 id={`version-delete-confirm-title-${version.id}`}>
                      Delete version {version.sequence}?
                    </h5>
                    <p>This removes it from history. This cannot be undone from here.</p>
                    <button type="button" onClick={() => handleConfirmDelete(version.id)}>
                      Delete version
                    </button>
                    <button type="button" onClick={() => setPendingDeleteId(null)}>
                      Cancel
                    </button>
                  </div>
                )}

                {restoreState.error && restoreState.versionId === version.id && (
                  <ActionErrorMessage
                    error={restoreState.error}
                    testId={`restore-error-${version.id}`}
                  />
                )}
                {deleteState.error && deleteState.versionId === version.id && (
                  <ActionErrorMessage
                    error={deleteState.error}
                    testId={`delete-error-${version.id}`}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default VersionHistoryPanel;

import { useState } from 'react';

import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import type { Project, SceneVersion, SceneVersionSummary } from '../api/projects';
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

export function ActionErrorMessage({
  error,
  testId,
}: {
  error: VersionActionError;
  testId: string;
}) {
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

/**
 * Task 64 (issue #64): the "delete this version?" confirmation, as its own
 * component so `useAlertDialogFocus` (focus-into-dialog on open, Escape
 * cancels rather than deleting, focus returns to the trigger on close)
 * runs for exactly this dialog's own mount/unmount lifecycle — see that
 * hook's doc comment. One of these mounts per row while its own version's
 * delete is pending, so each gets its own independent hook instance.
 */
function VersionDeleteConfirm({
  versionId,
  sequence,
  onDelete,
  onCancel,
}: {
  versionId: number;
  sequence: number;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const titleId = `version-delete-confirm-title-${versionId}`;
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onCancel);
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="alertdialog"
      aria-labelledby={titleId}
      className="version-delete-confirm"
    >
      <h5 id={titleId}>Delete version {sequence}?</h5>
      <p>This removes it from history. This cannot be undone from here.</p>
      <button type="button" onClick={onDelete}>
        Delete version
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

type VersionHistoryPanelProps = {
  projectId: string;
  project: Project | null;
  persistedVersion: SceneVersion | null;
  isDirty: boolean;
  onRestored: (version: SceneVersion) => void;
};

/**
 * Task 41: the immutable version-history view — inspect, restore, and
 * soft-delete, all going through the Task 14/15 APIs via
 * `useVersionHistory`. Deliberately separate from Task 42-44's
 * crash-recovery draft UI (autosave, recovery prompt) — this panel only
 * ever acts on an explicit user action (Restore / Delete), never saves
 * anything automatically.
 *
 * Issue #95 follow-up ("Maybe there needs to be a Save button as well"):
 * the explicit Save action itself moved out of this panel and into the
 * editor header (`SaveControl.tsx`, next to Publish) so it's reachable
 * without ever opening this section — this panel's own `useVersionHistory`
 * instance therefore no longer needs `save`/`saveState` at all; the
 * header's `SaveControl` owns its own separate instance for that (see its
 * doc comment on why a second instance, rather than a lifted/shared one,
 * is the simpler and cheaper choice here).
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
  isDirty,
  onRestored,
}: VersionHistoryPanelProps) {
  const {
    historyLoadState,
    historyError,
    versions,
    reloadHistory,
    restore,
    restoreState,
    remove,
    deleteState,
  } = useVersionHistory(projectId, true);

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const currentVersionId = project?.current_version ?? null;

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
      <h4>Version history</h4>

      <p role="status" aria-live="polite" data-testid="working-state-status">
        {isDirty
          ? 'Unsaved changes'
          : `Saved${persistedVersion ? ` as version ${persistedVersion.sequence}` : ''}`}
      </p>

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
          Try reloading the page, or use the Save button in the header to create the first version.
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
                  <VersionDeleteConfirm
                    versionId={version.id}
                    sequence={version.sequence}
                    onDelete={() => handleConfirmDelete(version.id)}
                    onCancel={() => setPendingDeleteId(null)}
                  />
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

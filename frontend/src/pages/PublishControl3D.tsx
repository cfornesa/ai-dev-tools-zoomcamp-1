import { useState, type Dispatch, type SetStateAction } from 'react';

import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import { ApiError } from '../api/client';
import { publishProject3D, unpublishProject3D, type Project3D } from '../api/projects3d';

/**
 * Issue #296: the Project3D counterpart of `PublishControl.tsx`, scoped
 * down to match Project3D's actually-simpler data model:
 *
 * - No `persistPendingDetails`/title-description auto-save step --
 *   Project3D has no Details-panel/title-rename UI anywhere today (a
 *   separate, unfiled gap; see `scenes/publishing.py`'s
 *   `validate_meaningful_metadata_3d` for the same documented scope
 *   boundary on the server side), so there is nothing pending to persist
 *   before publishing.
 * - No client-side field-level pre-validation for the same reason: the
 *   only meaningful-content rule the server enforces is "has a saved
 *   version," which is already guaranteed true here (this control is
 *   only ever rendered once a project has loaded with one).
 * - Still reuses the same confirmation-dialog pattern
 *   (`useAlertDialogFocus`, WAI-ARIA alertdialog) as the 2D control.
 */
function PublishConfirmDialog3D({
  title,
  ownerName,
  onConfirm,
  onCancel,
}: {
  title: string;
  ownerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { dialogRef, onKeyDown } = useAlertDialogFocus<HTMLDivElement>(onCancel);
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="alertdialog"
      aria-labelledby="publish-3d-confirm-title"
      aria-describedby="publish-3d-confirm-description"
      className="publish-confirm-dialog"
    >
      <h4 id="publish-3d-confirm-title">Publish "{title}"?</h4>
      <p id="publish-3d-confirm-description">
        Anyone with the link will be able to view this project's title, your creator attribution (
        {ownerName || 'you'}), and its 3D scene.
      </p>
      <button type="button" onClick={onConfirm}>
        Publish
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function PublishControl3D({
  id,
  project,
  setProject,
}: {
  id: string;
  project: Project3D | null;
  setProject: Dispatch<SetStateAction<Project3D | null>>;
}) {
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishState, setPublishState] = useState<'idle' | 'publishing' | 'unpublishing'>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);

  const title = project?.title ?? '';
  const ownerName = project?.owner ?? '';
  const visibility = project?.visibility ?? 'private';

  async function handleConfirmPublish() {
    setShowPublishConfirm(false);
    setPublishState('publishing');
    setPublishError(null);
    try {
      const updated = await publishProject3D(id);
      setProject(updated);
      setPublishState('idle');
    } catch (err) {
      setPublishState('idle');
      if (err instanceof ApiError && err.status === 400) {
        setPublishError('Could not publish this project — save at least one version first.');
        return;
      }
      setPublishError('Could not publish this project. Please try again.');
    }
  }

  async function handleUnpublish() {
    setPublishState('unpublishing');
    setPublishError(null);
    try {
      const updated = await unpublishProject3D(id);
      setProject(updated);
      setPublishState('idle');
    } catch {
      setPublishState('idle');
      setPublishError('Could not unpublish this project. Please try again.');
    }
  }

  return (
    <div className="editor-publish-control">
      <p
        aria-live="polite"
        data-testid="visibility-status-3d"
        className="editor-publish-visibility"
      >
        {visibility === 'public' ? 'Public — visible to anyone.' : 'Private — only visible to you.'}
      </p>

      <span className="editor-header-break" aria-hidden="true" />

      <div className="editor-publish-action">
        {visibility === 'private' ? (
          <button
            type="button"
            className="shell-action"
            onClick={() => setShowPublishConfirm(true)}
            disabled={publishState === 'publishing'}
          >
            {publishState === 'publishing' ? 'Publishing…' : 'Publish'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleUnpublish()}
            disabled={publishState === 'unpublishing'}
          >
            {publishState === 'unpublishing' ? 'Unpublishing…' : 'Unpublish'}
          </button>
        )}

        {publishError && (
          <p role="alert" data-testid="publish-3d-error">
            {publishError}
          </p>
        )}

        {showPublishConfirm && (
          <PublishConfirmDialog3D
            title={title}
            ownerName={ownerName}
            onConfirm={() => void handleConfirmPublish()}
            onCancel={() => setShowPublishConfirm(false)}
          />
        )}
      </div>
    </div>
  );
}

export default PublishControl3D;

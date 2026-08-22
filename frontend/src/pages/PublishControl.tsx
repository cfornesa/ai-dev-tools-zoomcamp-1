import { useState, type Dispatch, type SetStateAction } from 'react';

import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import { ApiError } from '../api/client';
import {
  publishProject,
  unpublishProject,
  type Project,
  type PublishValidationErrorBody,
} from '../api/projects';
import { validateProjectMetadataForPublish, type FieldErrors } from '../validation/projectMetadata';

/**
 * Task 63 (issue #63), moved here by Task 94 (issue #94): the "publish this
 * project?" confirmation. Ported unchanged (still its own component so
 * `useAlertDialogFocus` runs exactly once per mount/unmount) from
 * `ProjectMetadataForm.tsx`, which this replaces.
 */
function PublishConfirmDialog({
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
      aria-labelledby="publish-confirm-title"
      aria-describedby="publish-confirm-description"
      className="publish-confirm-dialog"
    >
      <h4 id="publish-confirm-title">Publish "{title}"?</h4>
      <p id="publish-confirm-description">
        Anyone with the link will be able to view this project's title, your creator attribution (
        {ownerName || 'you'}), its animation, and a public preview. It will also become eligible to
        appear in the public gallery.
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

/**
 * Task 94 (issue #94): a prominent Publish/Unpublish action for the editor
 * header, next to "Exit without saving" — the previous editor header only
 * ever offered the destructive/neutral action; this is the constructive
 * one, ported from `ProjectMetadataForm.tsx`'s "Publishing" section
 * (`handlePublishClick`/`handleConfirmPublish`/`handleUnpublish`/
 * `publishState`/`publishErrors`) with no behavior changes. `EditorWorkspace.tsx`
 * gives the Publish button its own `.shell-action` emphasized styling so it
 * reads as the expected action, matching this app's existing
 * primary-button convention.
 */
function PublishControl({
  id,
  project,
  setProject,
}: {
  id: string;
  project: Project | null;
  setProject: Dispatch<SetStateAction<Project | null>>;
}) {
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishState, setPublishState] = useState<'idle' | 'publishing' | 'unpublishing'>('idle');
  const [publishErrors, setPublishErrors] = useState<FieldErrors>({});

  const title = project?.title ?? '';
  const description = project?.description ?? '';
  const ownerName = project?.owner ?? '';
  const visibility = project?.visibility ?? 'private';

  /** Task 49: field-level validation blocks even opening the confirmation
   * dialog — checked before the user ever sees the "this becomes public"
   * confirmation. */
  function handlePublishClick() {
    const errors = validateProjectMetadataForPublish({ title, description });
    if (Object.keys(errors).length > 0) {
      setPublishErrors(errors);
      return;
    }
    setPublishErrors({});
    setShowPublishConfirm(true);
  }

  async function handleConfirmPublish() {
    setShowPublishConfirm(false);
    setPublishState('publishing');
    setPublishErrors({});
    try {
      const updated = await publishProject(id);
      setProject(updated);
      setPublishState('idle');
    } catch (err) {
      setPublishState('idle');
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.body &&
        typeof err.body === 'object'
      ) {
        const body = err.body as Partial<PublishValidationErrorBody>;
        if (body.errors && typeof body.errors === 'object') {
          // The server always re-validates independently of this
          // component's own client-side pre-check — a race where the
          // saved title/description changed underneath this form is
          // surfaced the same way as a fresh validation failure, not
          // silently swallowed.
          setPublishErrors(body.errors);
          return;
        }
      }
      setPublishErrors({ form: ['Could not publish this project. Please try again.'] });
    }
  }

  async function handleUnpublish() {
    setPublishState('unpublishing');
    setPublishErrors({});
    try {
      const updated = await unpublishProject(id);
      setProject(updated);
      setPublishState('idle');
    } catch {
      setPublishState('idle');
      setPublishErrors({ form: ['Could not unpublish this project. Please try again.'] });
    }
  }

  return (
    <div className="editor-publish-control">
      <p aria-live="polite" data-testid="visibility-status">
        {visibility === 'public'
          ? 'Public — visible to anyone and eligible for the public gallery.'
          : 'Private — only visible to you.'}
      </p>

      {visibility === 'private' ? (
        <button
          type="button"
          className="shell-action"
          onClick={handlePublishClick}
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

      {publishErrors.title && (
        <p role="alert" data-testid="publish-title-error">
          {publishErrors.title.join(' ')}
        </p>
      )}
      {publishErrors.description && (
        <p role="alert" data-testid="publish-description-error">
          {publishErrors.description.join(' ')}
        </p>
      )}
      {publishErrors.form && (
        <p role="alert" data-testid="publish-form-error">
          {publishErrors.form.join(' ')}
        </p>
      )}

      {showPublishConfirm && (
        <PublishConfirmDialog
          title={title}
          ownerName={ownerName}
          onConfirm={() => void handleConfirmPublish()}
          onCancel={() => setShowPublishConfirm(false)}
        />
      )}
    </div>
  );
}

export default PublishControl;

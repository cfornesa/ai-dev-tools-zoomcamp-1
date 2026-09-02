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
import StageControlsPopover from '../components/StageControlsPopover';
import type { PersistDetailsResult } from './EditorDetailsPanel';

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
 *
 * Issue #128: `handlePublishClick` used to validate `project.title`/
 * `project.description` directly — stale if the user had just typed into
 * the Details panel's description field without clicking its separate
 * "Save changes" button. It now first calls `persistPendingDetails` (owned
 * by `EditorWorkspace.tsx`, backed by `EditorDetailsPanel`'s imperative
 * handle), which PATCHes whatever's currently pending there (or no-ops if
 * nothing changed since the last save), merges the result into `project`,
 * and only then runs `validateProjectMetadataForPublish` against the fresh
 * values — "auto-persist, then validate/publish," per the groomed task doc.
 * A persist failure (client-side/400 field errors, or a network/5xx error)
 * blocks the confirmation dialog the same way a validation failure always
 * has, leaves every typed value untouched, and is retryable by clicking
 * Publish again.
 */
function PublishControl({
  id,
  project,
  setProject,
  persistPendingDetails,
  compact = false,
}: {
  id: string;
  project: Project | null;
  setProject: Dispatch<SetStateAction<Project | null>>;
  persistPendingDetails: () => Promise<PersistDetailsResult>;
  compact?: boolean;
}) {
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishState, setPublishState] = useState<'idle' | 'publishing' | 'unpublishing'>('idle');
  const [publishErrors, setPublishErrors] = useState<FieldErrors>({});

  const title = project?.title ?? '';
  const ownerName = project?.owner ?? '';
  const visibility = project?.visibility ?? 'private';

  /** Task 49, extended by issue #128: field-level validation blocks even
   * opening the confirmation dialog — checked before the user ever sees
   * the "this becomes public" confirmation. Now runs against freshly
   * auto-persisted values (see the component doc comment above) instead of
   * `project` as it stood before this click. */
  async function handlePublishClick() {
    setPublishState('publishing');
    setPublishErrors({});

    const persistResult = await persistPendingDetails();
    if (persistResult.status === 'client-error') {
      setPublishState('idle');
      setPublishErrors({
        form: [
          "Could not save your details before publishing — check the Details panel's errors, fix them, and try again.",
        ],
      });
      return;
    }
    if (persistResult.status === 'server-error') {
      setPublishState('idle');
      setPublishErrors({
        form: ['Could not save your details before publishing. Please try again.'],
      });
      return;
    }

    const latestProject = persistResult.status === 'success' ? persistResult.project : project;
    const errors = validateProjectMetadataForPublish({
      title: latestProject?.title ?? '',
      description: latestProject?.description ?? '',
    });
    setPublishState('idle');
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

  const statusLabel = visibility === 'public' ? 'Published' : 'Draft';
  const statusMessage =
    visibility === 'public'
      ? 'Published (public) — visible to anyone and eligible for the public gallery.'
      : 'Draft (private) — only visible to you.';

  const publicationPanel = (
    <>
      <p aria-live="polite" data-testid="visibility-status" className="editor-publish-visibility">
        {statusMessage}
      </p>
      <div className="publish-visibility-switch" role="group" aria-label="Publication status">
        <button
          type="button"
          className="publish-visibility-option"
          aria-pressed={visibility === 'private'}
          disabled={visibility === 'private' || publishState !== 'idle'}
          onClick={() => void handleUnpublish()}
        >
          Draft
        </button>
        <button
          type="button"
          className="publish-visibility-option"
          aria-pressed={visibility === 'public'}
          disabled={visibility === 'public' || publishState !== 'idle'}
          onClick={() => void handlePublishClick()}
        >
          Published
        </button>
      </div>
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
    </>
  );

  if (compact) {
    return (
      <StageControlsPopover label={`Publication status: ${statusLabel}`}>
        {publicationPanel}
      </StageControlsPopover>
    );
  }

  return (
    // Issue #95, point 3: `.editor-publish-control` renders as `display:
    // contents` (see index.css) so its two children below — the visibility
    // line and the Publish/Unpublish action — become direct flex items of
    // `.editor-workspace-header`, landing in separate rows at mobile/tablet
    // widths and side by side with the save-status text at desktop widths,
    // per that issue's header breakpoint rules.
    <div className="editor-publish-control">
      <p aria-live="polite" data-testid="visibility-status" className="editor-publish-visibility">
        {statusMessage}
      </p>

      <span className="editor-header-break" aria-hidden="true" />

      <div className="editor-publish-action">
        {visibility === 'private' ? (
          <button
            type="button"
            className="shell-action"
            onClick={() => void handlePublishClick()}
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
      <div className="publish-visibility-switch" role="group" aria-label="Publication status">
        <button
          type="button"
          className="publish-visibility-option"
          aria-pressed={visibility === 'private'}
          disabled={visibility === 'private' || publishState !== 'idle'}
          onClick={() => void handleUnpublish()}
        >
          Draft
        </button>
        <button
          type="button"
          className="publish-visibility-option"
          aria-pressed={visibility === 'public'}
          disabled={visibility === 'public' || publishState !== 'idle'}
          onClick={() => void handlePublishClick()}
        >
          Published
        </button>
      </div>
    </div>
  );
}

export default PublishControl;

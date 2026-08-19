import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAlertDialogFocus } from '../a11y/useAlertDialogFocus';
import { ApiError } from '../api/client';
import {
  getProject,
  publishProject,
  unpublishProject,
  updateProjectMetadata,
  type Project,
  type PublishValidationErrorBody,
  type Visibility,
} from '../api/projects';
import {
  validateProjectMetadataForPrivateSave,
  validateProjectMetadataForPublish,
  type FieldErrors,
} from '../validation/projectMetadata';

type LoadState = 'loading' | 'not-found' | 'error' | 'ready';

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Task 63 (issue #63): the "publish this project?" confirmation, split into
 * its own component for the same reason `VersionHistoryPanel.tsx`'s
 * `VersionDeleteConfirm` is — `useAlertDialogFocus` (focus-into-dialog on
 * open, Escape maps to Cancel rather than Publish, focus returns to the
 * trigger on close) needs to run exactly once per mount/unmount of the
 * dialog itself, matching every other `alertdialog` in this app
 * (`EditorWorkspace.tsx`, `BehaviorCardsPanel.tsx`, `VersionHistoryPanel.tsx`,
 * `DraftRecoveryPrompt.tsx`). Before this fix, this was the one
 * `alertdialog` in the codebase that never moved focus, never closed on
 * Escape, and never restored focus to the Publish button that opened it.
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

function ProjectMetadataForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>('loading');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [ownerName, setOwnerName] = useState('');
  const [allowRemix, setAllowRemix] = useState(false);
  const [thumbnailChoice, setThumbnailChoice] = useState('auto');
  const [exportAttribution, setExportAttribution] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Task 49: publish/unpublish is a separate action from the metadata
  // PATCH above — see `scenes/serializers.py`'s `ProjectMetadataSerializer`
  // docstring for why `visibility` is no longer settable through it.
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishState, setPublishState] = useState<'idle' | 'publishing' | 'unpublishing'>('idle');
  const [publishErrors, setPublishErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadState('loading');

    getProject(id)
      .then((data: Project) => {
        if (cancelled) return;
        setTitle(data.title);
        setDescription(data.description);
        setTags(data.tags.join(', '));
        setVisibility(data.visibility);
        setOwnerName(data.owner);
        setAllowRemix(data.allow_public_remix);
        setThumbnailChoice(data.thumbnail_choice);
        setExportAttribution(data.export_attribution);
        setLoadState('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // A non-owner (or anonymous caller) gets exactly the same 404 the
        // API returns for a nonexistent project — the form never renders,
        // so there's nothing to view or submit either way (Task 17).
        setLoadState(err instanceof ApiError && err.status === 404 ? 'not-found' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;

    const tagList = parseTags(tags);
    const clientErrors = validateProjectMetadataForPrivateSave({ title, tags: tagList });
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setSaveState('saving');
    setFieldErrors({});
    try {
      await updateProjectMetadata(id, {
        title,
        description,
        tags: tagList,
        allow_public_remix: allowRemix,
        thumbnail_choice: thumbnailChoice,
        export_attribution: exportAttribution,
      });
      setSaveState('saved');
    } catch (err) {
      setSaveState('idle');
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.body &&
        typeof err.body === 'object'
      ) {
        setFieldErrors(err.body as FieldErrors);
      } else {
        setFieldErrors({ form: ['Could not save changes. Please try again.'] });
      }
    }
  }

  /** Task 49: field-level validation blocks even opening the confirmation
   * dialog — "Publishing is blocked with field-level errors until title
   * and description meet documented meaningful-content rules" is checked
   * before the user ever sees the "this becomes public" confirmation. */
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
    if (!id) return;
    setShowPublishConfirm(false);
    setPublishState('publishing');
    setPublishErrors({});
    try {
      const updated = await publishProject(id);
      setVisibility(updated.visibility);
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
          // The server always re-validates independently of this form's
          // own client-side pre-check (Task 6/14's "validate again on the
          // server" policy) — a race where the saved title/description
          // changed underneath this form is surfaced the same way as a
          // fresh validation failure, not silently swallowed.
          setPublishErrors(body.errors);
          return;
        }
      }
      setPublishErrors({ form: ['Could not publish this project. Please try again.'] });
    }
  }

  async function handleUnpublish() {
    if (!id) return;
    setPublishState('unpublishing');
    setPublishErrors({});
    try {
      const updated = await unpublishProject(id);
      setVisibility(updated.visibility);
      setPublishState('idle');
    } catch {
      setPublishState('idle');
      setPublishErrors({ form: ['Could not unpublish this project. Please try again.'] });
    }
  }

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading project…
      </p>
    );
  }
  if (loadState === 'not-found') {
    return (
      <p role="alert" aria-live="assertive">
        Project not found.
      </p>
    );
  }
  if (loadState === 'error') {
    return (
      <p role="alert" aria-live="assertive">
        Could not load this project. Please try again.
      </p>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <h2>Edit project details</h2>

        <div>
          <label htmlFor="project-title">Title</label>
          <input
            id="project-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={fieldErrors.title ? true : undefined}
            aria-describedby={fieldErrors.title ? 'project-title-error' : undefined}
          />
          {fieldErrors.title && (
            <p id="project-title-error" role="alert">
              {fieldErrors.title.join(' ')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="project-description">Description</label>
          <textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={fieldErrors.description ? true : undefined}
            aria-describedby={fieldErrors.description ? 'project-description-error' : undefined}
          />
          {fieldErrors.description && (
            <p id="project-description-error" role="alert">
              {fieldErrors.description.join(' ')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="project-tags">Tags (comma-separated)</label>
          <input
            id="project-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            aria-invalid={fieldErrors.tags ? true : undefined}
            aria-describedby={fieldErrors.tags ? 'project-tags-error' : undefined}
          />
          {fieldErrors.tags && (
            <p id="project-tags-error" role="alert">
              {fieldErrors.tags.join(' ')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="project-remix">
            <input
              id="project-remix"
              type="checkbox"
              checked={allowRemix}
              onChange={(e) => setAllowRemix(e.target.checked)}
            />
            Allow other users to remix this project when public
          </label>
        </div>

        <div>
          <label htmlFor="project-thumbnail">Thumbnail</label>
          <select
            id="project-thumbnail"
            value={thumbnailChoice}
            onChange={(e) => setThumbnailChoice(e.target.value)}
          >
            <option value="auto">Automatic</option>
            <option value="first-shape">First shape</option>
            <option value="solid-color">Solid color</option>
          </select>
        </div>

        <div>
          <label htmlFor="project-attribution">
            <input
              id="project-attribution"
              type="checkbox"
              checked={exportAttribution}
              onChange={(e) => setExportAttribution(e.target.checked)}
            />
            Include "Created with" attribution in exports
          </label>
        </div>

        {fieldErrors.form && (
          <p role="alert" aria-live="assertive">
            {fieldErrors.form.join(' ')}
          </p>
        )}

        <button type="submit" disabled={saveState === 'saving'}>
          {saveState === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {saveState === 'saved' && (
          <p role="status" aria-live="polite">
            Saved.
          </p>
        )}

        <button type="button" onClick={() => navigate(`/projects/${id}`)}>
          Back to editor
        </button>
      </form>

      <section className="publish-panel" aria-labelledby="publish-heading">
        <h3 id="publish-heading">Publishing</h3>

        <p aria-live="polite" data-testid="visibility-status">
          {visibility === 'public'
            ? 'Public — visible to anyone and eligible for the public gallery.'
            : 'Private — only visible to you.'}
        </p>

        {visibility === 'private' ? (
          <button
            type="button"
            onClick={handlePublishClick}
            disabled={publishState === 'publishing'}
          >
            {publishState === 'publishing' ? 'Publishing…' : 'Publish'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleUnpublish}
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
            onConfirm={handleConfirmPublish}
            onCancel={() => setShowPublishConfirm(false)}
          />
        )}
      </section>
    </>
  );
}

export default ProjectMetadataForm;

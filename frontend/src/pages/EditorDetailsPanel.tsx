import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';

import { ApiError } from '../api/client';
import { updateProjectMetadata, type Project } from '../api/projects';
import {
  validateProjectMetadataForPrivateSave,
  type FieldErrors,
} from '../validation/projectMetadata';

export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** The panel's four editable fields, parsed to the shape the metadata PATCH
 * (and publish-time validation) expects — used by issue #128's
 * `getPendingDetails()` below so a caller outside this component (`Publish`)
 * can read what's currently typed without waiting for "Save changes". */
export type PendingDetails = {
  description: string;
  tags: string[];
  allowRemix: boolean;
  exportAttribution: boolean;
};

/**
 * Issue #128: the result of a persist attempt, whether triggered by this
 * panel's own "Save changes" button or, via `save()` on the imperative
 * handle below, by `PublishControl`'s auto-persist-then-publish flow. A
 * `client-error` means `fieldErrors` now holds either the client-side tag
 * validation or a 400 response's field errors (already rendered by this
 * panel); a `server-error` means a network/5xx failure (`fieldErrors.form`
 * holds a generic retry message). Either way, the user's typed values are
 * left completely untouched — only `fieldErrors`/`saveState` change.
 */
export type PersistDetailsResult =
  | { status: 'success'; project: Project }
  | { status: 'client-error' }
  | { status: 'server-error' }
  /** Only ever produced by `EditorWorkspace.tsx`'s `persistPendingDetails`
   * wrapper (never by `save()` above) when the panel's current field
   * values already match `project`'s last-saved ones — the "concurrent
   * edit safety" acceptance criterion: no redundant PATCH before
   * publish-time validation. */
  | { status: 'skipped' };

export type EditorDetailsPanelHandle = {
  /** The current, possibly-unsaved field values, parsed the same way
   * `handleSubmit` parses them before PATCHing — read by `PublishControl`
   * (via `EditorWorkspace.tsx`) to decide whether there's anything pending
   * to persist before publishing. */
  getPendingDetails: () => PendingDetails;
  /** Runs the exact same persist path `handleSubmit` below runs — same
   * client-side validation, same PATCH, same `fieldErrors`/`saveState`
   * side effects — so a Publish-triggered auto-save is indistinguishable
   * from the user having clicked "Save changes" themselves. */
  save: () => Promise<PersistDetailsResult>;
};

/**
 * Task 94 (issue #94): the "Details" editor panel — description, tags,
 * allow-remix, and export-attribution, folded in from the old standalone
 * `/projects/:id/settings` page (`ProjectMetadataForm.tsx`, now deleted).
 * Reuses the exact same `updateProjectMetadata` API call and
 * `validateProjectMetadataForPrivateSave` client-side validation that page
 * used. Title editing lives inline in the editor header instead (see
 * `EditableProjectTitle` in `EditorWorkspace.tsx`), and publish/unpublish
 * moved to a prominent header action (`PublishControl.tsx`) — neither is
 * duplicated here. `thumbnail_choice` is gone entirely (issue #94 point 5):
 * a project's thumbnail is always an auto-generated still of its current
 * version, with no manual choice to render a control for.
 *
 * Local field state is seeded from `project` only when the project's `id`
 * changes (i.e. once, when this project first loads) — not on every
 * `project` update — so an unrelated save elsewhere (e.g. the inline title
 * edit or a publish/unpublish) never clobbers an in-progress edit here.
 *
 * Issue #128: this panel's local field state used to be reachable only from
 * its own "Save changes" button, so clicking the header's Publish button
 * right after typing a description (without an intervening explicit save)
 * published against stale `project.description` and silently dropped the
 * typed value. `EditorWorkspace.tsx` now holds a ref to this component and
 * calls `getPendingDetails()`/`save()` on it before publishing (see
 * `PublishControl.tsx`'s `handlePublishClick`) — the "shared-state
 * mechanism" the issue's grooming doc allows as an alternative to fully
 * lifting this state, chosen here so the existing "Save changes" behavior
 * (and its test coverage) stays byte-for-byte unchanged.
 */
const EditorDetailsPanel = forwardRef<
  EditorDetailsPanelHandle,
  {
    projectId: string;
    project: Project | null;
    setProject: Dispatch<SetStateAction<Project | null>>;
  }
>(function EditorDetailsPanel({ projectId, project, setProject }, ref) {
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [allowRemix, setAllowRemix] = useState(false);
  const [exportAttribution, setExportAttribution] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (!project) return;
    setDescription(project.description);
    setTags(project.tags.join(', '));
    setAllowRemix(project.allow_public_remix);
    setExportAttribution(project.export_attribution);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  async function persist(): Promise<PersistDetailsResult> {
    const tagList = parseTags(tags);
    const clientErrors = validateProjectMetadataForPrivateSave({ tags: tagList });
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return { status: 'client-error' };
    }

    setSaveState('saving');
    setFieldErrors({});
    try {
      const updated = await updateProjectMetadata(projectId, {
        description,
        tags: tagList,
        allow_public_remix: allowRemix,
        export_attribution: exportAttribution,
      });
      setProject(updated);
      setSaveState('saved');
      return { status: 'success', project: updated };
    } catch (err) {
      setSaveState('idle');
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.body &&
        typeof err.body === 'object'
      ) {
        setFieldErrors(err.body as FieldErrors);
        return { status: 'client-error' };
      }
      setFieldErrors({ form: ['Could not save changes. Please try again.'] });
      return { status: 'server-error' };
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await persist();
  }

  useImperativeHandle(
    ref,
    () => ({
      getPendingDetails: () => ({
        description,
        tags: parseTags(tags),
        allowRemix,
        exportAttribution,
      }),
      save: persist,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [description, tags, allowRemix, exportAttribution, projectId],
  );

  return (
    <form className="editor-details-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
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
    </form>
  );
});

export default EditorDetailsPanel;

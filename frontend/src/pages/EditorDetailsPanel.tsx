import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';

import { ApiError } from '../api/client';
import { updateProjectMetadata, type Project } from '../api/projects';
import {
  validateProjectMetadataForPrivateSave,
  type FieldErrors,
} from '../validation/projectMetadata';

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

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
 */
function EditorDetailsPanel({
  projectId,
  project,
  setProject,
}: {
  projectId: string;
  project: Project | null;
  setProject: Dispatch<SetStateAction<Project | null>>;
}) {
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const tagList = parseTags(tags);
    const clientErrors = validateProjectMetadataForPrivateSave({ tags: tagList });
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
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

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate>
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
}

export default EditorDetailsPanel;

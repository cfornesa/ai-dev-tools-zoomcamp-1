import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getProject, updateProjectMetadata, type Project, type Visibility } from '../api/projects';
import {
  validateProjectMetadataForPrivateSave,
  type FieldErrors,
} from '../validation/projectMetadata';

type LoadState = 'loading' | 'not-found' | 'error' | 'ready';

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function ProjectMetadataForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>('loading');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [allowRemix, setAllowRemix] = useState(false);
  const [thumbnailChoice, setThumbnailChoice] = useState('auto');
  const [exportAttribution, setExportAttribution] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

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
        visibility,
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
        <label htmlFor="project-visibility">Visibility</label>
        <select
          id="project-visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as Visibility)}
        >
          <option value="private">Private</option>
          <option value="public">Public</option>
        </select>
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
  );
}

export default ProjectMetadataForm;

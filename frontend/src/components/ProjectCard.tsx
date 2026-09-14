import { useState } from 'react';
import { Link } from 'react-router-dom';

import { deleteProject, getSceneVersion, type Project } from '../api/projects';
import { saveNowBeforeClearing } from '../storage/cloudSnapshot';
import { originLabel } from './originLabel';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Issue #135: "Your projects" cards had no thumbnail at all even though
 * `Project` already carries `thumbnail_url` — `PublicProjectCard.tsx` gained
 * the same image/fallback pattern under issue #54 but this card was never
 * updated to match. Reuses that same fallback-on-null-or-error approach.
 */
function ProjectCard({
  project,
  onDeleted,
}: {
  project: Project;
  onDeleted: (id: string) => void;
}) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const titleId = `project-${project.id}-title`;
  const showFallback = !project.thumbnail_url || thumbnailFailed;
  const originBadge = originLabel(project.current_version_origin);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Issue #252: mirrors Project3DCard.tsx's delete pattern (added for
  // #242) exactly -- window.confirm is this codebase's existing
  // destructive-action confirmation pattern.
  //
  // Issue #527: before actually deleting a project explicitly opted into
  // cloud sync, attempt one bounded "Save now" checkpoint of its current
  // saved content -- a scheduled snapshot may not have run yet, so the
  // cloud copy could be behind. A project never opted into cloud sync (or
  // with no saved version yet) skips this entirely and deletes directly,
  // same as before. A failed checkpoint never silently proceeds -- it
  // asks for an explicit "delete anyway" confirmation naming why the
  // checkpoint failed, and declining leaves the project untouched.
  async function handleDelete() {
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone from the gallery.`)) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);

    if (project.current_version) {
      try {
        const version = await getSceneVersion(project.id, project.current_version);
        const result = await saveNowBeforeClearing(project.id, version.scene_json);
        if (result.applicable && !result.success) {
          const proceedAnyway = window.confirm(
            `${result.failure.message} Delete "${project.title}" anyway? Any changes not already in the cloud copy may be lost.`,
          );
          if (!proceedAnyway) {
            setDeleting(false);
            return;
          }
        }
      } catch {
        // Couldn't even determine cloud-sync status/content -- treat the
        // same as a failed checkpoint rather than silently deleting.
        const proceedAnyway = window.confirm(
          `Could not check this project's cloud backup status. Delete "${project.title}" anyway? Any changes not already in the cloud copy may be lost.`,
        );
        if (!proceedAnyway) {
          setDeleting(false);
          return;
        }
      }
    }

    try {
      await deleteProject(project.id);
      onDeleted(project.id);
    } catch {
      setDeleteError('Could not delete this project. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <article aria-labelledby={titleId} className="project-card">
      {showFallback ? (
        <div
          className="project-card-thumbnail-fallback"
          role="img"
          aria-label={`No preview available for ${project.title}`}
        >
          No preview available
        </div>
      ) : (
        <img
          src={project.thumbnail_url ?? undefined}
          alt={`Preview of ${project.title}`}
          className="project-card-thumbnail"
          onError={() => setThumbnailFailed(true)}
        />
      )}
      <h3 id={titleId}>{project.title}</h3>
      <p>
        <span className="visibility-badge">
          {project.visibility === 'public' ? 'Public' : 'Private'}
        </span>
        {originBadge && <span className="origin-badge">{originBadge}</span>}
      </p>
      <p>Last updated {formatDate(project.updated_at)}</p>
      <p>
        {/* Task 94 (issue #94): a single "Edit" action replaces the old
            "Open in editor"/"Edit details" pair — project-metadata editing
            now lives inside the editor itself (its "Details" panel), so
            there's only one place to go. Styled as a button (`.shell-action`,
            the same prominent treatment `Layout.tsx`'s Home/Account
            settings navigation already uses) rather than a plain inline
            text link, since it's the card's primary action. */}
        <Link className="shell-action" to={`/projects/${project.id}`}>
          Edit
        </Link>{' '}
        <button type="button" className="shell-action" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </p>
      {deleteError && (
        <p role="alert" aria-live="assertive">
          {deleteError}
        </p>
      )}
    </article>
  );
}

export default ProjectCard;

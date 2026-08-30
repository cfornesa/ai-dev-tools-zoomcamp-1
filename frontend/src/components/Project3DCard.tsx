import { useState } from 'react';
import { Link } from 'react-router-dom';

import { deleteProject3D, type Project3D } from '../api/projects3d';
import { originLabel } from './originLabel';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Gallery gap found live in production while verifying #238's fix: 3D
 * projects could be created but never appeared anywhere in the gallery
 * afterward (Gallery.tsx only ever fetched the 2D Project list). This is
 * the 3D counterpart to `ProjectCard.tsx` -- not a reuse of it directly,
 * since `Project3D` has no `thumbnail_url`/`visibility` fields yet (issue
 * #212 deferred that metadata), so it always shows the same
 * no-preview-available fallback `ProjectCard` uses when a 2D project has
 * no thumbnail.
 */
function Project3DCard({
  project,
  onDeleted,
}: {
  project: Project3D;
  onDeleted: (id: string) => void;
}) {
  const titleId = `project3d-${project.id}-title`;
  // Project3D.current_version is already the full nested version (unlike
  // 2D Project, whose list endpoint only exposes a bare id -- see
  // ProjectSerializer's current_version_origin field for that side), so
  // no extra API field was needed here.
  const originBadge = originLabel(project.current_version?.origin);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Issue #242: Project3D had no delete capability at all (API or UI) --
  // window.confirm is this codebase's existing destructive-action
  // confirmation pattern (GraphView.tsx's "Remove this connection?"); there
  // is no pre-existing 2D project-level delete UI to mirror instead (only
  // `deleteSceneVersion` exists on the 2D side, a different resource).
  async function handleDelete() {
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone from the gallery.`)) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProject3D(project.id);
      onDeleted(project.id);
    } catch {
      setDeleteError('Could not delete this project. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <article aria-labelledby={titleId} className="project-card">
      <div
        className="project-card-thumbnail-fallback"
        role="img"
        aria-label={`No preview available for ${project.title}`}
      >
        No preview available
      </div>
      <h3 id={titleId}>{project.title}</h3>
      {originBadge && (
        <p>
          <span className="origin-badge">{originBadge}</span>
        </p>
      )}
      <p>Last updated {formatDate(project.updated_at)}</p>
      <p>
        <Link className="shell-action" to={`/projects3d/${project.id}`}>
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

export default Project3DCard;

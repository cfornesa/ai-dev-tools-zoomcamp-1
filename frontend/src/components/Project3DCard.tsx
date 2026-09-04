import { useState } from 'react';
import { Link } from 'react-router-dom';

import { deleteProject3D, getProject3D, type Project3D } from '../api/projects3d';
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
 * since `Project3D` has no `visibility` field yet (issue #212 deferred
 * that metadata). Issue #243 added `thumbnail_url`, so this card now
 * mirrors `ProjectCard.tsx`'s image/fallback-on-null-or-error pattern
 * instead of always showing the static fallback.
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
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [thumbnailIsFallback, setThumbnailIsFallback] = useState(
    project.thumbnail_is_fallback ?? false,
  );
  const [thumbnailRetrying, setThumbnailRetrying] = useState(false);
  const [thumbnailRetry, setThumbnailRetry] = useState(0);
  const showFallback = !project.thumbnail_url || thumbnailFailed || thumbnailIsFallback;

  async function handleThumbnailRetry() {
    if (!project.thumbnail_url || thumbnailRetrying) return;
    setThumbnailRetrying(true);
    try {
      const refreshed = await getProject3D(project.id);
      setThumbnailIsFallback(refreshed.thumbnail_is_fallback ?? false);
      setThumbnailFailed(false);
      setThumbnailRetry((current) => current + 1);
    } finally {
      setThumbnailRetrying(false);
    }
  }

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
      {showFallback ? (
        <div className="project-card-thumbnail-fallback project-card-thumbnail-fallback-3d">
          <span role="img" aria-label={`No preview available for ${project.title}`}>
            No preview available
          </span>
          {project.thumbnail_url && (
            <button type="button" onClick={handleThumbnailRetry} disabled={thumbnailRetrying}>
              {thumbnailRetrying ? 'Retrying…' : 'Retry thumbnail'}
            </button>
          )}
        </div>
      ) : (
        <img
          src={project.thumbnail_url ?? undefined}
          alt={`Preview of ${project.title}`}
          className="project-card-thumbnail project-card-thumbnail-3d"
          key={`${project.thumbnail_url}-${thumbnailRetry}`}
          onError={() => setThumbnailFailed(true)}
        />
      )}
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

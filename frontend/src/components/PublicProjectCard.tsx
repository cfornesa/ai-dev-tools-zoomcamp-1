import { useState } from 'react';

import type { PublicGalleryProject } from '../api/projects';

/**
 * Task 50: one public-gallery card. Two independent "no real thumbnail"
 * cases both render the same accessible fallback tile:
 *
 * - `thumbnail_url` is `null` (the project has no current version to
 *   thumbnail from — shouldn't normally reach the gallery at all, but the
 *   card doesn't assume the API can never change).
 * - `thumbnail_url` is present but the image itself fails to load (a
 *   broken/expired URL, a network hiccup) — caught via the `<img>`'s
 *   `onError`, which flips local `thumbnailFailed` state rather than
 *   leaving a broken-image icon on screen.
 *
 * `remix_provenance` is a documented no-op for now (Task 53, issue #52 —
 * forking doesn't exist yet): the slot renders nothing at all when it's
 * `null`, per this task's own scope note, but the markup and the
 * null-check live here so Task 53 only has to fill in the body once real
 * provenance data exists.
 */
function PublicProjectCard({ project }: { project: PublicGalleryProject }) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const titleId = `public-project-${project.id}-title`;
  const showFallback = !project.thumbnail_url || thumbnailFailed;

  return (
    <article aria-labelledby={titleId} className="public-project-card">
      {showFallback ? (
        <div
          className="public-project-thumbnail-fallback"
          role="img"
          aria-label={`No preview available for ${project.title}`}
        >
          No preview available
        </div>
      ) : (
        <img
          src={project.thumbnail_url ?? undefined}
          alt={`Preview of ${project.title}`}
          className="public-project-thumbnail"
          onError={() => setThumbnailFailed(true)}
        />
      )}

      <h3 id={titleId}>{project.title}</h3>
      <p className="public-project-attribution">By {project.owner}</p>

      {project.remix_provenance && (
        <p className="public-project-provenance" data-testid={`provenance-${project.id}`}>
          Remixed from another project
        </p>
      )}
    </article>
  );
}

export default PublicProjectCard;

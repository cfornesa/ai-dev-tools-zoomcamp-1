import { useState } from 'react';
import { Link } from 'react-router-dom';

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
 * Task 51 (issue #53): the whole card is now a link to the public project
 * viewer at `/p/<id>` — the route Task 50 deliberately left this card not
 * pointing anywhere for (see this file's previous docstring/PublicGallery's
 * own).
 *
 * ## Remix provenance (Task 53, issue #52)
 *
 * `remix_provenance` is `null` for an original (non-remixed) project —
 * nothing renders for that case at all: no badge, no attribution line, no
 * empty element. When it's present, this card is programmatically and
 * visually distinguishable from an original:
 *
 * - `data-project-kind="remix"` (vs. `"original"`) on the `<article>`
 *   itself, so tests/tooling can assert the distinction without parsing
 *   visible text.
 * - A visible "Remix" badge (`role="status"`, its own text, not just
 *   color) next to the title.
 * - A "Remixed from [creator]" line: a `<Link>` to `/p/<source id>` when
 *   `source_public_id` is present (the source is still public), or the
 *   same wording as plain unlinked text when it's `null` (source went
 *   private/unpublished/deleted — attribution stays, without a broken or
 *   privacy-leaking link). `source_creator` is always present per
 *   `RemixProvenance`'s own docstring (`api/projects.ts`).
 */
function PublicProjectCard({ project }: { project: PublicGalleryProject }) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const titleId = `public-project-${project.id}-title`;
  const showFallback = !project.thumbnail_url || thumbnailFailed;
  const provenance = project.remix_provenance;
  const viewerPath = project.renderer === '3d' ? `/p3d/${project.id}` : `/p/${project.id}`;
  const rendererLabel = project.renderer === '3d' ? '3D' : '2D';

  return (
    <article
      aria-labelledby={titleId}
      className="public-project-card"
      data-project-kind={provenance ? 'remix' : 'original'}
    >
      <Link to={viewerPath} className="public-project-card-link">
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
        <span className="renderer-badge">{rendererLabel}</span>
        {provenance && (
          <span className="remix-badge" role="status" aria-label="Remix">
            Remix
          </span>
        )}
      </Link>
      <p className="public-project-attribution">By {project.owner}</p>

      {provenance &&
        (provenance.source_public_id ? (
          <p className="public-project-provenance" data-testid={`provenance-${project.id}`}>
            Remixed from{' '}
            <Link to={`/p/${provenance.source_public_id}`}>{provenance.source_creator}</Link>
          </p>
        ) : (
          <p className="public-project-provenance" data-testid={`provenance-${project.id}`}>
            Remixed from {provenance.source_creator}
          </p>
        ))}
    </article>
  );
}

export default PublicProjectCard;

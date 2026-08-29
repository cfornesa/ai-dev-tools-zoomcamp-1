import { useState } from 'react';
import { Link } from 'react-router-dom';

import type { Project } from '../api/projects';
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
function ProjectCard({ project }: { project: Project }) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const titleId = `project-${project.id}-title`;
  const showFallback = !project.thumbnail_url || thumbnailFailed;
  const originBadge = originLabel(project.current_version_origin);

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
        </Link>
      </p>
    </article>
  );
}

export default ProjectCard;

import { Link } from 'react-router-dom';

import type { Project } from '../api/projects';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ProjectCard({ project }: { project: Project }) {
  const titleId = `project-${project.id}-title`;

  return (
    <article aria-labelledby={titleId} className="project-card">
      <h3 id={titleId}>{project.title}</h3>
      <p>
        <span className="visibility-badge">
          {project.visibility === 'public' ? 'Public' : 'Private'}
        </span>
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

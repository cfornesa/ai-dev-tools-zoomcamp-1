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
        <Link to={`/projects/${project.id}`}>Open in editor</Link>
      </p>
      <p>
        <Link to={`/projects/${project.id}/settings`}>Edit details</Link>
      </p>
    </article>
  );
}

export default ProjectCard;

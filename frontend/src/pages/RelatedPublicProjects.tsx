import { useEffect, useState } from 'react';

import { getRelatedPublicProjects, type PublicGalleryProject } from '../api/projects';
import PublicProjectCard from '../components/PublicProjectCard';

function asGalleryCard(
  project: Awaited<ReturnType<typeof getRelatedPublicProjects>>[number],
): PublicGalleryProject {
  return {
    id: project.id,
    title: project.title,
    owner: project.owner,
    owner_handle: project.owner_handle,
    thumbnail_url: project.thumbnail_url,
    viewer_url: project.viewer_url,
    remix_provenance: null,
    published_at: project.published_at,
    renderer: '2d',
  };
}

/** Optional discovery content. It waits until the canonical project is ready,
 * has no loading placeholder, and quietly disappears for empty/error results. */
export default function RelatedPublicProjects({
  projectId,
  ready,
}: {
  projectId: string;
  ready: boolean;
}) {
  const [loaded, setLoaded] = useState<{
    projectId: string;
    projects: Awaited<ReturnType<typeof getRelatedPublicProjects>>;
  } | null>(null);

  useEffect(() => {
    if (!ready || !projectId) {
      setLoaded(null);
      return;
    }

    let cancelled = false;
    setLoaded(null);
    Promise.resolve()
      .then(() => getRelatedPublicProjects(projectId))
      .then((results) => {
        if (!cancelled) {
          setLoaded({ projectId, projects: Array.isArray(results) ? results : [] });
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded({ projectId, projects: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, ready]);

  const projects = loaded?.projectId === projectId ? loaded.projects : [];
  if (projects.length === 0) return null;

  return (
    <section className="public-related-pieces" aria-labelledby="public-related-pieces-heading">
      <h2 id="public-related-pieces-heading">More like this</h2>
      <div className="public-project-grid">
        {projects.map((project) => (
          <PublicProjectCard key={project.id} project={asGalleryCard(project)} />
        ))}
      </div>
    </section>
  );
}

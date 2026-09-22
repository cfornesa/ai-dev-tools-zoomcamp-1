import { useEffect, useState } from 'react';

import { listProjects, type Project } from '../api/projects';
import { listProjects3D, type Project3D } from '../api/projects3d';
import { useAuth } from '../auth/useAuth';
import Project3DCard from '../components/Project3DCard';
import ProjectCard from '../components/ProjectCard';
import GalleryCreateMenu from './GalleryCreateMenu';

type LoadState = 'loading' | 'error' | 'ready';
type ProjectRendererFilter = 'all' | '2d' | '3d';

function Gallery() {
  const auth = useAuth();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [projects, setProjects] = useState<Project[]>([]);
  // Gap found live in production while verifying #238's fix: 3D projects
  // could be created but never appeared anywhere afterward, because this
  // page only ever fetched the 2D `Project` list. `listProjects3D()`
  // already existed in `api/projects3d.ts` -- it was just never called
  // here.
  const [projects3D, setProjects3D] = useState<Project3D[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [projectRenderer, setProjectRenderer] = useState<ProjectRendererFilter>('all');
  // Issue #206/#207: the only point in the app where a new project's
  // renderer is chosen -- there is no later "change this scene's renderer"
  // flow.
  const [newProjectRenderer, setNewProjectRenderer] = useState<'p5' | 'canvas2d' | 'svg'>('p5');

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    Promise.all([listProjects(), listProjects3D()])
      .then(([data, data3D]) => {
        if (cancelled) return;
        setProjects(data);
        setProjects3D(data3D);
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Defense-in-depth beyond the API's own owner scoping: never render a
  // project whose owner isn't the signed-in user, even if a future bug
  // (or a compromised response) put one in the list.
  const ownProjects =
    auth.status === 'signed-in' ? projects.filter((p) => p.owner === auth.user.username) : [];
  const ownProjects3D =
    auth.status === 'signed-in' ? projects3D.filter((p) => p.owner === auth.user.username) : [];
  const filteredProjects = projectRenderer === '3d' ? [] : ownProjects;
  const filteredProjects3D = projectRenderer === '2d' ? [] : ownProjects3D;
  const hasProjects = ownProjects.length > 0 || ownProjects3D.length > 0;
  const hasFilteredProjects = filteredProjects.length > 0 || filteredProjects3D.length > 0;

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading your projects…
      </p>
    );
  }

  if (loadState === 'error') {
    return (
      <p role="alert" aria-live="assertive">
        We couldn't load your projects. Please try again.
      </p>
    );
  }

  return (
    <section className="content-panel gallery-panel" aria-labelledby="gallery-heading">
      <div className="gallery-header">
        <h2 id="gallery-heading">Your projects</h2>
        <label htmlFor="new-project-renderer" className="gallery-renderer-label">
          Renderer
        </label>
        <select
          id="new-project-renderer"
          value={newProjectRenderer}
          disabled={creating}
          onChange={(event) =>
            setNewProjectRenderer(event.target.value as 'p5' | 'canvas2d' | 'svg')
          }
        >
          <option value="p5">p5.js</option>
          <option value="canvas2d">Canvas2D</option>
          <option value="svg">SVG</option>
        </select>
        {/* Issue #268: the 4 "Create X" buttons + "Browse templates" link
            that used to live here (and that narrow-width overflow fix
            once needed for them) are replaced by a single split-button:
            the renderer select above stays put, directly to the left of
            the "+"/arrow pair, which is right-aligned in this row via the
            gallery-header container's own `justify-content: space-between`. */}
        <GalleryCreateMenu
          renderer={newProjectRenderer}
          creating={creating}
          onCreatingChange={setCreating}
          onError={setCreateError}
        />
        <label htmlFor="project-renderer-filter" className="gallery-renderer-label">
          Filter by renderer
        </label>
        <select
          id="project-renderer-filter"
          value={projectRenderer}
          onChange={(event) => setProjectRenderer(event.target.value as ProjectRendererFilter)}
        >
          <option value="all">All</option>
          <option value="2d">2D</option>
          <option value="3d">3D</option>
        </select>
      </div>

      {createError && (
        <p className="gallery-error" role="alert" aria-live="assertive">
          {createError}
        </p>
      )}

      {!hasProjects ? (
        <div className="centered-state gallery-empty-state">
          <p>You have not created any projects.</p>
          <p>Create your first animation to get started.</p>
        </div>
      ) : !hasFilteredProjects ? (
        <div className="centered-state gallery-empty-state">
          <p>No {projectRenderer.toUpperCase()} projects match this filter.</p>
        </div>
      ) : (
        <ul className="project-grid">
          {filteredProjects.map((project) => (
            <li key={`2d-${project.id}`}>
              <ProjectCard
                project={project}
                onDeleted={(id) => setProjects((current) => current.filter((p) => p.id !== id))}
              />
            </li>
          ))}
          {filteredProjects3D.map((project) => (
            <li key={`3d-${project.id}`}>
              <Project3DCard
                project={project}
                onDeleted={(id) => setProjects3D((current) => current.filter((p) => p.id !== id))}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default Gallery;

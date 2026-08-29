import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { createBlankProject, listProjects, type Project } from '../api/projects';
import { useAuth } from '../auth/useAuth';
import ProjectCard from '../components/ProjectCard';

type LoadState = 'loading' | 'error' | 'ready';

function Gallery() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  // Issue #206/#207: the only point in the app where a new project's
  // renderer is chosen -- there is no later "change this scene's renderer"
  // flow.
  const [newProjectRenderer, setNewProjectRenderer] = useState<'p5' | 'canvas2d' | 'svg'>('p5');

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    listProjects()
      .then((data) => {
        if (cancelled) return;
        setProjects(data);
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

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const requestId = crypto.randomUUID();
      const project = await createBlankProject(requestId, newProjectRenderer);
      navigate(`/projects/${project.id}`);
    } catch {
      setCreateError('Could not create a new project. Please try again.');
      setCreating(false);
    }
  }

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
        <button className="shell-action" type="button" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Create new animation'}
        </button>
        <Link className="shell-action" to="/templates">
          Browse templates
        </Link>
      </div>

      {createError && (
        <p className="gallery-error" role="alert" aria-live="assertive">
          {createError}
        </p>
      )}

      {ownProjects.length === 0 ? (
        <div className="centered-state gallery-empty-state">
          <p>You have not created any projects.</p>
          <p>Create your first animation to get started.</p>
        </div>
      ) : (
        <ul className="project-grid">
          {ownProjects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default Gallery;

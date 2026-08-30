import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { createBlankProject, listProjects, type Project } from '../api/projects';
import { createProject3D, listProjects3D, type Project3D } from '../api/projects3d';
import { useAuth } from '../auth/useAuth';
import Project3DCard from '../components/Project3DCard';
import ProjectCard from '../components/ProjectCard';

type LoadState = 'loading' | 'error' | 'ready';

function Gallery() {
  const auth = useAuth();
  const navigate = useNavigate();
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

  // Issue #223: the 2D AI-assisted editor is a distinct route over the
  // same Project/SceneVersion document family and creation endpoint as
  // the manual editor above -- only the destination route differs.
  async function handleCreateAiAssisted() {
    setCreating(true);
    setCreateError(null);
    try {
      const requestId = crypto.randomUUID();
      const project = await createBlankProject(requestId, newProjectRenderer);
      navigate(`/ai-projects/${project.id}`);
    } catch {
      setCreateError('Could not create a new project. Please try again.');
      setCreating(false);
    }
  }

  // Issue #226: creates a Project3D (a genuinely separate document family,
  // #208's decision) via the #213 creation endpoint and opens the new 3D
  // manual editor route.
  async function handleCreate3D() {
    setCreating(true);
    setCreateError(null);
    try {
      const project = await createProject3D();
      navigate(`/projects3d/${project.id}`);
    } catch {
      setCreateError('Could not create a new project. Please try again.');
      setCreating(false);
    }
  }

  // Issue #231: same Project3D creation endpoint as the 3D manual editor
  // above -- only the destination route differs.
  async function handleCreate3DAiAssisted() {
    setCreating(true);
    setCreateError(null);
    try {
      const project = await createProject3D();
      navigate(`/ai-projects3d/${project.id}`);
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
        {/* Issue: at narrow widths, four separate full-width "Create X"
            buttons (up from the original two) pushed the gallery content
            well past a single-screen-height's worth of header, discovered
            by the responsive-shell e2e suite's populated-gallery viewport
            check. Grouping them in their own two-column-at-narrow-width
            container keeps each button's own DOM position (so tab order
            is unaffected) while roughly halving this block's vertical
            footprint on a phone. */}
        <div className="gallery-create-actions">
          <button className="shell-action" type="button" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create new animation'}
          </button>
          <button
            className="shell-action"
            type="button"
            onClick={handleCreateAiAssisted}
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create AI-assisted animation'}
          </button>
          <button
            className="shell-action"
            type="button"
            onClick={handleCreate3D}
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create new 3D project'}
          </button>
          <button
            className="shell-action"
            type="button"
            onClick={handleCreate3DAiAssisted}
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create AI-assisted 3D project'}
          </button>
        </div>
        <Link className="shell-action" to="/templates">
          Browse templates
        </Link>
      </div>

      {createError && (
        <p className="gallery-error" role="alert" aria-live="assertive">
          {createError}
        </p>
      )}

      {ownProjects.length === 0 && ownProjects3D.length === 0 ? (
        <div className="centered-state gallery-empty-state">
          <p>You have not created any projects.</p>
          <p>Create your first animation to get started.</p>
        </div>
      ) : (
        <>
          {ownProjects.length > 0 && (
            <ul className="project-grid">
              {ownProjects.map((project) => (
                <li key={project.id}>
                  <ProjectCard project={project} />
                </li>
              ))}
            </ul>
          )}
          {ownProjects3D.length > 0 && (
            <>
              <h3>Your 3D projects</h3>
              <ul className="project-grid">
                {ownProjects3D.map((project) => (
                  <li key={project.id}>
                    <Project3DCard
                      project={project}
                      onDeleted={(id) =>
                        setProjects3D((current) => current.filter((p) => p.id !== id))
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

export default Gallery;

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { listProjects, type Project } from '../api/projects';
import { listProjects3D, type Project3D } from '../api/projects3d';
import { useAuth } from '../auth/useAuth';
import Project3DCard from '../components/Project3DCard';
import ProjectCard from '../components/ProjectCard';
import GalleryCreateMenu from './GalleryCreateMenu';
import {
  listProjectsForOwner,
  openLocalProjectDatabase,
  type LocalProjectRecord,
} from '../storage/localProjectRepository';
import { importLocalPiecePackage } from '../storage/localPiecePackageImport';

type LoadState = 'loading' | 'error' | 'ready';
type ProjectRendererFilter = 'all' | '2d' | '3d';

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
  const [localProjects, setLocalProjects] = useState<LocalProjectRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [projectRenderer, setProjectRenderer] = useState<ProjectRendererFilter>('all');

  async function importPiecePackage(file: File) {
    if (auth.status !== 'signed-in') {
      setCreateError('Sign in before importing a local piece package.');
      return;
    }
    try {
      const db = await openLocalProjectDatabase();
      const result = await importLocalPiecePackage(
        db,
        auth.user.username,
        new Uint8Array(await file.arrayBuffer()),
      );
      db.close();
      setLocalProjects((current) => [...current, result.project]);
      navigate(`/local-projects/${result.project.id}`);
    } catch (error) {
      setCreateError(
        `Could not import that piece package. ${error instanceof Error ? error.message : 'The selected package is invalid.'}`,
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    Promise.all([listProjects(), listProjects3D()])
      .then(async ([data, data3D]) => {
        if (cancelled) return;
        let local: LocalProjectRecord[] = [];
        if (auth.status === 'signed-in') {
          try {
            const db = await openLocalProjectDatabase();
            local = await listProjectsForOwner(db, auth.user.username);
            db.close();
          } catch {
            // A local storage failure must not hide server-backed projects.
          }
        }
        setProjects(data);
        setProjects3D(data3D);
        setLocalProjects(local);
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  // Defense-in-depth beyond the API's own owner scoping: never render a
  // project whose owner isn't the signed-in user, even if a future bug
  // (or a compromised response) put one in the list.
  const ownProjects =
    auth.status === 'signed-in' ? projects.filter((p) => p.owner === auth.user.username) : [];
  const ownProjects3D =
    auth.status === 'signed-in' ? projects3D.filter((p) => p.owner === auth.user.username) : [];
  const filteredProjects = projectRenderer === '3d' ? [] : ownProjects;
  const filteredProjects3D = projectRenderer === '2d' ? [] : ownProjects3D;
  const filteredLocalProjects = projectRenderer === '3d' ? [] : localProjects;
  const hasProjects =
    ownProjects.length > 0 || ownProjects3D.length > 0 || localProjects.length > 0;
  const hasFilteredProjects =
    filteredProjects.length > 0 ||
    filteredProjects3D.length > 0 ||
    filteredLocalProjects.length > 0;

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
        <label htmlFor="project-renderer-filter" className="gallery-renderer-label">
          Renderer
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
        <GalleryCreateMenu
          creating={creating}
          onCreatingChange={setCreating}
          onError={setCreateError}
          onImport={importPiecePackage}
        />
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
          {filteredLocalProjects.map((project) => (
            <li key={`local-${project.id}`}>
              <article className="project-card" aria-labelledby={`local-project-${project.id}`}>
                <div className="project-card-body">
                  <h3 id={`local-project-${project.id}`}>{project.title}</h3>
                  <p>
                    <span className="visibility-badge">Local only</span>
                  </p>
                  <Link className="shell-action" to={`/local-projects/${project.id}`}>
                    Open local editor
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default Gallery;

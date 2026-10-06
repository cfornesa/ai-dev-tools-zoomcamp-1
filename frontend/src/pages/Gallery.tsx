import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { listProjects, type Project } from '../api/projects';
import { listProjects3D, type Project3D } from '../api/projects3d';
import { ART_PIECE_ENGINE_CAPABILITIES, listArtPieces, type ArtPiece } from '../api/artPieces';
import { fetchProfile } from '../api/profile';
import { useAuth } from '../auth/useAuth';
import Project3DCard from '../components/Project3DCard';
import ProjectCard from '../components/ProjectCard';
import { formatDate } from '../components/formatDate';
import { originLabel } from '../components/originLabel';
import GalleryCreateMenu from './GalleryCreateMenu';
import {
  listProjectsForOwnerWithFallback,
  openLocalProjectDatabase,
  type LocalProjectRecord,
} from '../storage/localProjectRepository';
import { ensureLocalThumbnail } from '../storage/localThumbnail';
import { importLocalPiecePackage } from '../storage/localPiecePackageImport';

type LoadState = 'loading' | 'error' | 'ready';
type PieceKindFilter = 'all' | '2d' | '3d' | 'generated';

function parsePieceKindFilter(value: string | null): PieceKindFilter {
  return value === '2d' || value === '3d' || value === 'generated' ? value : 'all';
}

type GalleryEntry =
  | { kind: '2d'; id: string; updatedAt: string; value: Project }
  | { kind: '3d'; id: string; updatedAt: string; value: Project3D }
  | { kind: 'generated'; id: string; updatedAt: string; value: ArtPiece }
  | { kind: 'local'; id: string; updatedAt: string; value: LocalProjectRecord };

function OwnedArtPieceCard({ piece, handle }: { piece: ArtPiece; handle: string | null }) {
  const titleId = `owned-art-piece-${piece.public_id}-title`;
  const href =
    handle && piece.public_slug
      ? `/users/@${encodeURIComponent(handle)}/edit/${encodeURIComponent(piece.public_slug)}`
      : `/art-pieces/${encodeURIComponent(piece.public_id)}/edit`;
  const thumbnail = piece.current_version?.thumbnail_url;
  const engineLabel =
    piece.engine_label ?? ART_PIECE_ENGINE_CAPABILITIES[piece.engine]?.label ?? piece.engine;

  return (
    <article className="project-card" aria-labelledby={titleId}>
      {thumbnail ? (
        <img className="project-card-thumbnail" src={thumbnail} alt={`Preview of ${piece.title}`} />
      ) : (
        <div
          className="project-card-thumbnail-fallback"
          role="img"
          aria-label={`No preview available for ${piece.title}`}
        >
          No preview available
        </div>
      )}
      <h3 id={titleId}>{piece.title}</h3>
      <p>
        <span className="visibility-badge">{piece.status}</span>
        <span className="visibility-badge">
          {piece.status === 'published' ? 'Public' : 'Private'}
        </span>
        <span className="origin-badge">AI</span>
      </p>
      <p>
        <span className="visibility-badge">Generated</span>{' '}
        <span className="visibility-badge">{engineLabel}</span>
      </p>
      <p>Last updated {formatDate(piece.updated_at)}</p>
      <p>
        {piece.status === 'published' && (
          <Link
            className="shell-action"
            to={
              handle && piece.public_slug
                ? `/users/@${encodeURIComponent(handle)}/pieces/${encodeURIComponent(piece.public_slug)}`
                : `/art-pieces/p/${encodeURIComponent(piece.public_id)}`
            }
          >
            View public page
          </Link>
        )}{' '}
        <Link className="shell-action" to={href}>
          Edit
        </Link>
      </p>
    </article>
  );
}

function LocalProjectCard({
  project,
  onUpdated,
}: {
  project: LocalProjectRecord;
  onUpdated: (project: LocalProjectRecord) => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const kind = project.kind === '3d' ? '3D' : project.kind === 'generated' ? 'Generated' : '2D';
  const origin = originLabel(project.kind === 'generated' ? 'ai_create' : 'manual');
  const editorPath =
    project.kind === '3d'
      ? `/local-projects-3d/${project.id}`
      : project.kind === 'generated'
        ? `/local-generated/${project.id}`
        : `/local-projects/${project.id}`;

  useEffect(() => {
    let revokedUrl: string | null = null;
    if (project.thumbnail) {
      revokedUrl = URL.createObjectURL(project.thumbnail);
      setThumbnailUrl(revokedUrl);
    } else {
      setThumbnailUrl(null);
      void ensureLocalThumbnail(project).then((updated) => {
        if (updated?.thumbnail) onUpdated(updated);
      });
    }
    return () => {
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [onUpdated, project]);

  return (
    <article className="project-card" aria-labelledby={`local-project-${project.id}`}>
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={`Preview of ${project.title}`}
          className={`project-card-thumbnail${project.kind === '3d' ? ' project-card-thumbnail-3d' : ''}`}
        />
      ) : (
        <div
          className={`project-card-thumbnail-fallback${project.kind === '3d' ? ' project-card-thumbnail-fallback-3d' : ''}`}
          role="img"
          aria-label={`No preview available for ${project.title}`}
        >
          No preview available
        </div>
      )}
      <h3 id={`local-project-${project.id}`}>{project.title}</h3>
      <p className="project-card-description">{project.description || 'No description yet.'}</p>
      <p>
        {origin && <span className="origin-badge">{origin}</span>}
        <span className="visibility-badge">{kind}</span>
        <span className="visibility-badge">Local only</span>
      </p>
      <p>Last updated {formatDate(project.updatedAt)}</p>
      <p>
        <Link className="shell-action" to={editorPath}>
          Open local editor
        </Link>
      </p>
    </article>
  );
}

function Gallery() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  // Gap found live in production while verifying #238's fix: 3D projects
  // could be created but never appeared anywhere afterward, because this
  // page only ever fetched the 2D `Project` list. `listProjects3D()`
  // already existed in `api/projects3d.ts` -- it was just never called
  // here.
  const [projects3D, setProjects3D] = useState<Project3D[]>([]);
  const [artPieces, setArtPieces] = useState<ArtPiece[]>([]);
  const [localProjects, setLocalProjects] = useState<LocalProjectRecord[]>([]);
  const [sourceStates, setSourceStates] = useState<
    Record<'projects' | 'projects3D' | 'artPieces' | 'local', LoadState>
  >({
    projects: 'loading',
    projects3D: 'loading',
    artPieces: 'loading',
    local: 'loading',
  });
  const [profileHandle, setProfileHandle] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const projectKind = parsePieceKindFilter(searchParams.get('kind'));
  function changeProjectKind(value: PieceKindFilter) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === 'all') next.delete('kind');
        else next.set('kind', value);
        return next;
      },
      { replace: true },
    );
  }
  const updateLocalProject = useCallback((updated: LocalProjectRecord) => {
    setLocalProjects((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

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
    setSourceStates({
      projects: 'loading',
      projects3D: 'loading',
      artPieces: 'loading',
      local: 'loading',
    });
    const settle = <T,>(
      key: keyof typeof sourceStates,
      request: Promise<T>,
      save: (data: T) => void,
    ) => {
      void request.then(
        (data) => {
          if (cancelled) return;
          save(data);
          setSourceStates((current) => ({ ...current, [key]: 'ready' }));
        },
        () => {
          if (!cancelled) setSourceStates((current) => ({ ...current, [key]: 'error' }));
        },
      );
    };
    const loadLocal = async () => {
      if (auth.status !== 'signed-in') return [] as LocalProjectRecord[];
      const db = await openLocalProjectDatabase();
      try {
        const profile = await fetchProfile().catch(() => null);
        if (!cancelled) setProfileHandle(profile?.handle ?? null);
        return await listProjectsForOwnerWithFallback(db, auth.user.username, profile?.handle);
      } finally {
        db.close();
      }
    };
    settle('projects', listProjects(), setProjects);
    settle('projects3D', listProjects3D(), setProjects3D);
    settle('artPieces', listArtPieces(), setArtPieces);
    settle('local', loadLocal(), setLocalProjects);
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
  const filteredProjects = projectKind === '3d' || projectKind === 'generated' ? [] : ownProjects;
  const filteredProjects3D =
    projectKind === '2d' || projectKind === 'generated' ? [] : ownProjects3D;
  const filteredLocalProjects =
    projectKind === 'all'
      ? localProjects
      : localProjects.filter((project) =>
          projectKind === 'generated'
            ? project.kind === 'generated'
            : projectKind === '3d'
              ? project.kind === '3d'
              : project.kind !== '3d',
        );
  const ownArtPieces =
    auth.status === 'signed-in'
      ? artPieces.filter((piece) => !piece.owner || piece.owner === auth.user.username)
      : [];
  const filteredArtPieces = ownArtPieces.filter(
    (piece) =>
      projectKind === 'all' ||
      projectKind === 'generated' ||
      ART_PIECE_ENGINE_CAPABILITIES[piece.engine].family === projectKind,
  );
  const hasProjects =
    ownProjects.length > 0 ||
    ownProjects3D.length > 0 ||
    ownArtPieces.length > 0 ||
    localProjects.length > 0;
  const entries: GalleryEntry[] = [
    ...filteredProjects.map((value) => ({
      kind: '2d' as const,
      id: value.id,
      updatedAt: value.updated_at,
      value,
    })),
    ...filteredProjects3D.map((value) => ({
      kind: '3d' as const,
      id: value.id,
      updatedAt: value.updated_at,
      value,
    })),
    ...filteredArtPieces.map((value) => ({
      kind: 'generated' as const,
      id: value.public_id,
      updatedAt: value.updated_at,
      value,
    })),
    ...filteredLocalProjects.map((value) => ({
      kind: 'local' as const,
      id: value.id,
      updatedAt: value.updatedAt,
      value,
    })),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const isLoading = Object.values(sourceStates).some((state) => state === 'loading');
  const hasReadySource = Object.values(sourceStates).some((state) => state === 'ready');

  if (isLoading && !hasReadySource) {
    return (
      <p role="status" aria-live="polite">
        Loading your projects…
      </p>
    );
  }

  if (!isLoading && !hasReadySource) {
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
          Piece kind
        </label>
        <select
          id="project-renderer-filter"
          value={projectKind}
          onChange={(event) => changeProjectKind(event.target.value as PieceKindFilter)}
        >
          <option value="all">All</option>
          <option value="2d">2D</option>
          <option value="3d">3D</option>
          <option value="generated">Generated</option>
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

      {sourceStates.projects === 'error' && <p role="alert">We couldn't load your 2D projects.</p>}
      {sourceStates.projects3D === 'error' && (
        <p role="alert">We couldn't load your 3D projects.</p>
      )}
      {sourceStates.artPieces === 'error' && (
        <p role="alert">We couldn't load your generated art pieces.</p>
      )}
      {sourceStates.local === 'error' && <p role="alert">We couldn't load your local pieces.</p>}
      {isLoading && hasReadySource && <p role="status">Loading the remaining piece lists…</p>}

      {!hasProjects && isLoading ? null : !hasProjects ? (
        <div className="centered-state gallery-empty-state">
          <p>You have not created any projects.</p>
          <p>Create your first animation to get started.</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="centered-state gallery-empty-state">
          <p>
            {projectKind === 'generated'
              ? 'No generated pieces match this filter.'
              : `No ${projectKind.toUpperCase()} projects match this filter.`}
          </p>
        </div>
      ) : (
        <ul className="project-grid" aria-label="All your pieces">
          {entries.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`}>
              {entry.kind === '2d' && (
                <ProjectCard
                  project={entry.value}
                  onDeleted={(id) =>
                    setProjects((current) => current.filter((item) => item.id !== id))
                  }
                />
              )}
              {entry.kind === '3d' && (
                <Project3DCard
                  project={entry.value}
                  onDeleted={(id) =>
                    setProjects3D((current) => current.filter((item) => item.id !== id))
                  }
                />
              )}
              {entry.kind === 'generated' && (
                <OwnedArtPieceCard
                  piece={entry.value}
                  handle={entry.value.owner_handle ?? profileHandle}
                />
              )}
              {entry.kind === 'local' && (
                <LocalProjectCard project={entry.value} onUpdated={updateLocalProject} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default Gallery;

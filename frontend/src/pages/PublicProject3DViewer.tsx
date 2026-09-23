import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getPublicProject3D, type PublicProject3D } from '../api/projects3d';
import {
  generateScene3DBundle,
  triggerScene3DBundleDownload,
} from '../export/generateHtmlExport3D';
import Scene3DPreview from './Scene3DPreview';
import type { Scene3DDocument } from './scene3dTypes';
import { applyContentMetadata } from '../metadata';

type LoadState = 'loading' | 'ready' | 'unavailable' | 'error';

/**
 * Issue #296: the Project3D counterpart of `PublicProjectViewer.tsx` --
 * same anonymous-reachable, load-state, and "unavailable is a single
 * undifferentiated state" conventions (`GET /api/public/projects3d/<id>/`
 * 404s identically for never-existed/private/deleted/unpublished), but
 * deliberately smaller: no fork (Project3D has no fork/remix capability
 * at all, out of this issue's scope) and no camera/demo-signal controls
 * (this page renders via the shared `Scene3DPreview.tsx`, which already
 * owns its own "Steer the piece" gesture-camera-control affordance --
 * see that component's own doc comment -- so there is nothing extra for
 * this page to wire up itself, unlike the 2D viewer's hand-rolled camera
 * overlay compositing into a p5 canvas).
 */
function PublicProject3DViewer({
  initialProject,
  toolbarMode = 'menu',
  authorDisplayName,
  immersiveHref,
}: {
  initialProject?: PublicProject3D;
  toolbarMode?: 'menu' | 'inline';
  authorDisplayName?: string;
  immersiveHref?: string;
} = {}) {
  const { id: routeId } = useParams<{ id: string }>();
  const id = routeId ?? initialProject?.id;
  const location = useLocation();
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<PublicProject3D | null>(initialProject ?? null);
  // Issue #296 (mirrors #293's 2D embed snippet exactly): reaching this
  // component's "ready" state already implies the project is published --
  // an unavailable project 404s before ever getting here -- so no
  // separate visibility check gates the affordance.
  const [showEmbedSnippet, setShowEmbedSnippet] = useState(false);
  const [embedCopyStatus, setEmbedCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProject) {
      setProject(initialProject);
      setLoadState('ready');
      return;
    }
    if (!id) return;
    let cancelled = false;
    setLoadState('loading');
    setProject(null);

    getPublicProject3D(id)
      .then((fetched) => {
        if (cancelled) return;
        // `/p3d/:id` is a compatibility entry point. Keep the embed route's
        // chrome-less contract intact while moving the public viewer to the
        // canonical profile-nested slug surface.
        if (
          routeId &&
          !location.pathname.startsWith('/embed/') &&
          fetched.viewer_url?.startsWith('/users/@')
        ) {
          navigate(fetched.viewer_url, { replace: true });
          return;
        }
        setProject(fetched);
        setLoadState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          setLoadState('unavailable');
        } else {
          setLoadState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, initialProject, location.pathname, navigate, routeId]);

  useEffect(() => {
    if (project) {
      applyContentMetadata(
        project.seo_config,
        project.title,
        `A public 3D scene by ${project.owner}.`,
        window.location.href,
      );
    }
  }, [project]);

  function embedSnippetFor(projectId: string): string {
    const src = `${window.location.origin}/embed/p3d/${projectId}`;
    return `<iframe src="${src}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`;
  }

  async function handleCopyEmbedSnippet() {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(embedSnippetFor(id));
      setEmbedCopyStatus('copied');
    } catch {
      setEmbedCopyStatus('failed');
    }
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus('copied');
    } catch {
      setShareStatus('failed');
    }
  }

  async function handleDownload(
    variant: import('../export/generateHtmlExport3D').Scene3DExportVariant = 'full',
  ) {
    if (!project?.current_version) return;
    setDownloadError(null);
    const result = await generateScene3DBundle(
      project.current_version.scene_json as unknown as Scene3DDocument,
      project.title,
      { variant },
    );
    if (!result.ok) {
      setDownloadError(result.reasons.join(' '));
      return;
    }
    triggerScene3DBundleDownload(result.zipBlob, result.filename);
  }

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading project…
      </p>
    );
  }

  if (loadState === 'unavailable') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          This project isn't available. It may have been unpublished, deleted, or never existed.
        </p>
        <p>
          <Link to="/gallery">Back to the public gallery</Link>
        </p>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          Something went wrong loading this project. Please try again.
        </p>
        <p>
          <Link to="/gallery">Back to the public gallery</Link>
        </p>
      </div>
    );
  }

  if (!project) return null; // unreachable once loadState === 'ready'

  const isEmbedRoute = window.location.pathname.startsWith('/embed/p3d/');
  const isCanonicalRoute =
    immersiveHref?.startsWith('/users/@') || window.location.pathname.includes('/users/@');
  const versionSummaries = [...project.versions].sort(
    (left, right) => right.sequence - left.sequence,
  );
  const versionCount = project.version_count || versionSummaries.length;

  function formatVersionDate(createdAt: string) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
    }).format(new Date(createdAt));
  }

  return (
    <div className="public-project-viewer" data-project-kind="original">
      <header>
        {isCanonicalRoute && <p className="public-piece-kind">3D scene</p>}
        <h1 className="public-piece-page-heading">{project.title}</h1>
        <p className="public-project-attribution">By {authorDisplayName || project.owner}</p>
        {isCanonicalRoute && (
          <p className="public-piece-meta">
            3D scene · {versionCount} {versionCount === 1 ? 'version' : 'versions'}
          </p>
        )}
        {!!project.description && <p className="public-project-context">{project.description}</p>}
        {!project.description && !!project.seo_config?.description && !isCanonicalRoute && (
          <p className="public-project-context">{project.seo_config.description}</p>
        )}
      </header>

      <section role="region" aria-label="Preview" data-panel="preview">
        {project.current_version && (
          <Scene3DPreview
            scene={project.current_version.scene_json as unknown as Scene3DDocument}
            screenshotBaseName={project.title}
            onDownload={(variant) => void handleDownload(variant)}
            immersiveHref={immersiveHref ?? `/immersive/p3d/${id}`}
            toolbarMode={toolbarMode}
          />
        )}
      </section>
      {!isEmbedRoute && (
        <div className="public-piece-actions" aria-label="Piece actions" role="group">
          {toolbarMode === 'inline' ? (
            <button
              type="button"
              className="public-project-immersive-button"
              onClick={() =>
                window.open(
                  immersiveHref ?? `/immersive/p3d/${id}`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
            >
              {isCanonicalRoute ? 'Open immersive view' : 'View in immersive mode'}
            </button>
          ) : (
            <a href={immersiveHref ?? `/immersive/p3d/${id}`} target="_blank" rel="noreferrer">
              {isCanonicalRoute ? 'Open immersive view' : 'View in immersive mode'}
            </a>
          )}
          {isCanonicalRoute && (
            <button type="button" onClick={() => void handleShare()}>
              Share
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setShowEmbedSnippet((current) => !current);
              setEmbedCopyStatus('idle');
            }}
            aria-expanded={showEmbedSnippet}
            data-testid="toggle-embed-snippet"
          >
            {showEmbedSnippet ? 'Hide embed code' : 'Embed'}
          </button>
          {shareStatus === 'copied' && <span role="status">Link copied.</span>}
          {shareStatus === 'failed' && <span role="alert">Couldn&apos;t copy the link.</span>}
        </div>
      )}
      {showEmbedSnippet && id && !isEmbedRoute && (
        <div className="public-project-embed-snippet" data-testid="embed-snippet-panel">
          <label htmlFor="embed-snippet-3d-textarea">Embed this piece on another site</label>
          <textarea
            id="embed-snippet-3d-textarea"
            readOnly
            value={embedSnippetFor(id)}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" onClick={() => void handleCopyEmbedSnippet()}>
            Copy
          </button>
          {embedCopyStatus === 'copied' && <p role="status">Copied!</p>}
          {embedCopyStatus === 'failed' && (
            <p role="alert">
              Couldn't copy automatically -- select the text above and copy manually.
            </p>
          )}
        </div>
      )}
      {isCanonicalRoute && !isEmbedRoute && (
        <div className="public-piece-version-context">
          <section aria-labelledby="current-version-heading">
            <h2 id="current-version-heading">Current version context</h2>
            {project.current_version ? (
              <p>
                Version {project.current_version.sequence} ·{' '}
                <time dateTime={project.current_version.created_at}>
                  {formatVersionDate(project.current_version.created_at)}
                </time>
              </p>
            ) : (
              <p>No saved version yet.</p>
            )}
          </section>
          <section aria-labelledby="versions-heading">
            <h2 id="versions-heading">Versions</h2>
            <ol>
              {versionSummaries.map((version) => (
                <li key={`${version.sequence}-${version.created_at}`}>
                  <span>Version {version.sequence}</span>{' '}
                  <time dateTime={version.created_at}>{formatVersionDate(version.created_at)}</time>
                  {version.is_current && <span className="public-piece-current">CURRENT</span>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
      {!isEmbedRoute && !!project.collections?.length && (
        <aside className="public-collection-context" aria-label="Public collections">
          <h3>Part of these collections</h3>
          <ul>
            {project.collections.map((collection) => (
              <li key={collection.url}>
                <Link to={collection.url}>{collection.title}</Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
      {downloadError && (
        <p role="alert" aria-live="assertive">
          Couldn’t download this piece: {downloadError}
        </p>
      )}
    </div>
  );
}

export default PublicProject3DViewer;

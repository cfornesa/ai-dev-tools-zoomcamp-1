import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getPublicProject3D, type PublicProject3D } from '../api/projects3d';
import Scene3DPreview from './Scene3DPreview';
import type { Scene3DDocument } from './scene3dTypes';

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
function PublicProject3DViewer() {
  const { id } = useParams<{ id: string }>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<PublicProject3D | null>(null);
  // Issue #296 (mirrors #293's 2D embed snippet exactly): reaching this
  // component's "ready" state already implies the project is published --
  // an unavailable project 404s before ever getting here -- so no
  // separate visibility check gates the affordance.
  const [showEmbedSnippet, setShowEmbedSnippet] = useState(false);
  const [embedCopyStatus, setEmbedCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadState('loading');
    setProject(null);

    getPublicProject3D(id)
      .then((fetched) => {
        if (cancelled) return;
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
  }, [id]);

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

  return (
    <div className="public-project-viewer" data-project-kind="original">
      <header>
        <h2>{project.title}</h2>
        <p className="public-project-attribution">By {project.owner}</p>

        <p>
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
          </button>{' '}
          {/* Issue #311: mirrors the reference implementation's own entry
              point exactly -- a plain link opening the immersive view in a
              new tab, not a same-tab navigation or in-page overlay. */}
          <a href={`/immersive/p3d/${id}`} target="_blank" rel="noreferrer">
            View in immersive mode
          </a>
        </p>
        {showEmbedSnippet && id && (
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
            {embedCopyStatus === 'copied' && (
              <p role="status" aria-live="polite">
                Copied!
              </p>
            )}
            {embedCopyStatus === 'failed' && (
              <p role="alert" aria-live="assertive">
                Couldn't copy automatically -- select the text above and copy manually.
              </p>
            )}
          </div>
        )}
      </header>

      <section role="region" aria-label="Preview" data-panel="preview">
        {project.current_version && (
          <Scene3DPreview
            scene={project.current_version.scene_json as unknown as Scene3DDocument}
            screenshotBaseName={project.title}
          />
        )}
      </section>
    </div>
  );
}

export default PublicProject3DViewer;

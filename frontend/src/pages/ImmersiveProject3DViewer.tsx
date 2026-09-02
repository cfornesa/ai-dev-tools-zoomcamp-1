import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getPublicProject3D, type PublicProject3D } from '../api/projects3d';
import {
  generateScene3DBundle,
  triggerScene3DBundleDownload,
  type Scene3DExportVariant,
} from '../export/generateHtmlExport3D';
import Scene3DPreview from './Scene3DPreview';
import type { Scene3DDocument } from './scene3dTypes';

type LoadState = 'loading' | 'ready' | 'unavailable' | 'error';

/**
 * Issue #311: the immersive first-person free-fly view -- the epic
 * 237/#274's last remaining scope item, grounded in a direct investigation
 * of the reference implementation's own `/immersive/pieces/{id}` route
 * (`augment-humankind`'s `immersive-gallery.js`, a sibling repo, not
 * guessed): a full separate page (not an in-page modal/overlay), reusing
 * the exact same piece content as the normal public viewer, just wrapped
 * in a camera rig that adds arrow-key "fly" translation
 * (`Scene3DPreview.tsx`'s new `flyControls` prop) on top of the existing
 * mouse-drag orbit/wheel-zoom. Confirmed no WebXR/Pointer-Lock API is
 * involved in the reference either (`vr-mode-ui: enabled: false`, no
 * `requestPointerLock` call anywhere in its source) -- this is a
 * first-person *camera style*, not a VR-headset feature.
 *
 * The immersive route reuses the same hand-tracking controls as the normal
 * 3D piece surface. That keeps "steer the piece" and its guide available in
 * both views while arrow-key fly mode adds immersive camera motion. A-Frame
 * itself is irrelevant to this port -- this app's 3D document family only
 * ever renders through Three.js.
 *
 * ## A real separate page, opened in a new tab
 *
 * Mirrors the reference's own entry point (a plain link with
 * `target="_blank"`, not a same-tab navigation or in-page overlay) --
 * `PublicProject3DViewer.tsx`'s "View in immersive mode" link does the
 * same. Exiting is just closing the tab or navigating back, matching the
 * reference exactly (it has no dedicated in-page exit affordance beyond
 * that, only an unrelated "reset view" convenience).
 */
function ImmersiveProject3DViewer() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === '1';
  const isCmsEmbed = isEmbed && searchParams.get('cms') === '1';
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<PublicProject3D | null>(null);
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
  const readyProject = project;

  function embedSnippetFor(cms: boolean): string {
    const query = cms ? '?embed=1&cms=1' : '?embed=1';
    const src = `${window.location.origin}/immersive/p3d/${readyProject.id}${query}`;
    return `<iframe src="${src}" width="800" height="600" frameborder="0" allow="fullscreen; camera; microphone" allowfullscreen></iframe>`;
  }

  async function copyEmbedSnippet(cms: boolean) {
    try {
      await navigator.clipboard.writeText(embedSnippetFor(cms));
      setEmbedCopyStatus('copied');
    } catch {
      setEmbedCopyStatus('failed');
    }
  }

  async function handleDownload(variant: Scene3DExportVariant = 'full') {
    if (!readyProject.current_version) return;
    const result = await generateScene3DBundle(
      readyProject.current_version.scene_json as unknown as Scene3DDocument,
      readyProject.title,
      { variant },
    );
    if (result.ok) triggerScene3DBundleDownload(result.zipBlob, result.filename);
  }

  return (
    <div
      className={`immersive-project3d-viewer${isEmbed ? ' immersive-project3d-viewer--embed' : ''}`}
      data-testid="immersive-project3d-viewer"
      data-immersive-embed-mode={isCmsEmbed ? 'cms' : isEmbed ? 'custom' : undefined}
    >
      {!isEmbed && (
        <header>
          <h2>{readyProject.title}</h2>
          <p className="public-project-attribution">By {readyProject.owner}</p>
          <p role="note">
            Drag to look around, scroll/pinch to zoom, and use the arrow keys to fly through the
            piece.
          </p>
          <div className="immersive-project3d-embed-actions" aria-label="Embed options">
            <button type="button" onClick={() => void copyEmbedSnippet(false)}>
              Embed (Custom)
            </button>
            <button type="button" onClick={() => void copyEmbedSnippet(true)}>
              Embed (CMS)
            </button>
            {embedCopyStatus === 'copied' && (
              <span role="status" aria-live="polite">
                Embed code copied.
              </span>
            )}
            {embedCopyStatus === 'failed' && (
              <span role="alert" aria-live="assertive">
                Couldn&apos;t copy automatically; select and copy the embed code manually.
              </span>
            )}
          </div>
        </header>
      )}
      <section role="region" aria-label="Preview" data-panel="preview">
        {readyProject.current_version && (
          <Scene3DPreview
            scene={readyProject.current_version.scene_json as unknown as Scene3DDocument}
            screenshotBaseName={readyProject.title}
            flyControls
            onDownload={(variant) => void handleDownload(variant)}
          />
        )}
      </section>
    </div>
  );
}

export default ImmersiveProject3DViewer;

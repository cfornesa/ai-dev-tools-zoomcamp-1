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
function ImmersiveProject3DViewer({
  initialProject,
  authorDisplayName,
  canonicalHref,
}: {
  initialProject?: PublicProject3D;
  authorDisplayName?: string;
  canonicalHref?: string;
} = {}) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === '1';
  const isCmsEmbed = isEmbed && searchParams.get('cms') === '1';
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [project, setProject] = useState<PublicProject3D | null>(initialProject ?? null);
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [embedCopyStatus, setEmbedCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

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
  }, [id, initialProject]);

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
  const versionSummaries = [...readyProject.versions].sort(
    (left, right) => right.sequence - left.sequence,
  );
  const versionCount = readyProject.version_count || versionSummaries.length;
  const description = readyProject.description || readyProject.seo_config?.description;

  function formatVersionDate(createdAt: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(createdAt));
  }

  function embedSnippetFor(cms: boolean): string {
    const query = cms ? '?embed=1&cms=1' : '?embed=1';
    const src = `${window.location.origin}${canonicalHref ?? `/immersive/p3d/${readyProject.id}`}${query}`;
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

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopyStatus('copied');
    } catch {
      setShareCopyStatus('failed');
    }
  }

  async function handleDownload(variant: Scene3DExportVariant = 'full') {
    if (!readyProject.current_version) return;
    const result = await generateScene3DBundle(
      readyProject.current_version.scene_json as unknown as Scene3DDocument,
      readyProject.title,
      { variant, immersive: true },
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
        <div
          className="immersive-project3d-content immersive-project3d-content--header"
          data-testid="immersive-info-header"
        >
          <header>
            <p className="public-piece-kind">3D scene</p>
            <h1 className="public-piece-page-heading">{readyProject.title}</h1>
            <p className="public-project-attribution">
              By {authorDisplayName || readyProject.owner}
            </p>
            <p className="public-piece-meta">
              3D scene · {versionCount} {versionCount === 1 ? 'version' : 'versions'}
            </p>
            {!!description && <p className="public-project-context">{description}</p>}
            <p role="note">
              Drag to look around, scroll/pinch to zoom, and use the arrow keys to fly through the
              piece.
            </p>
          </header>
        </div>
      )}
      <section
        role="region"
        aria-label="Preview"
        data-panel="preview"
        data-testid="immersive-3d-stage"
      >
        {readyProject.current_version && (
          <Scene3DPreview
            scene={readyProject.current_version.scene_json as unknown as Scene3DDocument}
            screenshotBaseName={readyProject.title}
            flyControls
            onDownload={(variant) => void handleDownload(variant)}
            toolbarMode="inline"
          />
        )}
      </section>
      {!isEmbed && (
        <div
          className="immersive-project3d-content immersive-project3d-content--footer"
          data-testid="immersive-info-block"
        >
          <div
            className="immersive-project3d-embed-actions"
            aria-label="Piece actions"
            role="group"
          >
            <button type="button" onClick={() => void copyShareLink()}>
              Share
            </button>
            <button type="button" onClick={() => void copyEmbedSnippet(false)}>
              Embed (Custom)
            </button>
            <button type="button" onClick={() => void copyEmbedSnippet(true)}>
              Embed (CMS)
            </button>
            {shareCopyStatus === 'copied' && (
              <span role="status" aria-live="polite">
                Link copied.
              </span>
            )}
            {shareCopyStatus === 'failed' && (
              <span role="alert" aria-live="assertive">
                Couldn&apos;t copy the link.
              </span>
            )}
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
          <div
            className="public-piece-version-context immersive-project3d-version-details"
            data-testid="immersive-version-details"
          >
            <section aria-labelledby="immersive-current-version-heading">
              <h2 id="immersive-current-version-heading">Current version context</h2>
              {readyProject.current_version ? (
                <p>
                  Version {readyProject.current_version.sequence} ·{' '}
                  <time dateTime={readyProject.current_version.created_at}>
                    {formatVersionDate(readyProject.current_version.created_at)}
                  </time>
                </p>
              ) : (
                <p>No saved version yet.</p>
              )}
            </section>
            <section aria-labelledby="immersive-versions-heading">
              <h2 id="immersive-versions-heading">Versions</h2>
              <ol>
                {versionSummaries.map((version) => (
                  <li key={`${version.sequence}-${version.created_at}`}>
                    <span>Version {version.sequence}</span>{' '}
                    <time dateTime={version.created_at}>
                      {formatVersionDate(version.created_at)}
                    </time>
                    {version.is_current && <span className="public-piece-current">CURRENT</span>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImmersiveProject3DViewer;

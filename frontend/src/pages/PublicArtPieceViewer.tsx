import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  ART_PIECE_ENGINE_CAPABILITIES,
  getArtPiece,
  getPublicArtPiece,
  type ArtPiece,
} from '../api/artPieces';
import { useAuth } from '../auth/useAuth';
import {
  ART_PIECE_IFRAME_ALLOW,
  ART_PIECE_IFRAME_SANDBOX,
  buildArtPieceSandboxDocument,
} from '../generative/artPieceSandbox';
import { applyContentMetadata } from '../metadata';
import { captureArtPieceThumbnailFromSource } from '../generative/artPieceThumbnailCapture';
import PieceStageControls from './PieceStageControls';
import { aspectRatioFromMetadata } from './artPiecePresentation';

function isEmbedPath(): boolean {
  return window.location.pathname.startsWith('/embed/art-pieces/');
}

/** Issue #435: `PublicProjectViewer.tsx`'s own `embed/p/:id` convention,
 * adapted for art pieces -- one component serves both the full-chrome
 * `/art-pieces/p/:id` route and the chrome-less `/embed/art-pieces/:id`
 * sibling route (registered outside the Layout-wrapped route group in
 * App.tsx, so no app-shell nav/header ever renders there either). The
 * only difference is which parts of this component's own markup render;
 * this stays a single component rather than a duplicate, matching the
 * project-viewer precedent. */
function embedSnippetFor(publicId: string): string {
  const src = `${window.location.origin}/embed/art-pieces/${publicId}`;
  return `<iframe src="${src}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`;
}

const PUBLIC_PROMPT_PREVIEW_LENGTH = 180;

function truncatePrompt(prompt: string): string {
  if (prompt.length <= PUBLIC_PROMPT_PREVIEW_LENGTH) return prompt;
  return `${prompt.slice(0, PUBLIC_PROMPT_PREVIEW_LENGTH).trimEnd()}…`;
}

function pieceAspectRatio(piece: ArtPiece): string {
  return aspectRatioFromMetadata(
    piece.current_version?.presentation ?? piece.current_version?.generation_metadata,
  );
}

export default function PublicArtPieceViewer({
  initialPiece,
  canonicalHref,
  canonicalRoute = false,
  editHref,
  authorDisplayName,
}: {
  initialPiece?: ArtPiece;
  canonicalHref?: string;
  canonicalRoute?: boolean;
  editHref?: string;
  authorDisplayName?: string;
} = {}) {
  const { id } = useParams<{ id: string }>();
  const [piece, setPiece] = useState<ArtPiece | null>(initialPiece ?? null);
  const [error, setError] = useState(false);
  const [showEmbedSnippet, setShowEmbedSnippet] = useState(false);
  const [embedCopyStatus, setEmbedCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const auth = useAuth();
  const stageRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null);
  const [fullscreenToolbarHost, setFullscreenToolbarHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (initialPiece) return;
    if (id)
      getPublicArtPiece(id)
        .then(setPiece)
        .catch(() => setError(true));
  }, [id, initialPiece]);
  useEffect(() => {
    if (piece)
      applyContentMetadata(piece.seo_config, piece.title, piece.description, window.location.href);
  }, [piece]);

  useEffect(() => {
    // A publish can happen from the management list without an editor
    // preview being mounted. If that left a 2D piece with its explicit
    // fallback, let only the authenticated owner repair it on first public
    // view. Anonymous viewers never receive the owner-only source and never
    // gain upload permission through this path.
    if (
      !piece ||
      isEmbedPath() ||
      auth.status !== 'signed-in' ||
      !piece.current_version?.thumbnail_is_fallback ||
      ART_PIECE_ENGINE_CAPABILITIES[piece.engine]?.family !== '2d'
    ) {
      return;
    }
    let cancelled = false;
    getArtPiece(piece.public_id)
      .then((ownerPiece) => {
        // The owner-only endpoint is the authorization check; public
        // viewers cannot resolve this request and therefore cannot reach
        // the upload path.
        if (cancelled || !ownerPiece.current_version) return;
        void captureArtPieceThumbnailFromSource(
          ownerPiece.public_id,
          ownerPiece.current_version.id,
          ownerPiece.current_version.source,
          ownerPiece.engine,
          ...(ownerPiece.current_version.ink ? [ownerPiece.current_version.ink] : []),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [auth.status, piece]);

  async function handleCopyEmbedSnippet() {
    const embedPieceId = id ?? piece?.public_id;
    if (!embedPieceId) return;
    try {
      await navigator.clipboard.writeText(embedSnippetFor(embedPieceId));
      setEmbedCopyStatus('copied');
    } catch {
      setEmbedCopyStatus('failed');
    }
  }

  if (!piece && !error) return <p role="status">Loading art piece…</p>;
  if (error || !piece?.current_version)
    return (
      <div role="alert">
        <p>This art piece isn't available.</p>
        <Link to="/art-pieces/gallery">Back to public art pieces</Link>
      </div>
    );

  const isEmbedRoute = isEmbedPath();
  const isCanonicalRoute = canonicalRoute;
  const pieceId = id ?? piece.public_id;
  const aspectRatio = pieceAspectRatio(piece);
  const versions = [...(piece.versions ?? [])].sort(
    (left, right) => right.sequence - left.sequence,
  );
  const versionCount = versions.length || 1;
  const currentSummary =
    versions.find((version) => version.sequence === piece.current_version?.sequence) ?? versions[0];

  return (
    <section
      className="public-art-piece-viewer"
      aria-labelledby="public-art-piece-heading"
      data-embed-route={isEmbedRoute || undefined}
    >
      {!isEmbedRoute && (
        <>
          {isCanonicalRoute && <p className="public-piece-kind">Generated art</p>}
          <h1 id="public-art-piece-heading" className="public-piece-page-heading">
            {piece.title}
          </h1>
          {isCanonicalRoute && (
            <p className="public-piece-meta">
              {piece.engine_label ?? piece.engine} · {versionCount}{' '}
              {versionCount === 1 ? 'version' : 'versions'}
            </p>
          )}
          {editHref && !isCanonicalRoute && <Link to={editHref}>Edit piece</Link>}
          {!!piece.description && <p>{piece.description}</p>}
          <p className="public-project-attribution">
            By {authorDisplayName || piece.owner || 'Public artist'}
          </p>
          {!isCanonicalRoute && (
            <>
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
                </button>
              </p>
              {showEmbedSnippet && pieceId && (
                <div className="public-art-piece-embed-snippet" data-testid="embed-snippet-panel">
                  <label htmlFor="art-piece-embed-snippet-textarea">
                    Embed this piece on another site
                  </label>
                  <textarea
                    id="art-piece-embed-snippet-textarea"
                    readOnly
                    value={embedSnippetFor(pieceId)}
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
                    <p role="alert">
                      Could not copy automatically -- select and copy the text above.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
      <div className="public-art-piece-viewer-stage-shell">
        <div
          ref={setToolbarHost}
          className="public-art-piece-toolbar-row"
          data-testid="regular-piece-toolbar-row"
        />
        <div
          ref={stageRef}
          className="art-piece-stage public-art-piece-stage"
          role="region"
          aria-label="Art piece stage"
          style={
            {
              '--art-piece-aspect-ratio': aspectRatio,
              background:
                piece.current_version.camera_placement === 'background'
                  ? 'transparent'
                  : 'color-mix(in srgb, var(--code-bg, #f4f3ec) 94%, var(--text, #111827))',
            } as CSSProperties
          }
        >
          <div
            ref={setFullscreenToolbarHost}
            className="public-art-piece-fullscreen-toolbar-host"
            data-testid="regular-piece-fullscreen-toolbar-host"
          />
          <iframe
            ref={iframeRef}
            title="Art piece preview"
            sandbox={ART_PIECE_IFRAME_SANDBOX}
            allow={ART_PIECE_IFRAME_ALLOW}
            srcDoc={buildArtPieceSandboxDocument(
              piece.current_version.source,
              piece.engine,
              'regular',
              {
                background: 'transparent',
                ink: piece.current_version.ink,
              },
            )}
            // Issue #435: browsers apply a default iframe border a few px
            // wide unless reset; with box-sizing: content-box (the iframe
            // default), that border adds to the box beyond its 100% width,
            // overflowing its container by exactly the border's size --
            // caught by this issue's own stage-containment check at
            // 1280x900, present on this route and /art-pieces/p/:id alike.
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              border: 'none',
              position: 'relative',
              zIndex: 1,
              background: 'color-mix(in srgb, var(--code-bg, #f4f3ec) 94%, var(--text, #111827))',
            }}
          />
          <PieceStageControls
            stageRef={stageRef}
            iframeRef={iframeRef}
            capabilities={piece.current_version.capabilities}
            immersiveHref={
              canonicalHref
                ? canonicalHref.replace('/pieces/', '/immersive/')
                : `/art-pieces/immersive/${piece.public_id}`
            }
            library={piece.engine}
            source={piece.current_version.source}
            ink={piece.current_version.ink}
            cameraPlacement={piece.current_version.camera_placement}
            authoredSonic={piece.current_version.sonic}
            pieceId={piece.public_id}
            title={piece.title}
            toolbarPortalTarget={toolbarHost}
            fullscreenToolbarPortalTarget={fullscreenToolbarHost}
          />
        </div>
      </div>
      {!isEmbedRoute && isCanonicalRoute && (
        <>
          <div className="public-piece-actions" aria-label="Piece actions" role="group">
            <button
              type="button"
              onClick={() =>
                window.open(
                  canonicalHref?.replace('/pieces/', '/immersive/') ?? '#',
                  '_blank',
                  'noopener,noreferrer',
                )
              }
            >
              Open immersive view
            </button>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(window.location.href)}
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEmbedSnippet((current) => !current);
                setEmbedCopyStatus('idle');
              }}
              aria-expanded={showEmbedSnippet}
            >
              {showEmbedSnippet ? 'Hide embed code' : 'Embed'}
            </button>
          </div>
          {showEmbedSnippet && pieceId && (
            <div className="public-art-piece-embed-snippet" data-testid="embed-snippet-panel">
              <label htmlFor="art-piece-embed-snippet-textarea">
                Embed this piece on another site
              </label>
              <textarea
                id="art-piece-embed-snippet-textarea"
                readOnly
                value={embedSnippetFor(pieceId)}
              />
              <button type="button" onClick={() => void handleCopyEmbedSnippet()}>
                Copy
              </button>
              {embedCopyStatus === 'copied' && <p role="status">Copied!</p>}
              {embedCopyStatus === 'failed' && <p role="alert">Could not copy automatically.</p>}
            </div>
          )}
          <div className="public-piece-version-context">
            <section aria-labelledby="generated-current-version-heading">
              <h2 id="generated-current-version-heading">Current version context</h2>
              {currentSummary ? (
                <dl>
                  <dt>Engine</dt>
                  <dd>{currentSummary.engine}</dd>
                  <dt>Model</dt>
                  <dd>{currentSummary.model_label ?? 'Not specified'}</dd>
                  <dt>Prompt</dt>
                  <dd>{currentSummary.prompt}</dd>
                </dl>
              ) : (
                <p>No saved version yet.</p>
              )}
            </section>
            <section aria-labelledby="generated-versions-heading">
              <h2 id="generated-versions-heading">Versions</h2>
              <ol>
                {versions.map((version) => (
                  <li key={`${version.sequence}-${version.created_at}`}>
                    <span>Version {version.sequence}</span> · {version.engine} · {version.status} ·{' '}
                    <time dateTime={version.created_at}>{version.created_at}</time>{' '}
                    {version.model_label && <span>{version.model_label} · </span>}
                    <details>
                      <summary title={version.prompt}>{truncatePrompt(version.prompt)}</summary>
                      <p>{version.prompt}</p>
                    </details>
                    {version.sequence === piece.current_version?.sequence && (
                      <span className="public-piece-current">CURRENT</span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </>
      )}
      {!isEmbedRoute && !!piece.collections?.length && (
        <aside className="public-collection-context" aria-label="Public collections">
          <h3>Part of these collections</h3>
          <ul>
            {piece.collections.map((collection) => (
              <li key={collection.url}>
                <Link to={collection.url}>{collection.title}</Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
      {!isEmbedRoute && <Link to="/art-pieces/gallery">Back to public art pieces</Link>}
    </section>
  );
}

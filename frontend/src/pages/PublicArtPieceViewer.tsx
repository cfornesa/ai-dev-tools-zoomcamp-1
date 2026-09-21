import { useEffect, useRef, useState } from 'react';
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

export default function PublicArtPieceViewer({
  initialPiece,
  canonicalHref,
  editHref,
}: {
  initialPiece?: ArtPiece;
  canonicalHref?: string;
  editHref?: string;
} = {}) {
  const { id } = useParams<{ id: string }>();
  const [piece, setPiece] = useState<ArtPiece | null>(initialPiece ?? null);
  const [error, setError] = useState(false);
  const [showEmbedSnippet, setShowEmbedSnippet] = useState(false);
  const [embedCopyStatus, setEmbedCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const auth = useAuth();
  const stageRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
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
  const pieceId = id ?? piece.public_id;

  return (
    <section
      aria-labelledby="public-art-piece-heading"
      data-embed-route={isEmbedRoute || undefined}
    >
      {!isEmbedRoute && (
        <>
          <h2 id="public-art-piece-heading">{piece.title}</h2>
          {editHref && <Link to={editHref}>Edit piece</Link>}
          <p>{piece.description}</p>
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
                <p role="alert">Could not copy automatically -- select and copy the text above.</p>
              )}
            </div>
          )}
        </>
      )}
      <div ref={stageRef} className="art-piece-stage" aria-label="Art piece stage">
        <iframe
          ref={iframeRef}
          title="Art piece preview"
          sandbox={ART_PIECE_IFRAME_SANDBOX}
          allow={ART_PIECE_IFRAME_ALLOW}
          srcDoc={buildArtPieceSandboxDocument(piece.current_version.source, piece.engine)}
          // Issue #435: browsers apply a default iframe border a few px
          // wide unless reset; with box-sizing: content-box (the iframe
          // default), that border adds to the box beyond its 100% width,
          // overflowing its container by exactly the border's size --
          // caught by this issue's own stage-containment check at
          // 1280x900, present on this route and /art-pieces/p/:id alike.
          style={{ display: 'block', width: '100%', height: 480, border: 'none' }}
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
          title={piece.title}
        />
      </div>
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

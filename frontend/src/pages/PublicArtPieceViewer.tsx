import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getPublicArtPiece, type ArtPiece } from '../api/artPieces';
import {
  ART_PIECE_IFRAME_ALLOW,
  ART_PIECE_IFRAME_SANDBOX,
  buildArtPieceSandboxDocument,
} from '../generative/artPieceSandbox';
import PieceStageControls from './PieceStageControls';

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

function PublicArtPieceViewer() {
  const { id } = useParams<{ id: string }>();
  const [piece, setPiece] = useState<ArtPiece | null>(null);
  const [error, setError] = useState(false);
  const [showEmbedSnippet, setShowEmbedSnippet] = useState(false);
  const [embedCopyStatus, setEmbedCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const stageRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (id)
      getPublicArtPiece(id)
        .then(setPiece)
        .catch(() => setError(true));
  }, [id]);

  async function handleCopyEmbedSnippet() {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(embedSnippetFor(id));
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

  const isEmbedRoute = window.location.pathname.startsWith('/embed/art-pieces/');

  return (
    <section
      aria-labelledby="public-art-piece-heading"
      data-embed-route={isEmbedRoute || undefined}
    >
      {!isEmbedRoute && (
        <>
          <h2 id="public-art-piece-heading">{piece.title}</h2>
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
          {showEmbedSnippet && id && (
            <div className="public-art-piece-embed-snippet" data-testid="embed-snippet-panel">
              <label htmlFor="art-piece-embed-snippet-textarea">
                Embed this piece on another site
              </label>
              <textarea
                id="art-piece-embed-snippet-textarea"
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
          immersiveHref={`/art-pieces/immersive/${piece.public_id}`}
          library={piece.engine}
          source={piece.current_version.source}
          title={piece.title}
        />
      </div>
      {!isEmbedRoute && <Link to="/art-pieces/gallery">Back to public art pieces</Link>}
    </section>
  );
}

export default PublicArtPieceViewer;

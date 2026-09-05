import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getPublicArtPiece, type ArtPiece } from '../api/artPieces';
import {
  ART_PIECE_BRIDGE_VERSION,
  ART_PIECE_IFRAME_ALLOW,
  ART_PIECE_IFRAME_SANDBOX,
  buildArtPieceSandboxDocument,
} from '../generative/artPieceSandbox';
import PieceStageControls from './PieceStageControls';

/** Issue #434: honest per-engine support -- only Three.js/A-Frame pieces
 * have a registerable spatial camera at all (same boundary #432's
 * hand-steering already draws). Canvas2D/SVG get a plain explanation
 * instead of the previous, always-shown "drag to explore, arrow keys to
 * move" instructions that lied for every engine that can't do any of
 * that. */
const SPATIAL_LIBRARIES = new Set(['threejs', 'aframe']);

/** Small, discrete per-keypress/per-drag-step deltas -- deliberately no
 * added inertia/momentum/easing, so there is no continuous animation for
 * a reduced-motion preference to need to suppress in the first place. */
const KEY_STEP = 0.3;
const DRAG_SENSITIVITY = 0.02;
const ZOOM_STEP = 0.5;

/** Issue #446: `PublicArtPieceViewer.tsx`'s own `embed/art-pieces/:id`
 * convention, adapted for the immersive route -- one component serves
 * both the full-chrome `/art-pieces/immersive/:id` route and the
 * chrome-less `/embed/art-pieces/immersive/:id` sibling route
 * (registered outside the Layout-wrapped route group in App.tsx, so no
 * app-shell nav/header ever renders there either). Only this
 * component's own header/instructions/back-link markup differs; the
 * stage and its one shared `PieceStageControls` toolbar are identical in
 * both modes -- no duplicated wrapper controls. */
function embedSnippetFor(publicId: string): string {
  const src = `${window.location.origin}/embed/art-pieces/immersive/${publicId}`;
  return `<iframe src="${src}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`;
}

function ImmersiveArtPieceViewer() {
  const { id } = useParams<{ id: string }>();
  const [piece, setPiece] = useState<ArtPiece | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [navigationPose, setNavigationPose] = useState<{ x: number; y: number; z: number } | null>(
    null,
  );
  const [navigationError, setNavigationError] = useState<
    'unsupported-engine' | 'no-camera-registered' | null
  >(null);
  const [showEmbedSnippet, setShowEmbedSnippet] = useState(false);
  const [embedCopyStatus, setEmbedCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const stageRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    getPublicArtPiece(id)
      .then(setPiece)
      .catch(() => setUnavailable(true));
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

  function navigate(delta: { dx?: number; dy?: number; dz?: number }) {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: 'art-piece-parent',
        version: ART_PIECE_BRIDGE_VERSION,
        type: 'navigate-signal',
        ...delta,
      },
      '*',
    );
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as {
        source?: string;
        status?: string;
        active?: boolean;
        error?: string;
        pose?: { x: number; y: number; z: number };
      } | null;
      if (data?.source !== 'art-piece-sandbox') return;
      // Reset (#432) always reports through 'steering', so the immersive
      // position readout stays in sync with a Reset too, not only with
      // this viewer's own navigation input.
      if (data.status === 'navigation' || data.status === 'steering') {
        if (data.pose) setNavigationPose(data.pose);
        if (data.status === 'navigation') {
          if (data.error === 'unsupported-engine') setNavigationError('unsupported-engine');
          else if (data.error === 'no-camera-registered')
            setNavigationError('no-camera-registered');
          else if (data.active) setNavigationError(null);
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !piece || !SPATIAL_LIBRARIES.has(piece.engine)) return undefined;

    function onKeyDown(event: KeyboardEvent) {
      // Arrow keys only -- WASD stays reserved for Sound's keyboard
      // notes (#430), which the stage-local Edit... err, Piece controls
      // toolbar also exposes on this same page.
      switch (event.key) {
        case 'ArrowUp':
          navigate({ dz: -KEY_STEP });
          break;
        case 'ArrowDown':
          navigate({ dz: KEY_STEP });
          break;
        case 'ArrowLeft':
          navigate({ dx: -KEY_STEP });
          break;
        case 'ArrowRight':
          navigate({ dx: KEY_STEP });
          break;
        default:
          return;
      }
      event.preventDefault();
    }
    function onPointerDown(event: PointerEvent) {
      dragRef.current = { x: event.clientX, y: event.clientY };
    }
    function onPointerMove(event: PointerEvent) {
      const start = dragRef.current;
      if (!start) return;
      const dx = (event.clientX - start.x) * DRAG_SENSITIVITY;
      const dy = (event.clientY - start.y) * DRAG_SENSITIVITY;
      dragRef.current = { x: event.clientX, y: event.clientY };
      navigate({ dx, dz: dy });
    }
    function onPointerUp() {
      dragRef.current = null;
    }
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      navigate({ dz: event.deltaY > 0 ? ZOOM_STEP : -ZOOM_STEP });
    }
    stage.addEventListener('keydown', onKeyDown);
    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      stage.removeEventListener('keydown', onKeyDown);
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece?.public_id, piece?.engine]);

  if (!piece && !unavailable) return <p role="status">Loading immersive art piece…</p>;
  if (unavailable || !piece?.current_version)
    return (
      <div role="alert">
        <p>This art piece isn't available.</p>
        <Link to="/art-pieces/gallery">Back to public art pieces</Link>
      </div>
    );

  const isSpatial = SPATIAL_LIBRARIES.has(piece.engine);
  const immersiveHref = `/art-pieces/immersive/${piece.public_id}`;
  const isEmbedRoute = window.location.pathname.startsWith('/embed/art-pieces/immersive/');

  return (
    <section
      className="immersive-art-piece-viewer"
      aria-labelledby={isEmbedRoute ? undefined : 'immersive-art-piece-heading'}
      data-embed-route={isEmbedRoute || undefined}
    >
      {!isEmbedRoute && (
        <header>
          <h2 id="immersive-art-piece-heading">{piece.title}</h2>
          {isSpatial ? (
            <p role="note">
              Drag to look around, scroll to zoom, and use the arrow keys to travel through the
              piece. Use Reset in Piece controls to return home.
            </p>
          ) : (
            <p role="note" data-testid="navigation-unsupported">
              Walkable navigation isn't available for this piece's renderer.
            </p>
          )}
          {navigationError === 'no-camera-registered' && (
            <p role="status" data-testid="navigation-status">
              This piece hasn't set up a walkable camera yet.
            </p>
          )}
          <p>
            <button
              type="button"
              onClick={() => {
                setShowEmbedSnippet((current) => !current);
                setEmbedCopyStatus('idle');
              }}
              aria-expanded={showEmbedSnippet}
              data-testid="toggle-immersive-embed-snippet"
            >
              {showEmbedSnippet ? 'Hide embed code' : 'Embed'}
            </button>
          </p>
          {showEmbedSnippet && id && (
            <div
              className="immersive-art-piece-embed-snippet"
              data-testid="immersive-embed-snippet-panel"
            >
              <label htmlFor="immersive-art-piece-embed-snippet-textarea">
                Embed this immersive piece on another site
              </label>
              <textarea
                id="immersive-art-piece-embed-snippet-textarea"
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
        </header>
      )}
      <div
        ref={stageRef}
        className="art-piece-stage immersive-art-piece-stage"
        tabIndex={0}
        aria-label="Immersive stage"
      >
        <iframe
          ref={iframeRef}
          title="Immersive art piece preview"
          sandbox={ART_PIECE_IFRAME_SANDBOX}
          allow={ART_PIECE_IFRAME_ALLOW}
          srcDoc={buildArtPieceSandboxDocument(piece.current_version.source, piece.engine)}
          // Issue #434: a cross-document iframe captures pointer/wheel
          // input entirely within its own document -- it never bubbles
          // to this stage div no matter what the stage listens for.
          // Walkable navigation is stage-owned (keyboard/drag/wheel on
          // this outer div, translated into navigate-signal commands),
          // so a spatial piece's iframe must be pointer-transparent for
          // that capture to actually receive anything. Flat renderers
          // have no navigation to capture, so they keep normal
          // interactivity in case a generated piece responds to hover.
          // Issue #435: same default-iframe-border containment fix as
          // PublicArtPieceViewer.tsx -- a browser's default iframe
          // border adds to a content-box iframe's rendered size beyond
          // its 100% width, overflowing the stage by the border's width.
          style={{
            display: 'block',
            width: '100%',
            height: 640,
            border: 'none',
            pointerEvents: isSpatial ? 'none' : 'auto',
          }}
        />
        <PieceStageControls
          stageRef={stageRef}
          iframeRef={iframeRef}
          capabilities={piece.current_version.capabilities}
          immersiveHref={immersiveHref}
          library={piece.engine}
          source={piece.current_version.source}
          title={piece.title}
        />
      </div>
      {isSpatial && navigationPose && (
        <p data-testid="navigation-pose">
          {navigationPose.x.toFixed(2)},{navigationPose.y.toFixed(2)},{navigationPose.z.toFixed(2)}
        </p>
      )}
      {!isEmbedRoute && <Link to={`/art-pieces/p/${piece.public_id}`}>Back to regular viewer</Link>}
    </section>
  );
}

export default ImmersiveArtPieceViewer;

/**
 * Issue #776: the ink layer for generated 2D pieces (canvas2d, svg, p5.js, C2.js, C2.js Interactive).
 *
 * A standing sandboxed preview shows the current version with its saved ink composited over it. Asking
 * for a tool freezes the piece (a bare screenshot of the artwork becomes the drawing surface's backdrop)
 * and opens the shared ink editor; Confirm saves the marks as a NEW version whose source is unchanged, so
 * generated code is never edited and nothing untrusted runs in this frame. The sandbox stays an opaque
 * origin (`allow-scripts` only).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { createArtPieceVersion, type ArtPiece, type ArtPieceVersion } from '../api/artPieces';
import {
  ART_PIECE_IFRAME_SANDBOX,
  ART_PIECE_SANDBOX_MESSAGE_SOURCE,
  buildArtPieceSandboxDocument,
} from '../generative/artPieceSandbox';
import { captureArtPieceThumbnailFromSource } from '../generative/artPieceThumbnailCapture';
import { InkEditor } from '../ink/InkEditor';
import type { InkTool } from '../ink/inkModel';
import type { DrawingDocument, DrawingShape } from '../pages/scene3dTypes';
import PieceStageIcon from './PieceStageIcon';
import { screenshotFilename } from '../export/captureLiveScreenshot';

const MAX_INK_DIMENSION = 2048;
const SNAPSHOT_TIMEOUT_MS = 8000;

export type InkRequest = { tool: InkTool; nonce: number };

type Session = { snapshotUrl: string; width: number; height: number; tool: InkTool; color: string };
type InkPreviewMode = 'preview' | 'draw';

export function InkPreviewModeToggle({
  mode,
  drawDisabled,
  hasSession,
  onRequestDraw,
  onModeChange,
}: {
  mode: InkPreviewMode;
  drawDisabled: boolean;
  hasSession?: boolean;
  onRequestDraw?: () => void;
  onModeChange: (mode: InkPreviewMode) => void;
}) {
  return (
    <div className="generated-ink-mode" role="group" aria-label="Piece preview mode">
      <button
        type="button"
        data-testid="ink-mode-preview"
        aria-pressed={mode === 'preview'}
        className={mode === 'preview' ? 'is-active' : undefined}
        onClick={() => onModeChange('preview')}
      >
        Preview animation
      </button>
      <button
        type="button"
        data-testid="ink-mode-draw"
        aria-pressed={mode === 'draw'}
        className={mode === 'draw' ? 'is-active' : undefined}
        disabled={drawDisabled}
        aria-describedby={drawDisabled ? 'ink-mode-draw-reason' : undefined}
        onClick={() => {
          if (drawDisabled) return;
          if (mode !== 'draw' && hasSession) onModeChange('draw');
          else if (mode !== 'draw' && onRequestDraw) onRequestDraw();
          else onModeChange('draw');
        }}
      >
        Draw ink
      </button>
      {drawDisabled && (
        <span id="ink-mode-draw-reason" className="generated-ink-mode-reason">
          Choose an ink tool to start a drawing session.
        </span>
      )}
    </div>
  );
}

function fitInkSpace(width: number, height: number) {
  const scale = Math.min(1, MAX_INK_DIMENSION / Math.max(width, height));
  return {
    width: Math.max(16, Math.round(width * scale)),
    height: Math.max(16, Math.round(height * scale)),
  };
}

export default function GeneratedInkPanel({
  piece,
  request,
  onSaved,
  onRequestDraw,
  soundControls,
}: {
  piece: ArtPiece;
  request: InkRequest | null;
  onSaved: (version: ArtPieceVersion) => void;
  onRequestDraw?: () => void;
  soundControls?: ReactNode;
}) {
  const version = piece.current_version;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [mode, setMode] = useState<InkPreviewMode>('preview');
  const [inkColor, setInkColor] = useState('#1d4ed8');
  const handledNonce = useRef<number | null>(null);
  const inkColorRef = useRef(inkColor);
  inkColorRef.current = inkColor;
  const ink = version?.ink ?? null;

  // Start a session whenever the parent asks for a tool (each request has a fresh nonce).
  useEffect(() => {
    if (!request || handledNonce.current === request.nonce || !version) return;
    handledNonce.current = request.nonce;
    setMessage(null);
    const frame = iframeRef.current;
    if (!frame?.contentWindow) {
      setMessage('The piece is still loading. Try again in a moment.');
      return;
    }
    const target = frame.contentWindow;
    let done = false;
    const timeout = window.setTimeout(() => finish(null), SNAPSHOT_TIMEOUT_MS);
    function finish(dataUrl: string | null) {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      if (!dataUrl) {
        setMessage('Could not freeze this piece to draw on it. Try again once it has rendered.');
        return;
      }
      const image = new Image();
      image.onload = () => {
        const space = fitInkSpace(image.naturalWidth || 1280, image.naturalHeight || 720);
        setMode('draw');
        setSession({
          snapshotUrl: dataUrl,
          ...space,
          tool: request!.tool,
          color: inkColorRef.current,
        });
      };
      image.onerror = () => setMessage('Could not read the frozen frame of this piece.');
      image.src = dataUrl;
    }
    function onMessage(event: MessageEvent) {
      if (event.source !== target) return;
      const data = event.data as { source?: string; status?: string; data?: unknown } | null;
      if (data?.source !== ART_PIECE_SANDBOX_MESSAGE_SOURCE) return;
      if (data.status === 'screenshot' && typeof data.data === 'string') finish(data.data);
      else if (data.status === 'error') finish(null);
    }
    window.addEventListener('message', onMessage);
    // Bare artwork only: the editor draws the existing ink itself, so it must not be baked in twice.
    target.postMessage(
      {
        source: 'art-piece-parent',
        version: 1,
        type: 'screenshot',
        filename: 'ink-frame.png',
        includeInk: false,
      },
      '*',
    );
    return () => {
      done = true;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
  }, [request, version]);

  if (!version) return null;

  async function save(shapes: DrawingShape[]) {
    if (!session || !version) return;
    setSaving(true);
    setMessage(null);
    const document: DrawingDocument | null =
      shapes.length === 0
        ? null
        : { width: session.width, height: session.height, background: null, shapes };
    try {
      const created = await createArtPieceVersion(piece.public_id, {
        source: version.source,
        capabilities: version.capabilities,
        camera_placement: version.camera_placement ?? null,
        generation_metadata: { ink: document },
      });
      setSession(null);
      setMode('preview');
      onSaved(created);
      // #794: the new version's thumbnail shows the ink (best effort; the placeholder stays on failure).
      void captureArtPieceThumbnailFromSource(
        piece.public_id,
        created.id,
        created.source,
        piece.engine,
        created.ink ?? undefined,
      ).catch(() => undefined);
    } catch {
      setMessage('Could not save the ink layer. Your marks are still here; try again.');
    } finally {
      setSaving(false);
    }
  }

  function capturePreviewScreenshot() {
    const target = iframeRef.current?.contentWindow;
    if (!target || capturing) return;
    setCapturing(true);
    let done = false;
    const timeout = window.setTimeout(() => finish(null), SNAPSHOT_TIMEOUT_MS);
    async function finish(dataUrl: string | null) {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      setCapturing(false);
      if (!dataUrl) {
        setMessage('Could not capture the preview. Try again once it has rendered.');
        return;
      }
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = screenshotFilename(piece.title || piece.public_id);
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
      } catch {
        setMessage('Could not download the preview screenshot.');
      }
    }
    function onMessage(event: MessageEvent) {
      if (event.source !== target) return;
      const data = event.data as { source?: string; status?: string; data?: unknown } | null;
      if (data?.source !== ART_PIECE_SANDBOX_MESSAGE_SOURCE) return;
      if (data.status === 'screenshot' && typeof data.data === 'string') void finish(data.data);
      else if (data.status === 'error') void finish(null);
    }
    window.addEventListener('message', onMessage);
    target.postMessage(
      {
        source: 'art-piece-parent',
        version: 1,
        type: 'screenshot',
        filename: 'preview.png',
        includeInk: false,
      },
      '*',
    );
  }

  return (
    <section
      className="generated-ink-panel"
      aria-label="Ink layer"
      data-testid="generated-ink-panel"
    >
      <h3>Ink layer</h3>
      <p className="generated-ink-hint">
        {mode === 'draw'
          ? 'The piece is frozen while you draw. Your ink is kept separate from the generated source.'
          : 'Preview the authored animation here. Choose an ink tool above to enter the frozen drawing mode.'}
      </p>
      <div className="generated-ink-preview-controls">
        {mode === 'preview' && (
          <button
            type="button"
            className="piece-stage-button generated-ink-screenshot-button"
            aria-label="Take preview screenshot"
            title="Take preview screenshot"
            onClick={capturePreviewScreenshot}
            disabled={capturing}
          >
            <PieceStageIcon name="screenshot" />
            <span>{capturing ? 'Capturing…' : 'Screenshot'}</span>
          </button>
        )}
        {soundControls}
        <label className="generated-ink-color-control">
          <span>Ink color</span>
          <input
            type="color"
            aria-label="Ink color"
            value={inkColor}
            onChange={(event) => setInkColor(event.target.value)}
          />
        </label>
        <InkPreviewModeToggle
          mode={mode}
          drawDisabled={false}
          hasSession={Boolean(session)}
          onRequestDraw={onRequestDraw}
          onModeChange={setMode}
        />
      </div>
      {mode === 'preview' && session && (
        <p className="generated-ink-mode-note" role="status">
          Preview shows the last saved ink layer; your unsaved drawing remains available in Draw
          ink.
        </p>
      )}
      {message && (
        <p role="alert" data-testid="generated-ink-message">
          {message}
        </p>
      )}
      {session && (
        <div hidden={mode !== 'draw'}>
          <InkEditor
            width={session.width}
            height={session.height}
            initialShapes={ink?.shapes ?? []}
            snapshotUrl={session.snapshotUrl}
            initialTool={session.tool}
            initialColor={session.color}
            strokeIdPrefix="ink"
            onCancel={() => {
              setSession(null);
              setMode('preview');
            }}
            onConfirm={(shapes) => void save(shapes)}
          />
        </div>
      )}
      {saving && <p role="status">Saving ink layer…</p>}
      <iframe
        ref={iframeRef}
        title="Art piece with ink layer"
        data-testid="art-piece-ink-preview"
        sandbox={ART_PIECE_IFRAME_SANDBOX}
        srcDoc={buildArtPieceSandboxDocument(version.source, piece.engine, 'regular', { ink })}
        style={{
          width: '100%',
          height: 480,
          border: '1px solid #ccc',
          display: mode === 'preview' ? 'block' : 'none',
        }}
      />
    </section>
  );
}

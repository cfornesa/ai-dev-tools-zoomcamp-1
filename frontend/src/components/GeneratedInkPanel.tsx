/**
 * Issue #776: the ink layer for generated 2D pieces (canvas2d, svg, p5.js, C2.js, C2.js Interactive).
 *
 * A standing sandboxed preview shows the current version with its saved ink composited over it. Asking
 * for a tool freezes the piece (a bare screenshot of the artwork becomes the drawing surface's backdrop)
 * and opens the shared ink editor; Confirm saves the marks as a NEW version whose source is unchanged, so
 * generated code is never edited and nothing untrusted runs in this frame. The sandbox stays an opaque
 * origin (`allow-scripts` only).
 */
import { useEffect, useRef, useState } from 'react';

import { createArtPieceVersion, type ArtPiece, type ArtPieceVersion } from '../api/artPieces';
import {
  ART_PIECE_IFRAME_SANDBOX,
  ART_PIECE_SANDBOX_MESSAGE_SOURCE,
  buildArtPieceSandboxDocument,
} from '../generative/artPieceSandbox';
import { InkEditor } from '../ink/InkEditor';
import type { InkTool } from '../ink/inkModel';
import type { DrawingDocument, DrawingShape } from '../pages/scene3dTypes';

const MAX_INK_DIMENSION = 2048;
const SNAPSHOT_TIMEOUT_MS = 8000;

export type InkRequest = { tool: InkTool; nonce: number };

type Session = { snapshotUrl: string; width: number; height: number; tool: InkTool };

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
}: {
  piece: ArtPiece;
  request: InkRequest | null;
  onSaved: (version: ArtPieceVersion) => void;
}) {
  const version = piece.current_version;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const handledNonce = useRef<number | null>(null);
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
        setSession({ snapshotUrl: dataUrl, ...space, tool: request!.tool });
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
      onSaved(created);
    } catch {
      setMessage('Could not save the ink layer. Your marks are still here; try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="generated-ink-panel"
      aria-label="Ink layer"
      data-testid="generated-ink-panel"
    >
      <h3>Ink layer</h3>
      <p className="generated-ink-hint">
        Draw over this piece with the tools above. The piece is frozen while you draw, and its
        generated source is never changed.
      </p>
      {message && (
        <p role="alert" data-testid="generated-ink-message">
          {message}
        </p>
      )}
      {session && (
        <InkEditor
          width={session.width}
          height={session.height}
          initialShapes={ink?.shapes ?? []}
          snapshotUrl={session.snapshotUrl}
          initialTool={session.tool}
          strokeIdPrefix="ink"
          onCancel={() => setSession(null)}
          onConfirm={(shapes) => void save(shapes)}
        />
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
          display: session ? 'none' : 'block',
        }}
      />
    </section>
  );
}

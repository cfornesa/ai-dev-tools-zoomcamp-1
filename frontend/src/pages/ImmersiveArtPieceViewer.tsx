import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getPublicArtPiece, type ArtPiece } from '../api/artPieces';
import {
  ART_PIECE_IFRAME_SANDBOX,
  buildArtPieceSandboxDocument,
} from '../generative/artPieceSandbox';

function ImmersiveArtPieceViewer() {
  const { id } = useParams<{ id: string }>();
  const [piece, setPiece] = useState<ArtPiece | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!id) return;
    getPublicArtPiece(id)
      .then(setPiece)
      .catch(() => setUnavailable(true));
  }, [id]);
  if (!piece && !unavailable) return <p role="status">Loading immersive art piece…</p>;
  if (unavailable || !piece?.current_version)
    return (
      <div role="alert">
        <p>This art piece isn't available.</p>
        <Link to="/art-pieces/gallery">Back to public art pieces</Link>
      </div>
    );
  return (
    <section className="immersive-art-piece-viewer" aria-labelledby="immersive-art-piece-heading">
      <header>
        <h2 id="immersive-art-piece-heading">{piece.title}</h2>
        <p role="note">
          Drag to explore, scroll to zoom, and use arrow keys to move through the piece.
        </p>
      </header>
      <div ref={stageRef} className="art-piece-stage immersive-art-piece-stage" tabIndex={0}>
        <iframe
          title="Immersive art piece preview"
          sandbox={ART_PIECE_IFRAME_SANDBOX}
          srcDoc={buildArtPieceSandboxDocument(piece.current_version.source, piece.engine)}
          style={{ width: '100%', height: 640 }}
        />
      </div>
      <Link to={`/art-pieces/p/${piece.public_id}`}>Back to regular viewer</Link>
    </section>
  );
}

export default ImmersiveArtPieceViewer;

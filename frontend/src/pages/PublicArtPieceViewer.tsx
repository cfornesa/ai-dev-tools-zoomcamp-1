import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getPublicArtPiece, type ArtPiece } from '../api/artPieces';
import {
  ART_PIECE_IFRAME_ALLOW,
  ART_PIECE_IFRAME_SANDBOX,
  buildArtPieceSandboxDocument,
} from '../generative/artPieceSandbox';
import PieceStageControls from './PieceStageControls';

function PublicArtPieceViewer() {
  const { id } = useParams<{ id: string }>();
  const [piece, setPiece] = useState<ArtPiece | null>(null);
  const [error, setError] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (id)
      getPublicArtPiece(id)
        .then(setPiece)
        .catch(() => setError(true));
  }, [id]);
  if (!piece && !error) return <p role="status">Loading art piece…</p>;
  if (error || !piece?.current_version)
    return (
      <div role="alert">
        <p>This art piece isn't available.</p>
        <Link to="/art-pieces/gallery">Back to public art pieces</Link>
      </div>
    );
  return (
    <section aria-labelledby="public-art-piece-heading">
      <h2 id="public-art-piece-heading">{piece.title}</h2>
      <p>{piece.description}</p>
      <div ref={stageRef} className="art-piece-stage" aria-label="Art piece stage">
        <iframe
          ref={iframeRef}
          title="Art piece preview"
          sandbox={ART_PIECE_IFRAME_SANDBOX}
          allow={ART_PIECE_IFRAME_ALLOW}
          srcDoc={buildArtPieceSandboxDocument(piece.current_version.source, piece.engine)}
          style={{ width: '100%', height: 480 }}
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
      <Link to="/art-pieces/gallery">Back to public art pieces</Link>
    </section>
  );
}

export default PublicArtPieceViewer;

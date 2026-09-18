import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { fetchCanonicalPublicPiece } from '../api/profile';
import PublicArtPieceViewer from './PublicArtPieceViewer';

export default function CanonicalPublicPiece() {
  const { handle = '', pieceSlug = '' } = useParams<{ handle: string; pieceSlug: string }>();
  const [resolved, setResolved] = useState<Awaited<
    ReturnType<typeof fetchCanonicalPublicPiece>
  > | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    fetchCanonicalPublicPiece(handle.replace(/^@/, ''), pieceSlug)
      .then(setResolved)
      .catch(() => setMissing(true));
  }, [handle, pieceSlug]);
  if (missing) return <Navigate to="/gallery" replace />;
  if (!resolved) return <p role="status">Loading public piece…</p>;
  if (resolved.type === 'generated' && resolved.piece) {
    return <PublicArtPieceViewer initialPiece={resolved.piece} />;
  }
  return <Navigate to={resolved.viewer_url} replace />;
}

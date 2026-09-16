import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { fetchCanonicalPublicPiece } from '../api/profile';

export default function CanonicalPublicPiece() {
  const { handle = '', pieceSlug = '' } = useParams<{ handle: string; pieceSlug: string }>();
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    fetchCanonicalPublicPiece(handle.replace(/^@/, ''), pieceSlug)
      .then((piece) => setViewerUrl(piece.viewer_url))
      .catch(() => setMissing(true));
  }, [handle, pieceSlug]);
  if (missing) return <Navigate to="/gallery" replace />;
  if (!viewerUrl) return <p role="status">Loading public piece…</p>;
  return <Navigate to={viewerUrl} replace />;
}

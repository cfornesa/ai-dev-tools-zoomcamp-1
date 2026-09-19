import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchCanonicalPublicPiece, type CanonicalPublicPiece } from '../api/profile';
import ImmersiveArtPieceViewer from './ImmersiveArtPieceViewer';

export default function CanonicalImmersiveArtPiece() {
  const { handle = '', pieceSlug = '' } = useParams<{ handle: string; pieceSlug: string }>();
  const cleanHandle = handle.replace(/^@/, '');
  const [resolved, setResolved] = useState<CanonicalPublicPiece | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetchCanonicalPublicPiece(cleanHandle, pieceSlug)
      .then((response) => {
        if (response.type === 'generated' && response.piece) setResolved(response);
        else setMissing(true);
      })
      .catch(() => setMissing(true));
  }, [cleanHandle, pieceSlug]);

  if (missing) {
    return (
      <section role="alert">
        <p>This immersive piece isn’t available.</p>
        <Link to={`/users/@${cleanHandle}/pieces/${pieceSlug}`}>Back to regular view</Link>
      </section>
    );
  }
  if (!resolved?.piece) return <p role="status">Loading immersive art piece…</p>;
  return (
    <ImmersiveArtPieceViewer
      initialPiece={resolved.piece}
      canonicalHref={`/users/@${cleanHandle}/immersive/${pieceSlug}`}
      regularHref={`/users/@${cleanHandle}/pieces/${pieceSlug}`}
      editHref={resolved.edit_url}
    />
  );
}

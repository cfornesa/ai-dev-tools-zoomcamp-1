import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchCanonicalPublicPiece } from '../api/profile';
import ImmersiveArtPieceViewer from './ImmersiveArtPieceViewer';

export default function CanonicalImmersiveArtPiece() {
  const { handle = '', pieceSlug = '' } = useParams<{ handle: string; pieceSlug: string }>();
  const cleanHandle = handle.replace(/^@/, '');
  const [piece, setPiece] =
    useState<Awaited<ReturnType<typeof fetchCanonicalPublicPiece>>['piece']>(undefined);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetchCanonicalPublicPiece(cleanHandle, pieceSlug)
      .then((response) => {
        if (response.type === 'generated' && response.piece) setPiece(response.piece);
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
  if (!piece) return <p role="status">Loading immersive art piece…</p>;
  return (
    <ImmersiveArtPieceViewer
      initialPiece={piece}
      canonicalHref={`/users/@${cleanHandle}/immersive/${pieceSlug}`}
      regularHref={`/users/@${cleanHandle}/pieces/${pieceSlug}`}
    />
  );
}

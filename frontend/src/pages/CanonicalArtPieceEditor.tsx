import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchOwnerArtPiece } from '../api/profile';
import ArtPieceEditor from './ArtPieceEditor';

export default function CanonicalArtPieceEditor() {
  const { handle = '', pieceSlug = '' } = useParams<{ handle: string; pieceSlug: string }>();
  const [piece, setPiece] = useState<
    Awaited<ReturnType<typeof fetchOwnerArtPiece>>['piece'] | null
  >(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetchOwnerArtPiece(handle.replace(/^@/, ''), pieceSlug)
      .then((response) => setPiece(response.piece))
      .catch(() => setMissing(true));
  }, [handle, pieceSlug]);

  if (missing) {
    return (
      <section role="alert">
        <p>This art piece isn’t available.</p>
        <Link to="/art-pieces/manage">Back to your art pieces</Link>
      </section>
    );
  }
  if (!piece) return <p role="status">Loading art piece editor…</p>;
  return <ArtPieceEditor initialPiece={piece} />;
}

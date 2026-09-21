import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchOwnerArtPiece, type OwnerEditorPiece } from '../api/profile';
import ArtPieceEditor from './ArtPieceEditor';
import EditorWorkspace from './EditorWorkspace';
import Project3DWorkspace from './Project3DWorkspace';

export default function CanonicalArtPieceEditor() {
  const { handle = '', pieceSlug = '' } = useParams<{ handle: string; pieceSlug: string }>();
  const [piece, setPiece] = useState<OwnerEditorPiece | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetchOwnerArtPiece(handle.replace(/^@/, ''), pieceSlug)
      .then((response) => setPiece(response))
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
  if (piece.type === '2d') return <EditorWorkspace initialProjectId={piece.piece.id} />;
  if (piece.type === '3d') return <Project3DWorkspace initialProjectId={piece.piece.id} />;
  return <ArtPieceEditor initialPiece={piece.piece} />;
}

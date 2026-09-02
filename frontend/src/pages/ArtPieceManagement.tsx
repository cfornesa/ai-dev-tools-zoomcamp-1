import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listArtPieces, updateArtPiece, type ArtPiece } from '../api/artPieces';
import { useAuth } from '../auth/useAuth';

function ArtPieceManagement() {
  const auth = useAuth();
  const [pieces, setPieces] = useState<ArtPiece[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    listArtPieces()
      .then(setPieces)
      .catch(() => setError(true));
  }, [auth.status]);
  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in') return <p>Sign in to manage art pieces.</p>;
  if (error) return <p role="alert">We couldn't load your art pieces. Please try again.</p>;
  return (
    <section aria-labelledby="art-piece-management-heading">
      <h2 id="art-piece-management-heading">Your art pieces</h2>
      {pieces.length === 0 ? (
        <p>No saved art pieces yet.</p>
      ) : (
        <ul>
          {pieces.map((piece) => (
            <li key={piece.public_id}>
              <img src={piece.current_version?.thumbnail_url} alt="" width="160" height="120" />
              <Link to={`/art-pieces/p/${piece.public_id}`}>{piece.title}</Link>{' '}
              <span>{piece.status}</span>
              <select
                aria-label={`Status for ${piece.title}`}
                value={piece.status}
                onChange={(event) => {
                  updateArtPiece(piece.public_id, {
                    status: event.target.value as ArtPiece['status'],
                  })
                    .then((next) =>
                      setPieces((current) =>
                        current.map((item) => (item.public_id === next.public_id ? next : item)),
                      ),
                    )
                    .catch(() => setError(true));
                }}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </li>
          ))}
        </ul>
      )}
      <Link to="/art-pieces">Generate another piece</Link>
    </section>
  );
}

export default ArtPieceManagement;

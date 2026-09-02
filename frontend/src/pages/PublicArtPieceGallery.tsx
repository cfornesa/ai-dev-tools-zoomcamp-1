import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listPublicArtPieces, type ArtPiece } from '../api/artPieces';

function PublicArtPieceGallery() {
  const [pieces, setPieces] = useState<ArtPiece[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    listPublicArtPieces()
      .then(setPieces)
      .catch(() => setError(true));
  }, []);
  if (!pieces && !error) return <p role="status">Loading public art pieces…</p>;
  if (error) return <p role="alert">We couldn't load public art pieces. Please try again.</p>;
  return (
    <section aria-labelledby="public-art-piece-gallery-heading">
      <h2 id="public-art-piece-gallery-heading">Public art pieces</h2>
      {pieces?.length ? (
        <ul className="public-project-grid">
          {pieces.map((piece) => (
            <li key={piece.public_id}>
              <Link to={`/art-pieces/p/${piece.public_id}`}>
                <img src={piece.current_version?.thumbnail_url} alt="" width="320" height="240" />
                <span>{piece.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No public art pieces yet.</p>
      )}
    </section>
  );
}

export default PublicArtPieceGallery;

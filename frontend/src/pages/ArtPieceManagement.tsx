import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listArtPieces, updateArtPiece, type ArtPiece } from '../api/artPieces';
import { fetchProfile } from '../api/profile';
import { useAuth } from '../auth/useAuth';
import PieceCard from '../components/PieceCard';

function ArtPieceManagement() {
  const auth = useAuth();
  const [pieces, setPieces] = useState<ArtPiece[]>([]);
  const [error, setError] = useState(false);
  const [profileHandle, setProfileHandle] = useState<string | null>(null);
  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    listArtPieces()
      .then(setPieces)
      .catch(() => setError(true));
    fetchProfile()
      .then((profile) => setProfileHandle(profile.handle ?? auth.user.username))
      .catch(() => setProfileHandle(auth.user.username));
  }, [auth]);
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
              <PieceCard
                href={
                  profileHandle && piece.public_slug
                    ? `/users/@${profileHandle}/edit/${piece.public_slug}`
                    : `/art-pieces/${piece.public_id}/edit`
                }
                title={piece.title}
                thumbnailUrl={piece.current_version?.thumbnail_url}
                kind="generated"
                engine={piece.engine}
              />
              {piece.status === 'published' && (
                <Link
                  to={
                    profileHandle && piece.public_slug
                      ? `/users/@${profileHandle}/pieces/${piece.public_slug}`
                      : `/art-pieces/p/${piece.public_id}`
                  }
                >
                  View public page
                </Link>
              )}
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

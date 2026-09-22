import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listArtPieces, updateArtPiece, type ArtPiece } from '../api/artPieces';
import { fetchProfile } from '../api/profile';
import { useAuth } from '../auth/useAuth';
import PieceCard from '../components/PieceCard';
import { captureArtPieceThumbnailFromSource } from '../generative/artPieceThumbnailCapture';

function ArtPieceManagement() {
  const auth = useAuth();
  const [pieces, setPieces] = useState<ArtPiece[]>([]);
  const [error, setError] = useState(false);
  const [profileHandle, setProfileHandle] = useState<string | null>(null);
  const [isRefreshingThumbnails, setIsRefreshingThumbnails] = useState(false);
  const [thumbnailRefreshMessage, setThumbnailRefreshMessage] = useState<string | null>(null);
  const [thumbnailRefreshError, setThumbnailRefreshError] = useState<string | null>(null);
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

  const piecesNeedingThumbnails = pieces.filter(
    (piece) => piece.current_version?.thumbnail_is_fallback === true,
  );

  async function refreshThumbnails() {
    if (isRefreshingThumbnails || piecesNeedingThumbnails.length === 0) return;

    setIsRefreshingThumbnails(true);
    setThumbnailRefreshError(null);
    setThumbnailRefreshMessage(`Refreshing thumbnails… 0 of ${piecesNeedingThumbnails.length}`);

    let refreshed = 0;
    let failed = 0;
    for (const piece of piecesNeedingThumbnails) {
      const version = piece.current_version;
      if (!version) continue;

      let captured = false;
      try {
        captured = await captureArtPieceThumbnailFromSource(
          piece.public_id,
          version.id,
          version.source,
          piece.engine,
        );
      } catch {
        captured = false;
      }
      if (captured) refreshed += 1;
      else failed += 1;
      setThumbnailRefreshMessage(
        `Refreshing thumbnails… ${refreshed + failed} of ${piecesNeedingThumbnails.length}`,
      );
    }

    try {
      setPieces(await listArtPieces());
    } catch {
      setThumbnailRefreshError('Thumbnails refreshed, but the updated list could not be loaded.');
    }

    if (failed > 0) {
      setThumbnailRefreshError(
        `${refreshed} thumbnail${refreshed === 1 ? '' : 's'} refreshed; ${failed} could not be refreshed.`,
      );
      setThumbnailRefreshMessage(null);
    } else {
      setThumbnailRefreshMessage(
        `${refreshed} thumbnail${refreshed === 1 ? '' : 's'} refreshed successfully.`,
      );
    }
    setIsRefreshingThumbnails(false);
  }

  return (
    <section aria-labelledby="art-piece-management-heading">
      <h2 id="art-piece-management-heading">Your art pieces</h2>
      <button
        type="button"
        onClick={() => void refreshThumbnails()}
        disabled={isRefreshingThumbnails || piecesNeedingThumbnails.length === 0}
      >
        {isRefreshingThumbnails ? 'Refreshing thumbnails…' : 'Refresh thumbnails'}
      </button>
      <p>
        {piecesNeedingThumbnails.length === 0
          ? 'All current versions have thumbnails.'
          : `${piecesNeedingThumbnails.length} current version${
              piecesNeedingThumbnails.length === 1 ? '' : 's'
            } need${piecesNeedingThumbnails.length === 1 ? 's' : ''} a thumbnail.`}
      </p>
      {thumbnailRefreshMessage && <p role="status">{thumbnailRefreshMessage}</p>}
      {thumbnailRefreshError && <p role="alert">{thumbnailRefreshError}</p>}
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
                thumbnailIsFallback={piece.current_version?.thumbnail_is_fallback}
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

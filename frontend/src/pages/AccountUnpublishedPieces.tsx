import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { fetchMyUnpublishedPieces, type UnpublishedPiece } from '../api/unpublishedPieces';
import { useAuth } from '../auth/useAuth';

const KIND_LABEL: Record<UnpublishedPiece['kind'], string> = {
  project: '2D animation',
  project3d: '3D scene',
  art_piece: 'Generated piece',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Issue #944: everything the owner has unpublished that's still retained on
 * the server, across 2D/3D/generated pieces. Restoring a piece is simply
 * republishing it through its own editor's existing Publish control — this
 * page only surfaces what's retained and when it becomes purge-eligible.
 */
function AccountUnpublishedPieces() {
  const auth = useAuth();
  const [pieces, setPieces] = useState<UnpublishedPiece[] | null>(null);
  const [gracedays, setGraceDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    let cancelled = false;
    fetchMyUnpublishedPieces()
      .then((response) => {
        if (cancelled) return;
        setPieces(response.pieces);
        setGraceDays(response.unpublished_grace_days);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your retained unpublished pieces.');
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  if (auth.status === 'loading') return null;
  if (auth.status !== 'signed-in') return <Navigate to="/" replace />;

  return (
    <section className="content-panel" aria-label="Retained unpublished pieces">
      <p>
        <Link to="/account/settings">← Account settings</Link>
      </p>
      <h2>Retained unpublished pieces</h2>
      <p>
        Unpublishing a piece keeps its server copy intact and restorable for {gracedays ?? 30} days.
        Restore a piece by republishing it from its own editor before its retention window ends.
      </p>
      {error && <p role="alert">{error}</p>}
      {pieces === null && !error && <p role="status">Loading…</p>}
      {pieces && pieces.length === 0 && <p>You have no unpublished pieces awaiting purge.</p>}
      {pieces && pieces.length > 0 && (
        <ul className="account-unpublished-pieces-list">
          {pieces.map((piece) => (
            <li key={`${piece.kind}:${piece.public_id}`}>
              <span>{KIND_LABEL[piece.kind]}</span>
              {' — '}
              {piece.editor_url ? (
                <Link to={piece.editor_url}>{piece.title}</Link>
              ) : (
                <span>{piece.title}</span>
              )}
              <span>
                {' '}
                — unpublished {formatDate(piece.unpublished_at)}
                {piece.purge_eligible_at &&
                  `, retained until ${formatDate(piece.purge_eligible_at)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default AccountUnpublishedPieces;

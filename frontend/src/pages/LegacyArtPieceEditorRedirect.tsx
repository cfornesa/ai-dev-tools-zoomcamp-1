import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getArtPiece } from '../api/artPieces';
import { fetchProfile } from '../api/profile';

export default function LegacyArtPieceEditorRedirect() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveLegacyRoute() {
      try {
        const piece = await getArtPiece(id);
        const profile = await fetchProfile();
        if (!piece.public_slug || !profile.handle) throw new Error('Missing canonical owner URL');
        if (!cancelled) {
          navigate(
            `/users/@${encodeURIComponent(profile.handle)}/edit/${encodeURIComponent(piece.public_slug)}`,
            { replace: true },
          );
        }
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    }

    void resolveLegacyRoute();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  if (unavailable) {
    return (
      <section role="alert">
        <p>This art piece isn’t available.</p>
        <Link to="/studio?kind=generated">Back to your generated pieces</Link>
      </section>
    );
  }

  return <p role="status">Opening your piece editor…</p>;
}

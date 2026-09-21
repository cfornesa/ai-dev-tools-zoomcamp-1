import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  fetchCanonicalPublicPiece,
  fetchPublicProfile,
  type CanonicalPublicPiece,
  type PublicProfile,
} from '../api/profile';
import type { PublicProject3D } from '../api/projects3d';
import type { ArtPiece } from '../api/artPieces';
import ImmersiveArtPieceViewer from './ImmersiveArtPieceViewer';
import ImmersiveProject3DViewer from './ImmersiveProject3DViewer';

export default function CanonicalImmersiveStructuredPiece() {
  const { handle = '', pieceSlug = '' } = useParams<{ handle: string; pieceSlug: string }>();
  const cleanHandle = handle.replace(/^@/, '');
  const [resolved, setResolved] = useState<CanonicalPublicPiece | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetchCanonicalPublicPiece(cleanHandle, pieceSlug)
      .then((response) => {
        if (response.piece) setResolved(response);
        else setMissing(true);
      })
      .catch(() => setMissing(true));
  }, [cleanHandle, pieceSlug]);

  useEffect(() => {
    fetchPublicProfile(cleanHandle)
      .then((response) => setProfile(response.profile))
      .catch(() => setProfile(null));
  }, [cleanHandle]);

  if (missing) {
    return (
      <section role="alert">
        <p>This immersive piece isn’t available.</p>
        <Link to={`/users/@${cleanHandle}/pieces/${pieceSlug}`}>Back to regular view</Link>
      </section>
    );
  }
  if (!resolved?.piece) return <p role="status">Loading immersive piece…</p>;
  if (resolved.type === 'generated') {
    return (
      <ImmersiveArtPieceViewer
        initialPiece={resolved.piece as ArtPiece}
        canonicalHref={`/users/@${cleanHandle}/immersive/${pieceSlug}`}
        regularHref={`/users/@${cleanHandle}/pieces/${pieceSlug}`}
        editHref={resolved.edit_url}
      />
    );
  }
  if (resolved.type !== '3d') return <p role="alert">This immersive piece isn’t available.</p>;
  return (
    <ImmersiveProject3DViewer
      initialProject={resolved.piece as PublicProject3D}
      authorDisplayName={profile?.display_name}
      canonicalHref={`/users/@${cleanHandle}/immersive/${pieceSlug}`}
    />
  );
}

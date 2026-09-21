import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { fetchCanonicalPublicPiece, fetchPublicProfile, type PublicProfile } from '../api/profile';
import type { ArtPiece } from '../api/artPieces';
import type { PublicProject } from '../api/projects';
import type { PublicProject3D } from '../api/projects3d';
import PublicArtPieceViewer from './PublicArtPieceViewer';
import PublicProject3DViewer from './PublicProject3DViewer';
import PublicProjectViewer from './PublicProjectViewer';

export default function CanonicalPublicPiece() {
  const { handle = '', pieceSlug = '' } = useParams<{ handle: string; pieceSlug: string }>();
  const [resolved, setResolved] = useState<Awaited<
    ReturnType<typeof fetchCanonicalPublicPiece>
  > | null>(null);
  const [missing, setMissing] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  useEffect(() => {
    fetchCanonicalPublicPiece(handle.replace(/^@/, ''), pieceSlug)
      .then(setResolved)
      .catch(() => setMissing(true));
  }, [handle, pieceSlug]);
  useEffect(() => {
    if (!handle) return;
    fetchPublicProfile(handle.replace(/^@/, ''))
      .then((page) => setProfile(page.profile))
      .catch(() => setProfile(null));
  }, [handle]);
  if (missing) return <Navigate to="/gallery" replace />;
  if (!resolved) return <p role="status">Loading public piece…</p>;
  if (resolved.type === 'generated' && resolved.piece) {
    return (
      <PublicArtPieceViewer
        initialPiece={resolved.piece as ArtPiece}
        canonicalHref={resolved.canonical_url}
        editHref={resolved.edit_url}
      />
    );
  }
  if (resolved.type === '2d' && resolved.piece) {
    return (
      <PublicProjectViewer
        initialProject={resolved.piece as PublicProject}
        toolbarMode="inline"
        authorDisplayName={profile?.display_name}
      />
    );
  }
  if (resolved.type === '3d' && resolved.piece) {
    return (
      <PublicProject3DViewer
        initialProject={resolved.piece as PublicProject3D}
        toolbarMode="inline"
        authorDisplayName={profile?.display_name}
        immersiveHref={`/users/@${handle.replace(/^@/, '')}/immersive/${pieceSlug}`}
      />
    );
  }
  return <Navigate to={resolved.viewer_url} replace />;
}

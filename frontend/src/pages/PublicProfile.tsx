import { useEffect, useState, type CSSProperties } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { fetchPublicProfile, type PublicProfilePage } from '../api/profile';
import PieceCard from '../components/PieceCard';

export default function PublicProfile() {
  const { handle: rawHandle = '' } = useParams<{ handle: string }>();
  const handle = rawHandle.replace(/^@/, '');
  const navigate = useNavigate();
  const [data, setData] = useState<PublicProfilePage | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    fetchPublicProfile(handle)
      .then((nextData) => {
        setData(nextData);
        if (nextData.profile.handle && nextData.profile.handle !== handle) {
          navigate(`/users/@${encodeURIComponent(nextData.profile.handle)}`, { replace: true });
        }
      })
      .catch(() => setMissing(true));
  }, [handle, navigate]);
  if (missing) return <Navigate to="/" replace />;
  if (!data) return <p role="status">Loading profile…</p>;
  const theme = data.profile.theme_config;
  return (
    <section
      className="content-panel public-profile"
      style={
        {
          '--profile-background': theme.background,
          '--profile-surface': theme.surface,
          '--profile-text': theme.text,
          '--profile-muted': theme.muted,
          '--profile-accent': theme.accent,
          '--profile-font': profilePresentationFont(data.profile.presentation?.font_family),
          '--profile-radius': profileRadius(data.profile.presentation?.radius),
          '--profile-density': data.profile.presentation?.density === 'compact' ? '12px' : '20px',
          '--profile-border-style': data.profile.presentation?.border_style ?? 'solid',
        } as CSSProperties
      }
    >
      <div className="public-profile-heading">
        {data.profile.profile_image_url && <img src={data.profile.profile_image_url} alt="" />}
        <div>
          <h2>{data.profile.display_name || data.profile.handle}</h2>
          <p>@{data.profile.handle}</p>
          <p>{data.profile.bio}</p>
          {data.profile.website_url && (
            <a href={data.profile.website_url} rel="noreferrer">
              Website
            </a>
          )}
        </div>
      </div>
      <h3>Public pieces</h3>
      <div className="project-grid">
        {data.pieces.map((piece) => (
          <PieceCard
            key={`${piece.type}-${piece.id}`}
            href={
              piece.regular_url ??
              (piece.type === '2d'
                ? `/p/${piece.id}`
                : piece.type === '3d'
                  ? `/p3d/${piece.id}`
                  : `/art-pieces/p/${piece.id}`)
            }
            title={piece.title}
            thumbnailUrl={piece.thumbnail_url}
            kind={piece.type}
            engine={piece.engine}
          />
        ))}
      </div>
    </section>
  );
}

function profilePresentationFont(value: string | undefined): string {
  if (value === 'serif') return "Georgia, 'Times New Roman', serif";
  if (value === 'mono') return 'ui-monospace, Consolas, monospace';
  return "system-ui, 'Segoe UI', Roboto, sans-serif";
}

function profileRadius(value: string | undefined): string {
  if (value === 'sharp') return '2px';
  if (value === 'pill') return '999px';
  return '8px';
}

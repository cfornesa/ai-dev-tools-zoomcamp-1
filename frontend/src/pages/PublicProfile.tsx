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
  const collections = data.collections ?? [];
  const displayName = data.profile.display_name || data.profile.handle || 'Public profile';
  const socialLinks = Object.entries(data.profile.social_links ?? {}).filter(
    ([label, url]) => label.trim() && url.trim(),
  );
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
        {data.profile.profile_image_url && (
          <img src={data.profile.profile_image_url} alt={`${displayName} avatar`} />
        )}
        <div>
          <h2>{displayName}</h2>
          {data.profile.handle && <p className="public-profile-handle">@{data.profile.handle}</p>}
          {data.profile.bio && <p className="public-profile-bio">{data.profile.bio}</p>}
          {data.profile.website_url && (
            <a
              href={data.profile.website_url}
              rel="noopener noreferrer"
              target="_blank"
              className="public-profile-website"
            >
              {data.profile.website_url}
            </a>
          )}
          {socialLinks.length > 0 && (
            <nav className="public-profile-social" aria-label="Social links">
              {socialLinks.map(([label, url]) => (
                <a key={`${label}-${url}`} href={url} rel="noopener noreferrer" target="_blank">
                  {label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>
      {collections.length > 0 && (
        <section className="public-profile-section" aria-labelledby="public-profile-collections">
          <h3 id="public-profile-collections">Collections</h3>
          <div className="project-grid public-profile-card-grid">
            {collections.map((collection) => (
              <PieceCard
                key={collection.id}
                href={collection.viewer_url}
                title={collection.title}
                thumbnailUrl={collection.thumbnail_url}
                kind="collection"
                engine={`${collection.item_count} public ${collection.item_count === 1 ? 'piece' : 'pieces'}`}
                testId={`profile-collection-${collection.id}`}
              />
            ))}
          </div>
        </section>
      )}
      {data.pieces.length > 0 && (
        <section className="public-profile-section" aria-labelledby="public-profile-pieces">
          <h3 id="public-profile-pieces">Pieces</h3>
          <div className="project-grid public-profile-card-grid">
            {data.pieces.map((piece) => (
              <PieceCard
                key={`${piece.type}-${piece.id}`}
                href={piece.regular_url ?? `/users/@${handle}/pieces/${piece.slug ?? piece.id}`}
                title={piece.title}
                thumbnailUrl={piece.thumbnail_url}
                thumbnailIsFallback={piece.thumbnail_is_fallback}
                kind={piece.type}
                engine={piece.engine}
              />
            ))}
          </div>
        </section>
      )}
      {collections.length === 0 && data.pieces.length === 0 && (
        <p role="status">No public collections or pieces yet.</p>
      )}
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

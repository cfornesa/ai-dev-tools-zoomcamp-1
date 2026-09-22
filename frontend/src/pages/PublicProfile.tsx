import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { fetchPublicProfile, type PublicProfilePage } from '../api/profile';
import PieceCard from '../components/PieceCard';
import { profileStyleVars } from '../theme/profileStyle';

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
  const collections = data.collections ?? [];
  const displayName = data.profile.display_name || data.profile.handle || 'Public profile';
  const socialLinks = Object.entries(data.profile.social_links ?? {}).filter(
    ([label, url]) => label.trim() && url.trim(),
  );
  return (
    <section className="content-panel public-profile" style={profileStyleVars(data.profile)}>
      <div className="public-profile-heading">
        {data.profile.profile_image_url && (
          <img src={data.profile.profile_image_url} alt={`${displayName} avatar`} />
        )}
        <div>
          <h2>{displayName}</h2>
          {data.profile.handle && <p className="public-profile-handle">@{data.profile.handle}</p>}
          {data.profile.handle && (
            <Link className="public-profile-subscribe" to={`/users/@${data.profile.handle}/feeds`}>
              Subscribe to feeds
            </Link>
          )}
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
                description={piece.description}
                owner={piece.owner ?? displayName}
                publishedAt={piece.published_at}
                thumbnailUrl={piece.thumbnail_url}
                thumbnailIsFallback={piece.thumbnail_is_fallback}
                kind={piece.type}
                engine={piece.engine}
                testId={`profile-piece-${piece.id}`}
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

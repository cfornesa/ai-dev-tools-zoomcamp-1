import { useEffect, useState, type CSSProperties } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { fetchPublicProfile, type PublicProfilePage } from '../api/profile';

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
  return (
    <section
      className="content-panel public-profile"
      style={{ '--profile-accent': data.profile.theme_config.accent } as CSSProperties}
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
          <Link
            className="project-card"
            key={`${piece.type}-${piece.id}`}
            to={
              piece.type === '2d'
                ? `/p/${piece.id}`
                : piece.type === '3d'
                  ? `/p3d/${piece.id}`
                  : `/art-pieces/p/${piece.id}`
            }
          >
            <img src={piece.thumbnail_url} alt="" />
            <strong>{piece.title}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}

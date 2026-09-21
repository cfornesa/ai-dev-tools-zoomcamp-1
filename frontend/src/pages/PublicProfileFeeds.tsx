import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchPublicProfile, type PublicProfilePage } from '../api/profile';
import NotFound from './NotFound';

const FEED_FORMATS = [
  { name: 'Atom', suffix: 'feed.xml', type: 'application/atom+xml' },
  { name: 'RSS', suffix: 'feed.rss', type: 'application/rss+xml' },
  { name: 'JSON Feed', suffix: 'feed.json', type: 'application/feed+json' },
] as const;

export default function PublicProfileFeeds() {
  const { handle: rawHandle = '' } = useParams<{ handle: string }>();
  const handle = rawHandle.replace(/^@/, '');
  const [data, setData] = useState<PublicProfilePage | null>(null);
  const [missing, setMissing] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicProfile(handle)
      .then(setData)
      .catch(() => setMissing(true));
  }, [handle]);

  if (missing) return <NotFound />;
  if (!data) return <p role="status">Loading profile feeds…</p>;

  const displayName = data.profile.display_name || data.profile.handle || 'Public profile';
  const feedBase = `${window.location.origin}/users/@${encodeURIComponent(
    data.profile.handle || handle,
  )}`;
  const previews = data.pieces.slice(0, 5);

  async function copyFeedUrl(name: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedFormat(name);
    } catch {
      setCopiedFormat(null);
    }
  }

  return (
    <section className="content-panel public-profile-feeds" aria-labelledby="profile-feeds-title">
      <header className="profile-feeds-header">
        <p className="profile-feeds-kicker">
          <Link to={`/users/@${encodeURIComponent(data.profile.handle || handle)}`}>
            {displayName}
          </Link>
        </p>
        <h2 id="profile-feeds-title">Subscribe to {displayName}</h2>
        <p>Use any of these feeds to follow the latest public pieces.</p>
      </header>

      <section className="profile-feeds-subscribe" aria-labelledby="subscribe-heading">
        <h3 id="subscribe-heading">Subscribe</h3>
        <div className="profile-feed-list">
          {FEED_FORMATS.map((format) => {
            const url = `${feedBase}/${format.suffix}`;
            const copied = copiedFormat === format.name;
            return (
              <div className="profile-feed-row" key={format.name}>
                <div>
                  <h4>{format.name}</h4>
                  <code>{url}</code>
                </div>
                <div className="profile-feed-actions">
                  <button type="button" onClick={() => void copyFeedUrl(format.name, url)}>
                    Copy
                  </button>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    Open
                  </a>
                </div>
                {copied && (
                  <span className="profile-feed-confirmation" role="status" aria-live="polite">
                    {format.name} feed URL copied.
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="profile-feed-preview" aria-labelledby="preview-heading">
        <h3 id="preview-heading">Latest pieces</h3>
        {previews.length > 0 ? (
          <div className="profile-feed-preview-grid">
            {previews.map((piece) => (
              <article className="profile-feed-preview-card" key={`${piece.type}-${piece.id}`}>
                <Link
                  to={piece.regular_url ?? `/users/@${handle}/pieces/${piece.slug ?? piece.id}`}
                  aria-label={piece.title}
                >
                  <img src={piece.thumbnail_url} alt="" />
                  <h4>{piece.title}</h4>
                </Link>
                {piece.description && <p>{piece.description}</p>}
              </article>
            ))}
          </div>
        ) : (
          <p role="status">No public pieces yet.</p>
        )}
      </section>
    </section>
  );
}

import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchPublicCollection, type Collection, type CollectionItem } from '../api/collections';
import { fetchPublicProfile, type PublicProfile } from '../api/profile';
import { applyContentMetadata } from '../metadata';

function CollectionCard({ item }: { item: CollectionItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="public-collection-card">
      <Link to={item.viewer_url}>
        {item.thumbnail_url && !failed ? (
          <img
            src={item.thumbnail_url}
            alt={`Preview of ${item.title}`}
            onError={() => setFailed(true)}
          />
        ) : (
          <div role="img" aria-label={`No preview available for ${item.title}`}>
            No preview available
          </div>
        )}
        <h3>{item.title}</h3>
      </Link>
      <p>{item.label}</p>
    </article>
  );
}

export default function PublicCollection() {
  const { handle: rawHandle = '', collectionSlug = '' } = useParams<{
    handle: string;
    collectionSlug: string;
  }>();
  const handle = rawHandle.replace(/^@/, '');
  const [collection, setCollection] = useState<Collection | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    setState('loading');
    fetchPublicCollection(handle, collectionSlug)
      .then((next) => {
        setCollection(next);
        setState('ready');
      })
      .catch((error: unknown) => {
        setState(error instanceof Error && error.message.includes('404') ? 'missing' : 'error');
      });
    fetchPublicProfile(handle)
      .then((page) => setProfile(page.profile))
      .catch(() => undefined);
  }, [collectionSlug, handle]);
  useEffect(() => {
    if (collection)
      applyContentMetadata(
        collection.seo_config,
        collection.title,
        collection.description,
        window.location.href,
      );
  }, [collection]);

  if (state === 'loading') return <p role="status">Loading collection…</p>;
  if (state === 'missing') {
    return (
      <section className="content-panel" aria-labelledby="collection-not-found-heading">
        <h2 id="collection-not-found-heading">Collection not found</h2>
        <p>This collection is private, unavailable, or no longer exists.</p>
        <Link to="/gallery">Return to the public gallery</Link>
      </section>
    );
  }
  if (state === 'error' || !collection) {
    return (
      <section className="content-panel" aria-labelledby="collection-error-heading">
        <h2 id="collection-error-heading">Collection unavailable</h2>
        <p role="alert">We couldn’t load this collection. Please try again.</p>
      </section>
    );
  }

  return (
    <section
      className="content-panel public-collection"
      style={
        profile
          ? ({
              '--profile-background': profile.theme_config.background,
              '--profile-surface': profile.theme_config.surface,
              '--profile-text': profile.theme_config.text,
              '--profile-muted': profile.theme_config.muted,
              '--profile-accent': profile.theme_config.accent,
              '--profile-font':
                profile.presentation?.font_family === 'serif'
                  ? "Georgia, 'Times New Roman', serif"
                  : profile.presentation?.font_family === 'mono'
                    ? 'ui-monospace, Consolas, monospace'
                    : "system-ui, 'Segoe UI', Roboto, sans-serif",
              '--profile-radius':
                profile.presentation?.radius === 'sharp'
                  ? '2px'
                  : profile.presentation?.radius === 'pill'
                    ? '999px'
                    : '8px',
              '--profile-density': profile.presentation?.density === 'compact' ? '12px' : '20px',
              '--profile-border-style': profile.presentation?.border_style ?? 'solid',
            } as CSSProperties)
          : undefined
      }
      aria-labelledby="public-collection-heading"
    >
      <header>
        <p>
          <Link to={`/users/@${collection.handle ?? handle}`}>@{collection.handle ?? handle}</Link>
        </p>
        <h2 id="public-collection-heading">{collection.title}</h2>
        {collection.description && <p>{collection.description}</p>}
        <p>
          <Link to={`/users/@${collection.handle ?? handle}/${collection.slug}/immersive`}>
            Open immersive collection
          </Link>
        </p>
      </header>
      {collection.items.length === 0 ? (
        <p role="status">This collection has no public items yet.</p>
      ) : (
        <ol aria-label="Collection items" className="public-collection-grid">
          {collection.items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <CollectionCard item={item} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

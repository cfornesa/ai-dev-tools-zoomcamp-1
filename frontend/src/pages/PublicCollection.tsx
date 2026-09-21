import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';

import { fetchPublicCollection, type Collection, type CollectionItem } from '../api/collections';
import { fetchPublicProfile, type PublicProfile } from '../api/profile';
import { applyContentMetadata } from '../metadata';
import { profileStyleVars } from '../theme/profileStyle';

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
  const location = useLocation();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedCopyStatus, setEmbedCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

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
  }, [collectionSlug, handle, location.pathname]);

  useEffect(() => {
    if (collection)
      applyContentMetadata(
        collection.seo_config,
        collection.title,
        collection.description,
        window.location.href,
      );
  }, [collection]);

  if (collection && !location.pathname.includes('/collections/') && collection.canonical_url) {
    return <Navigate to={collection.canonical_url} replace />;
  }

  async function copyEmbed() {
    if (!collection?.embed_url) return;
    const snippet = `<iframe src="${window.location.origin}${collection.embed_url}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`;
    try {
      await navigator.clipboard.writeText(snippet);
      setEmbedCopyStatus('copied');
    } catch {
      setEmbedCopyStatus('failed');
    }
  }

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
      style={profile ? profileStyleVars(profile) : undefined}
      aria-labelledby="public-collection-heading"
    >
      <header>
        <p>
          <Link to={`/users/@${collection.handle ?? handle}`}>
            {profile?.display_name || `@${collection.handle ?? handle}`}
          </Link>
        </p>
        <h2 id="public-collection-heading">{collection.title}</h2>
        {collection.description && <p>{collection.description}</p>}
        <div className="public-collection-actions" aria-label="Collection actions">
          <button
            type="button"
            onClick={() => {
              setShowEmbed((current) => !current);
              setEmbedCopyStatus('idle');
            }}
            aria-expanded={showEmbed}
          >
            {showEmbed ? 'Hide embed code' : 'Embed'}
          </button>
          <Link
            to={
              collection.immersive_url ??
              `/users/@${handle}/collections/${collection.slug}/immersive`
            }
          >
            Open immersive collection
          </Link>
        </div>
        {showEmbed && collection.embed_url && (
          <div className="public-collection-embed-snippet">
            <label htmlFor="collection-embed-snippet">Embed this collection</label>
            <textarea
              id="collection-embed-snippet"
              readOnly
              value={`<iframe src="${window.location.origin}${collection.embed_url}" width="800" height="600" frameborder="0" allowfullscreen></iframe>`}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button type="button" onClick={() => void copyEmbed()}>
              Copy
            </button>
            {embedCopyStatus === 'copied' && <span role="status">Copied!</span>}
            {embedCopyStatus === 'failed' && (
              <span role="alert">Select the snippet and copy it manually.</span>
            )}
          </div>
        )}
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

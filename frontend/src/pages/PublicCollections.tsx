import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchPublicCollections, type PublicCollectionIndexItem } from '../api/collections';

type LoadState = 'loading' | 'error' | 'ready';

function PublicCollectionCard({ collection }: { collection: PublicCollectionIndexItem }) {
  const ownerLabel = collection.owner_handle ? `@${collection.owner_handle}` : 'Unknown creator';
  const accessibleName = `${collection.title} by ${ownerLabel}`;

  return (
    <article className="public-collections-card" aria-label={accessibleName}>
      {collection.viewer_url ? (
        <Link to={collection.viewer_url} aria-label={`Open ${accessibleName}`}>
          <h3>{collection.title}</h3>
        </Link>
      ) : (
        <h3>{collection.title}</h3>
      )}
      <p>{ownerLabel}</p>
      <p>{collection.item_count} public items</p>
    </article>
  );
}

export default function PublicCollections() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [collections, setCollections] = useState<PublicCollectionIndexItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const loadFirstPage = useCallback(() => {
    let cancelled = false;
    setLoadState('loading');
    setLoadMoreError(null);
    fetchPublicCollections()
      .then((page) => {
        if (cancelled) return;
        setCollections(page.results);
        setNextCursor(page.next_cursor);
        setHasMore(page.has_more);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadFirstPage(), [loadFirstPage]);

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await fetchPublicCollections(nextCursor);
      setCollections((current) => {
        const seenIds = new Set(current.map((collection) => collection.id));
        return [...current, ...page.results.filter((collection) => !seenIds.has(collection.id))];
      });
      setNextCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch {
      setLoadMoreError('Could not load more collections. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }

  if (loadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading public collections…
      </p>
    );
  }

  if (loadState === 'error') {
    return (
      <section className="content-panel" aria-labelledby="public-collections-error-heading">
        <h2 id="public-collections-error-heading">Public collections unavailable</h2>
        <p role="alert">We couldn’t load public collections. Please try again.</p>
        <button type="button" onClick={loadFirstPage}>
          Retry
        </button>
      </section>
    );
  }

  return (
    <section
      className="content-panel public-collections-panel"
      aria-labelledby="public-collections-heading"
    >
      <h2 id="public-collections-heading">Public collections</h2>
      {collections.length === 0 ? (
        <p role="status">No public collections yet. Check back soon.</p>
      ) : (
        <>
          <ul className="public-collections-grid" aria-label="Public collections list">
            {collections.map((collection) => (
              <li key={collection.id}>
                <PublicCollectionCard collection={collection} />
              </li>
            ))}
          </ul>
          {hasMore ? (
            <button type="button" onClick={() => void handleLoadMore()} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more collections'}
            </button>
          ) : (
            <p role="status" aria-live="polite">
              You&apos;ve reached the end of public collections.
            </p>
          )}
          {loadMoreError && <p role="alert">{loadMoreError}</p>}
        </>
      )}
    </section>
  );
}

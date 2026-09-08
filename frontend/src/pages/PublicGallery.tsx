import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  fetchPublicGallery,
  type PublicGalleryItem,
  type PublicGalleryType,
} from '../api/projects';

type InitialLoadState = 'loading' | 'error' | 'ready';

type LoadMoreState = {
  pending: boolean;
  error: string | null;
};

const GALLERY_TYPES: { value: PublicGalleryType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'authored', label: 'Authored' },
  { value: 'generated', label: 'Generated' },
];

const EMPTY_MESSAGES: Record<PublicGalleryType, string> = {
  all: 'No public pieces yet. Check back soon.',
  authored: 'No authored public pieces yet.',
  generated: 'No generated public pieces yet.',
};

function isValidType(value: string | null): value is PublicGalleryType {
  return value === 'all' || value === 'authored' || value === 'generated';
}

function typeBadge(item: PublicGalleryItem): string {
  if (item.kind === 'generated') return 'Generated';
  return item.kind === '3d' ? '3D' : '2D';
}

function GalleryCard({ item }: { item: PublicGalleryItem }) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const titleId = `gallery-item-${item.id}-title`;
  const showFallback = !item.thumbnail_url || thumbnailFailed;

  return (
    <article
      aria-labelledby={titleId}
      className="public-project-card"
      data-kind={item.kind}
      data-testid={`gallery-card-${item.id}`}
    >
      <Link to={item.viewer_url} className="public-project-card-link">
        {showFallback ? (
          <div
            className="public-project-thumbnail-fallback"
            role="img"
            aria-label={`No preview available for ${item.title}`}
          >
            No preview available
          </div>
        ) : (
          <img
            src={item.thumbnail_url ?? undefined}
            alt={`Preview of ${item.title}`}
            className="public-project-thumbnail"
            onError={() => setThumbnailFailed(true)}
          />
        )}

        <h3 id={titleId} data-testid={`gallery-card-title-${item.id}`}>
          {item.title}
        </h3>
        <span className="renderer-badge">{typeBadge(item)}</span>
        {item.kind === 'generated' && <span className="engine-label">{item.engine}</span>}
      </Link>
      <p className="public-project-attribution">By {item.owner}</p>
    </article>
  );
}

/**
 * Issue #491: the anonymous-reachable public gallery — a unified catalog of
 * published authored 2D/3D projects and generated art pieces, with a visible
 * type filter (All / Authored / Generated). The filter is a native `<select>`
 * labeled "Gallery type", synchronized two-way with the `type` query
 * parameter. The legacy `/art-pieces/gallery` route redirects here with
 * `type=generated`.
 */
function PublicGallery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const type: PublicGalleryType = isValidType(rawType) ? rawType : 'all';

  const [initialLoadState, setInitialLoadState] = useState<InitialLoadState>('loading');
  const [items, setItems] = useState<PublicGalleryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadMoreState, setLoadMoreState] = useState<LoadMoreState>({
    pending: false,
    error: null,
  });

  // Issue #491: recover from an invalid `type` query value by replacing it
  // with the documented default (`all`) without a blank or broken surface.
  useEffect(() => {
    if (!isValidType(rawType)) {
      setSearchParams({ type: 'all' }, { replace: true });
    }
  }, [rawType, setSearchParams]);

  const loadFirstPage = useCallback(() => {
    let cancelled = false;
    setInitialLoadState('loading');
    setLoadMoreState({ pending: false, error: null });
    fetchPublicGallery(type)
      .then((page) => {
        if (cancelled) return;
        setItems(page.results);
        setNextCursor(page.next_cursor);
        setHasMore(page.has_more);
        setInitialLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setInitialLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  useEffect(() => loadFirstPage(), [loadFirstPage]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadMoreState({ pending: true, error: null });
    try {
      const page = await fetchPublicGallery(type, { cursor: nextCursor });
      // De-duplicate defensively against a card already on screen (the
      // keyset cursor is designed not to produce one — see
      // scenes/gallery.py — but the UI never trusts that alone).
      setItems((current) => {
        const seenIds = new Set(current.map((item) => item.id));
        const newOnes = page.results.filter((item) => !seenIds.has(item.id));
        return [...current, ...newOnes];
      });
      setNextCursor(page.next_cursor);
      setHasMore(page.has_more);
      setLoadMoreState({ pending: false, error: null });
    } catch {
      setLoadMoreState({
        pending: false,
        error: 'Could not load more pieces. Please try again.',
      });
    }
  }

  function handleTypeChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (isValidType(value)) {
      setSearchParams({ type: value }, { replace: true });
    }
  }

  if (initialLoadState === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading the public gallery…
      </p>
    );
  }

  if (initialLoadState === 'error') {
    return (
      <div>
        <p role="alert" aria-live="assertive">
          We couldn't load the public gallery. Please try again.
        </p>
        <button type="button" onClick={loadFirstPage}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="public-gallery-heading">
      <h2 id="public-gallery-heading">Public gallery</h2>

      <div className="gallery-type-filter">
        <label htmlFor="gallery-type">Gallery type</label>
        <select
          id="gallery-type"
          value={type}
          onChange={handleTypeChange}
          aria-label="Gallery type"
        >
          {GALLERY_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <div>
          <p>{EMPTY_MESSAGES[type]}</p>
          {type !== 'all' && (
            <p>
              <Link to="/gallery">Show all gallery pieces</Link>
            </p>
          )}
        </div>
      ) : (
        <>
          <ul className="public-project-grid">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <GalleryCard item={item} />
              </li>
            ))}
          </ul>

          {hasMore ? (
            <button type="button" onClick={handleLoadMore} disabled={loadMoreState.pending}>
              {loadMoreState.pending ? 'Loading…' : 'Load more'}
            </button>
          ) : (
            <p role="status" aria-live="polite">
              You've reached the end of the public gallery.
            </p>
          )}

          {loadMoreState.error && (
            <p role="alert" aria-live="assertive">
              {loadMoreState.error}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default PublicGallery;

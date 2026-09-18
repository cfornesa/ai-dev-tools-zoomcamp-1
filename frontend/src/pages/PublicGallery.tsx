import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  fetchPublicGallery,
  searchPublicGallery,
  type PublicGalleryEngine,
  type PublicGalleryEngineOption,
  type PublicGalleryItem,
  type PublicGalleryType,
  type PublicGalleryAccountItem,
} from '../api/projects';
import PieceCard from '../components/PieceCard';

type InitialLoadState = 'loading' | 'error' | 'ready';

type LoadMoreState = {
  pending: boolean;
  error: string | null;
};

const GALLERY_TYPES: { value: PublicGalleryType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'collections', label: 'Collections' },
  { value: 'authored', label: 'Authored' },
  { value: 'generated', label: 'Generated' },
];

const EMPTY_MESSAGES: Record<PublicGalleryType, string> = {
  all: 'No public pieces yet. Check back soon.',
  authored: 'No authored public pieces yet.',
  pieces: 'No public pieces yet.',
  collections: 'No public collections yet.',
  generated: 'No generated public pieces yet.',
};

function isValidType(value: string | null): value is PublicGalleryType {
  return (
    value === 'all' ||
    value === 'pieces' ||
    value === 'collections' ||
    value === 'authored' ||
    value === 'generated'
  );
}

function isValidEngine(value: string | null): value is PublicGalleryEngine {
  return value === 'canvas2d' || value === 'svg' || value === 'threejs' || value === 'aframe';
}

function GalleryCard({ item }: { item: PublicGalleryItem | PublicGalleryAccountItem }) {
  if (item.kind === 'account') {
    return (
      <article className="public-project-card" data-kind="account">
        <Link to={item.viewer_url} className="public-project-card-link">
          <h3>{item.title}</h3>
          <span className="renderer-badge">Account</span>
        </Link>
      </article>
    );
  }

  return (
    <PieceCard
      href={item.viewer_url}
      title={item.title}
      thumbnailUrl={item.thumbnail_url}
      thumbnailIsFallback={item.kind === 'generated' ? item.thumbnail_is_fallback : false}
      kind={item.kind}
      engine={item.kind === 'generated' ? item.engine : undefined}
      owner={item.owner}
      testId={`gallery-card-${item.id}`}
    />
  );
}

/**
 * Issue #491/#565: the anonymous-reachable public gallery — a unified catalog
 * of published pieces and collections, with a visible type filter (All /
 * Pieces / Collections). The filter is a native `<select>`
 * labeled "Gallery type", synchronized two-way with the `type` query
 * parameter. The legacy `/art-pieces/gallery` route redirects here with
 * `type=generated`.
 */
function PublicGallery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const scope = searchParams.get('scope') === 'accounts' ? 'accounts' : 'content';
  const rawType = searchParams.get('type');
  const rawEngine = searchParams.get('engine');
  const type: PublicGalleryType = isValidType(rawType) ? rawType : 'all';
  const engine: PublicGalleryEngine | undefined = isValidEngine(rawEngine) ? rawEngine : undefined;

  const [initialLoadState, setInitialLoadState] = useState<InitialLoadState>('loading');
  const [items, setItems] = useState<Array<PublicGalleryItem | PublicGalleryAccountItem>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadMoreState, setLoadMoreState] = useState<LoadMoreState>({
    pending: false,
    error: null,
  });
  const [engineCatalog, setEngineCatalog] = useState<PublicGalleryEngineOption[]>([]);

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
    const request = query
      ? searchPublicGallery(query, scope).then((result) => ({
          results: result.results,
          next_cursor: null,
          has_more: false,
          engine_catalog: [],
        }))
      : engine
        ? fetchPublicGallery(type, { engine })
        : fetchPublicGallery(type);
    request
      .then((page) => {
        if (cancelled) return;
        setItems(page.results);
        setNextCursor(page.next_cursor);
        setHasMore(page.has_more);
        setEngineCatalog(page.engine_catalog ?? []);
        setInitialLoadState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setInitialLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [type, engine, query, scope]);

  useEffect(() => loadFirstPage(), [loadFirstPage]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadMoreState({ pending: true, error: null });
    try {
      const page = await fetchPublicGallery(type, {
        cursor: nextCursor,
        ...(engine ? { engine } : {}),
      });
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
      setSearchParams({ type: value, ...(engine ? { engine } : {}) }, { replace: true });
    }
  }

  function handleEngineChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setSearchParams(
      { type, ...(isValidEngine(value) ? { engine: value } : {}) },
      { replace: true },
    );
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem('gallery-search') as HTMLInputElement;
    setSearchParams(
      { type, scope, ...(input.value.trim() ? { q: input.value.trim() } : {}) },
      { replace: true },
    );
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
    <section
      className="content-panel public-gallery-panel"
      aria-labelledby="public-gallery-heading"
    >
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
        <label htmlFor="gallery-engine">Gallery engine</label>
        <select id="gallery-engine" value={engine ?? ''} onChange={handleEngineChange}>
          <option value="">All implemented engines</option>
          {engineCatalog.map((option) => (
            <option key={option.value} value={option.value} disabled={!option.available}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>
      </div>

      <form className="gallery-search" onSubmit={handleSearch} role="search">
        <label htmlFor="gallery-search">Search public gallery</label>
        <input
          id="gallery-search"
          name="gallery-search"
          type="search"
          defaultValue={query}
          maxLength={100}
        />
        <label htmlFor="gallery-search-scope">Search scope</label>
        <select
          id="gallery-search-scope"
          value={scope}
          onChange={(event) =>
            setSearchParams(
              {
                type,
                scope: event.target.value as 'accounts' | 'content',
                ...(query ? { q: query } : {}),
              },
              { replace: true },
            )
          }
        >
          <option value="content">Content</option>
          <option value="accounts">Accounts</option>
        </select>
        <button type="submit">Search</button>
      </form>

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

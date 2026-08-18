import { useCallback, useEffect, useState } from 'react';

import { listPublicGallery, type PublicGalleryProject } from '../api/projects';
import PublicProjectCard from '../components/PublicProjectCard';

type InitialLoadState = 'loading' | 'error' | 'ready';

type LoadMoreState = {
  pending: boolean;
  error: string | null;
};

/**
 * Task 50: the anonymous-reachable public gallery — every currently public
 * project, paginated. A sibling of Task 16's `Gallery.tsx` (the signed-in
 * "your own projects" shell), not a modification of it: that page shows a
 * different data set (`listProjects`, owner-scoped) and requires
 * authentication; this one shows `listPublicGallery` and works identically
 * for anonymous and signed-in visitors (see `PublicProjectListView`'s own
 * docstring in `scenes/api.py` for why the two are structurally identical
 * rather than "anonymous plus extras for owners").
 *
 * Out of scope (Task 51/issue #53, not yet built): cards are not
 * click-through to an interactive public project page — that page doesn't
 * exist yet. This page only lists.
 *
 * States: initial loading, initial-load error (with retry), empty (no
 * public projects at all), a populated list with a keyboard-operable
 * "Load more" action, a load-more-specific error (with retry, previously
 * loaded cards stay on screen), and a clear pagination-end state once
 * `has_more` is false.
 */
function PublicGallery() {
  const [initialLoadState, setInitialLoadState] = useState<InitialLoadState>('loading');
  const [projects, setProjects] = useState<PublicGalleryProject[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadMoreState, setLoadMoreState] = useState<LoadMoreState>({
    pending: false,
    error: null,
  });

  const loadFirstPage = useCallback(() => {
    let cancelled = false;
    setInitialLoadState('loading');
    listPublicGallery()
      .then((page) => {
        if (cancelled) return;
        setProjects(page.results);
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
  }, []);

  useEffect(() => loadFirstPage(), [loadFirstPage]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadMoreState({ pending: true, error: null });
    try {
      const page = await listPublicGallery({ cursor: nextCursor });
      // De-duplicate defensively against a card already on screen (the
      // keyset cursor is designed not to produce one — see
      // scenes/gallery.py — but the UI never trusts that alone).
      setProjects((current) => {
        const seenIds = new Set(current.map((p) => p.id));
        const newOnes = page.results.filter((p) => !seenIds.has(p.id));
        return [...current, ...newOnes];
      });
      setNextCursor(page.next_cursor);
      setHasMore(page.has_more);
      setLoadMoreState({ pending: false, error: null });
    } catch {
      setLoadMoreState({
        pending: false,
        error: 'Could not load more projects. Please try again.',
      });
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

      {projects.length === 0 ? (
        <p>No public projects yet. Check back soon.</p>
      ) : (
        <>
          <ul className="public-project-grid">
            {projects.map((project) => (
              <li key={project.id}>
                <PublicProjectCard project={project} />
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

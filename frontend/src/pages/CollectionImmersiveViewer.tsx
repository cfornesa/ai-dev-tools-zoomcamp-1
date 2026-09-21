import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchPublicCollection, type Collection, type CollectionItem } from '../api/collections';
import { useReducedMotion } from '../a11y/reducedMotion';

const LIVE_SLOT_BUDGET = 1;

function embedViewerUrl(item: CollectionItem): string | null {
  if (item.kind === 'project') return `/embed/p/${item.id}`;
  if (item.kind === 'project3d') return `/embed/p3d/${item.id}`;
  if (item.kind === 'art_piece') return `/embed/art-pieces/${item.id}`;
  if (item.viewer_url.startsWith('/p/')) return item.viewer_url.replace('/p/', '/embed/p/');
  if (item.viewer_url.startsWith('/p3d/')) return item.viewer_url.replace('/p3d/', '/embed/p3d/');
  if (item.viewer_url.startsWith('/art-pieces/p/')) {
    return item.viewer_url.replace('/art-pieces/p/', '/embed/art-pieces/');
  }
  return null;
}

function CollectionImmersiveViewer() {
  const { handle: rawHandle = '', collectionSlug = '' } = useParams<{
    handle: string;
    collectionSlug: string;
  }>();
  const handle = rawHandle.replace(/^@/, '');
  const { effective: reducedMotion } = useReducedMotion();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [activeIndex, setActiveIndex] = useState(0);
  const [captureState, setCaptureState] = useState<'idle' | 'saved' | 'unavailable'>('idle');
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setState('loading');
    setActiveIndex(0);
    fetchPublicCollection(handle, collectionSlug)
      .then((next) => {
        setCollection(next);
        setState('ready');
      })
      .catch((error: unknown) => {
        setState(error instanceof Error && error.message.includes('404') ? 'missing' : 'error');
      });
  }, [collectionSlug, handle]);

  const isEmbedRoute = window.location.pathname.startsWith('/embed/collections/');
  const items = collection?.items ?? [];
  const activeItem = items[activeIndex] ?? null;

  function move(offset: number) {
    if (items.length === 0) return;
    setCaptureState('idle');
    setActiveIndex((current) => (current + offset + items.length) % items.length);
  }

  function reset() {
    setCaptureState('idle');
    setActiveIndex(0);
    stageRef.current?.focus();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        reset();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  async function captureActive() {
    if (!activeItem?.thumbnail_url) {
      setCaptureState('unavailable');
      return;
    }
    try {
      const response = await fetch(activeItem.thumbnail_url, { credentials: 'include' });
      if (!response.ok) throw new Error('thumbnail unavailable');
      const blob = await response.blob();
      const image = new Image();
      image.src = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('thumbnail unavailable'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
      URL.revokeObjectURL(image.src);
      const link = document.createElement('a');
      link.download = `${activeItem.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setCaptureState('saved');
    } catch {
      setCaptureState('unavailable');
    }
  }

  if (state === 'loading') return <p role="status">Loading immersive collection…</p>;
  if (state === 'missing') {
    return (
      <section className="content-panel" aria-labelledby="collection-immersive-not-found">
        <h2 id="collection-immersive-not-found">Collection not found</h2>
        <p>This collection is private, unavailable, or no longer exists.</p>
        <Link to="/gallery">Return to the public gallery</Link>
      </section>
    );
  }
  if (state === 'error' || !collection) {
    return <p role="alert">We couldn’t load this immersive collection.</p>;
  }

  return (
    <section
      className={`collection-immersive-viewer${reducedMotion ? ' collection-immersive-reduced' : ''}`}
      aria-labelledby={isEmbedRoute ? undefined : 'collection-immersive-heading'}
      data-live-slot-budget={LIVE_SLOT_BUDGET}
      data-embed-route={isEmbedRoute || undefined}
    >
      {!isEmbedRoute && (
        <header>
          <p>
            <Link to={`/users/@${collection.handle ?? handle}/collections/${collection.slug}`}>
              Back to collection
            </Link>
          </p>
          <h2 id="collection-immersive-heading">{collection.title}</h2>
          <p role="note">
            Use the arrow keys or controls to move through this collection. Home or Reset returns to
            the first item.
          </p>
        </header>
      )}

      <div className="collection-immersive-controls" aria-label="Collection navigation">
        <button type="button" onClick={() => move(-1)} disabled={items.length < 2}>
          Previous
        </button>
        <span aria-live="polite">
          {activeItem ? `${activeIndex + 1} of ${items.length}: ${activeItem.title}` : 'No items'}
        </span>
        <button type="button" onClick={() => move(1)} disabled={items.length < 2}>
          Next
        </button>
        <button type="button" onClick={reset} disabled={items.length === 0}>
          Reset
        </button>
        <button type="button" onClick={() => void captureActive()} disabled={!activeItem}>
          Capture
        </button>
      </div>
      {captureState === 'saved' && <p role="status">Capture saved.</p>}
      {captureState === 'unavailable' && (
        <p role="alert">A capture is unavailable for this item.</p>
      )}

      <div
        ref={stageRef}
        className="collection-immersive-stage"
        tabIndex={0}
        aria-label="Immersive collection stage"
      >
        {activeItem && embedViewerUrl(activeItem) ? (
          <iframe
            key={`${activeItem.kind}-${activeItem.id}`}
            title={`Live view of ${activeItem.title}`}
            src={embedViewerUrl(activeItem) ?? undefined}
            loading="eager"
            allow="fullscreen; camera; microphone"
            style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
          />
        ) : (
          <div className="collection-immersive-placeholder" role="status">
            This collection item cannot be rendered here.
          </div>
        )}
      </div>
    </section>
  );
}

export default CollectionImmersiveViewer;

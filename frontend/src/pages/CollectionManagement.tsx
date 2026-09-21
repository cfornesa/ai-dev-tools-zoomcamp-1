import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import {
  createCollection,
  deleteCollection,
  fetchCollections,
  replaceCollectionItems,
  setCollectionPublished,
  updateCollection,
  type Collection,
  type CollectionItem,
} from '../api/collections';

const ITEM_KINDS: Array<CollectionItem['kind']> = ['project', 'project3d', 'art_piece'];

export default function CollectionManagement() {
  const auth = useAuth();
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publicSlug, setPublicSlug] = useState('');
  const [kind, setKind] = useState<CollectionItem['kind']>('project');
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-in') return;
    fetchCollections()
      .then((next) => {
        setCollections(next);
        setSelectedId(next[0]?.id ?? null);
      })
      .catch(() => setError('Could not load your collections.'));
  }, [auth.status]);

  const selected = useMemo(
    () => collections?.find((collection) => collection.id === selectedId) ?? null,
    [collections, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setDescription(selected.description);
    setPublicSlug(selected.slug);
  }, [selected]);

  if (auth.status === 'loading') return <p role="status">Loading collections…</p>;
  if (auth.status !== 'signed-in') return <Navigate to="/" replace />;
  if (collections === null) return <p role="status">Loading collections…</p>;

  function replaceLocal(next: Collection) {
    setCollections((current) => current?.map((item) => (item.id === next.id ? next : item)) ?? []);
  }

  async function run(action: () => Promise<Collection>, success: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await action();
      replaceLocal(next);
      setMessage(success);
    } catch {
      setError('That collection change could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!title.trim()) {
      setError('Enter a collection title first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await createCollection(title, description);
      setCollections((current) => [...(current ?? []), next]);
      setSelectedId(next.id);
      setMessage('Collection created.');
    } catch {
      setError('Could not create that collection.');
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails() {
    if (!selected) return;
    await run(
      () => updateCollection(selected.id, { title, description, public_slug: publicSlug }),
      'Collection details saved.',
    );
  }

  async function changeItems(items: CollectionItem[]) {
    if (!selected) return;
    await run(
      () =>
        replaceCollectionItems(
          selected.id,
          items.map(({ kind: itemKind, id }) => ({ kind: itemKind, id })),
        ),
      'Collection order saved.',
    );
  }

  async function addItem(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !itemId.trim()) return;
    await changeItems([...selected.items, { kind, id: itemId.trim() } as CollectionItem]);
    setItemId('');
  }

  async function removeItem(item: CollectionItem) {
    if (!selected) return;
    await changeItems(
      selected.items.filter(
        (candidate) => candidate.id !== item.id || candidate.kind !== item.kind,
      ),
    );
  }

  async function moveItem(index: number, offset: -1 | 1) {
    if (!selected) return;
    const next = [...selected.items];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await changeItems(next);
  }

  async function togglePublished() {
    if (!selected) return;
    await run(
      () => setCollectionPublished(selected.id, selected.visibility !== 'public'),
      selected.visibility === 'public' ? 'Collection unpublished.' : 'Collection published.',
    );
  }

  async function removeCollection() {
    if (!selected || !window.confirm(`Delete “${selected.title}”?`)) return;
    setBusy(true);
    try {
      await deleteCollection(selected.id);
      const remaining = (collections ?? []).filter((item) => item.id !== selected.id);
      setCollections(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setMessage('Collection moved to trash.');
    } catch {
      setError('Could not delete that collection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-panel collection-management" aria-labelledby="collections-heading">
      <h2 id="collections-heading">My collections</h2>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="collection-management-layout">
        <aside aria-label="Your collections">
          <h3>Collections</h3>
          {collections.length === 0 ? (
            <p>No collections yet.</p>
          ) : (
            <ul>
              {collections.map((collection) => (
                <li key={collection.id}>
                  <button
                    type="button"
                    aria-pressed={collection.id === selectedId}
                    onClick={() => setSelectedId(collection.id)}
                  >
                    {collection.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div>
          <form
            aria-label={selected ? 'Edit collection' : 'Create collection'}
            onSubmit={(event) => {
              event.preventDefault();
              void (selected ? saveDetails() : create());
            }}
          >
            <h3>{selected ? 'Edit collection' : 'Create collection'}</h3>
            <label htmlFor="collection-title">Title</label>
            <input
              id="collection-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <label htmlFor="collection-description">Description</label>
            <textarea
              id="collection-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            {selected && (
              <>
                <label htmlFor="collection-public-slug">Public URL slug</label>
                <input
                  id="collection-public-slug"
                  value={publicSlug}
                  onChange={(event) => setPublicSlug(event.target.value)}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </>
            )}
            <button type="submit" disabled={busy}>
              {selected ? 'Save details' : 'Create collection'}
            </button>
          </form>
          {selected && (
            <>
              <section aria-labelledby="collection-items-heading">
                <h3 id="collection-items-heading">Ordered items</h3>
                {selected.items.length === 0 && <p>No items in this collection yet.</p>}
                <ol>
                  {selected.items.map((item, index) => (
                    <li key={`${item.kind}-${item.id}`}>
                      <span>
                        {item.title || item.id} ({item.label})
                      </span>
                      <button
                        type="button"
                        disabled={busy || index === 0}
                        aria-label={`Move ${item.id} up`}
                        onClick={() => void moveItem(index, -1)}
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        disabled={busy || index === selected.items.length - 1}
                        aria-label={`Move ${item.id} down`}
                        onClick={() => void moveItem(index, 1)}
                      >
                        Move down
                      </button>
                      <button type="button" disabled={busy} onClick={() => void removeItem(item)}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ol>
                <form aria-label="Add collection item" onSubmit={(event) => void addItem(event)}>
                  <label htmlFor="collection-item-kind">Item type</label>
                  <select
                    id="collection-item-kind"
                    value={kind}
                    onChange={(event) => setKind(event.target.value as CollectionItem['kind'])}
                  >
                    {ITEM_KINDS.map((itemKind) => (
                      <option key={itemKind} value={itemKind}>
                        {itemKind}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="collection-item-id">Item public ID</label>
                  <input
                    id="collection-item-id"
                    value={itemId}
                    onChange={(event) => setItemId(event.target.value)}
                    placeholder="UUID of a published item"
                  />
                  <button type="submit" disabled={busy || !itemId.trim()}>
                    Add item
                  </button>
                </form>
              </section>
              <div className="collection-management-actions">
                <button type="button" disabled={busy} onClick={() => void togglePublished()}>
                  {selected.visibility === 'public' ? 'Unpublish collection' : 'Publish collection'}
                </button>
                <button type="button" disabled={busy} onClick={() => void removeCollection()}>
                  Delete collection
                </button>
                {selected.visibility === 'public' && selected.handle && (
                  <a href={`/users/@${selected.handle}/collections/${selected.slug}`}>
                    View public collection
                  </a>
                )}
              </div>
              <details>
                <summary>Online collection snapshot</summary>
                <pre>{JSON.stringify(selected, null, 2)}</pre>
              </details>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

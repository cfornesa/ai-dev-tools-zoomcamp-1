import { apiFetch } from './client';
import type { SeoConfig } from './adminPages';

export type CollectionItem = {
  kind: 'project' | 'project3d' | 'art_piece';
  id: string;
  position: number;
  title: string;
  viewer_url: string;
  thumbnail_url: string | null;
  label: string;
  /** Issue #944: only present in the owner's own (non-public) management
   * view — true when this item is currently unpublished/retained and so
   * doesn't appear in the public collection right now. */
  is_hidden_from_public?: boolean;
};

export type Collection = {
  id: string;
  title: string;
  description: string;
  slug: string;
  handle: string | null;
  owner: string;
  owner_handle?: string | null;
  visibility: 'private' | 'public';
  status?: 'active' | 'draft' | 'archived';
  comments_enabled?: boolean;
  comments?: CollectionComment[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
  items: CollectionItem[];
  seo_config?: SeoConfig;
  canonical_url?: string | null;
  immersive_url?: string | null;
  embed_url?: string | null;
  download_url?: string | null;
  cover: CollectionCover | null;
  cover_url: string | null;
};

export type CollectionCover = {
  piece_kind: '2d' | '3d' | 'generated';
  piece_public_id: string;
  asset_id: string;
  filename: string;
  mime_type: string;
  url: string | null;
};

export type CollectionCoverAsset = Omit<CollectionCover, 'url'>;

export type CollectionComment = {
  id: number;
  body: string;
  author: string;
  created_at: string;
};

export type PublicCollectionIndexItem = {
  id: string;
  title: string;
  owner_handle: string | null;
  cover_url: string | null;
  item_count: number;
  published_at: string;
  viewer_url: string | null;
};

export type PublicCollectionIndexPage = {
  results: PublicCollectionIndexItem[];
  next_cursor: string | null;
  has_more: boolean;
};

export type PublicCollectionSort = 'newest' | 'oldest' | 'item_count';

export function fetchPublicCollections(
  cursor?: string,
  sort: PublicCollectionSort = 'newest',
): Promise<PublicCollectionIndexPage> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (sort !== 'newest') params.set('sort', sort);
  const query = params.toString();
  return apiFetch<PublicCollectionIndexPage>(`/api/collections/public/${query ? `?${query}` : ''}`);
}

export function fetchCollections() {
  return apiFetch<Collection[]>('/api/account/collections/');
}

export function fetchCollectionCoverAssets() {
  return apiFetch<CollectionCoverAsset[]>('/api/account/collections/cover-assets/');
}

export function createCollection(title: string, description = '') {
  return apiFetch<Collection>('/api/account/collections/', {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  });
}

export function updateCollection(
  id: string,
  values: {
    title?: string;
    description?: string;
    public_slug?: string;
    status?: Collection['status'];
    comments_enabled?: boolean;
    cover?: CollectionCoverAsset | null;
  },
) {
  return apiFetch<Collection>(`/api/account/collections/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(values),
  });
}

export function deleteCollection(id: string) {
  return apiFetch<void>(`/api/account/collections/${id}/`, { method: 'DELETE' });
}

export function replaceCollectionItems(
  id: string,
  items: Array<Pick<CollectionItem, 'kind' | 'id'>>,
) {
  return apiFetch<Collection>(`/api/account/collections/${id}/items/`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export function setCollectionPublished(id: string, published: boolean) {
  return apiFetch<Collection>(
    `/api/account/collections/${id}/${published ? 'publish' : 'unpublish'}/`,
    { method: 'POST' },
  );
}

export function fetchPublicCollection(handle: string, slug: string) {
  return apiFetch<Collection>(`/api/public/collections/${encodeURIComponent(handle)}/${slug}/`);
}

export function postCollectionComment(handle: string, slug: string, body: string) {
  return apiFetch<CollectionComment>(
    `/api/public/collections/${encodeURIComponent(handle)}/${slug}/comments/`,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
}

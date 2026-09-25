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
};

export type Collection = {
  id: string;
  title: string;
  description: string;
  slug: string;
  handle: string | null;
  owner: string;
  visibility: 'private' | 'public';
  published_at: string | null;
  created_at: string;
  updated_at: string;
  items: CollectionItem[];
  seo_config?: SeoConfig;
  canonical_url?: string | null;
  immersive_url?: string | null;
  embed_url?: string | null;
  download_url?: string | null;
};

export function fetchCollections() {
  return apiFetch<Collection[]>('/api/account/collections/');
}

export function createCollection(title: string, description = '') {
  return apiFetch<Collection>('/api/account/collections/', {
    method: 'POST',
    body: JSON.stringify({ title, description }),
  });
}

export function updateCollection(
  id: string,
  values: { title?: string; description?: string; public_slug?: string },
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

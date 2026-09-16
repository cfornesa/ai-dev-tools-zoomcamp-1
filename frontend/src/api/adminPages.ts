import { apiFetch } from './client';

export type CmsPage = {
  id: number;
  title: string;
  slug: string;
  description: string;
  status: 'draft' | 'published';
  nav_label: string;
  show_in_nav: boolean;
  sort_order: number;
  system_key: string | null;
  author: string | null;
  revision: number;
  updated_at: string;
  updated_by: string | null;
  seo_config: SeoConfig;
};

export type SeoConfig = {
  title: string;
  description: string;
  canonical_policy: 'self' | 'none';
  indexing: 'index' | 'noindex';
  og_title: string;
  og_description: string;
  og_image_url: string;
  twitter_card: 'summary' | 'summary_large_image';
  answer_summary: string;
  structured_data: Record<string, unknown>;
};

export type CmsPageFields = Omit<
  CmsPage,
  'id' | 'author' | 'revision' | 'updated_at' | 'updated_by'
>;

export function fetchAdminPages(): Promise<CmsPage[]> {
  return apiFetch<CmsPage[]>('/api/admin/pages/');
}

export function createAdminPage(fields: CmsPageFields): Promise<CmsPage> {
  return apiFetch<CmsPage>('/api/admin/pages/', {
    method: 'POST',
    body: JSON.stringify(fields),
  });
}

export function updateAdminPage(
  id: number,
  revision: number,
  fields: Partial<CmsPageFields>,
): Promise<CmsPage> {
  return apiFetch<CmsPage>(`/api/admin/pages/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ ...fields, revision }),
  });
}

export function deleteAdminPage(id: number, revision: number): Promise<void> {
  return apiFetch<void>(`/api/admin/pages/${id}/`, {
    method: 'DELETE',
    body: JSON.stringify({ revision }),
  });
}

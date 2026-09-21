import { apiFetch } from './client';
import type { SeoConfig } from './adminPages';

export type PublicPageNavigation = {
  id: number;
  title: string;
  slug: string;
  nav_label: string;
  sort_order: number;
};

export type PublicPage = PublicPageNavigation & {
  description: string;
  seo_config: SeoConfig;
};

export function fetchPublicPageNavigation(): Promise<PublicPageNavigation[]> {
  return apiFetch<PublicPageNavigation[]>('/api/pages/');
}

export function fetchPublicPage(slug: string): Promise<PublicPage> {
  return apiFetch<PublicPage>(`/api/pages/${encodeURIComponent(slug)}/`);
}

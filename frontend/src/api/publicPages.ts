import { apiFetch } from './client';

export type PublicPageNavigation = {
  id: number;
  title: string;
  slug: string;
  nav_label: string;
  sort_order: number;
};

export function fetchPublicPageNavigation(): Promise<PublicPageNavigation[]> {
  return apiFetch<PublicPageNavigation[]>('/api/pages/');
}

import { apiFetch } from './client';

export type AdminContentRow = {
  resource_type: string;
  resource_id: string;
  title: string;
  description?: string;
  owner: string;
  status: string;
  updated_at: string;
  deleted: boolean;
  version_count: number | null;
  project_id?: string;
  byte_size?: number;
};

export type AdminContentAction = {
  resource_type: 'project' | 'project3d' | 'art_piece';
  resource_id: string;
  action: 'publish' | 'unpublish' | 'restore' | 'delete';
};

export type AdminAccessEntry = {
  user_id: number;
  username: string;
  verified_email: string | null;
  providers: string[];
  granted: boolean;
  changed?: boolean;
};

export function fetchAdminContent(options: { query?: string; account?: string } = {}) {
  const params = new URLSearchParams();
  if (options.query) params.set('q', options.query);
  if (options.account) params.set('account', options.account);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<AdminContentRow[]>(`/api/admin/content/${suffix}`);
}

export function applyAdminContentAction(action: AdminContentAction) {
  return apiFetch<AdminContentRow>('/api/admin/content/actions/', {
    method: 'POST',
    body: JSON.stringify(action),
  });
}

export function setAdminAccess(username: string, granted: boolean) {
  return apiFetch<AdminAccessEntry>('/api/admin/content/access/', {
    method: 'POST',
    body: JSON.stringify({ identifier: username, granted }),
  });
}

export function fetchAdminAccess() {
  return apiFetch<AdminAccessEntry[]>('/api/admin/content/access/');
}

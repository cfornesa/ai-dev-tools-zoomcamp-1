import { apiFetch } from './client';

export type AdminContentRow = {
  resource_type: string;
  resource_id: string;
  title: string;
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

export function fetchAdminContent() {
  return apiFetch<AdminContentRow[]>('/api/admin/content/');
}

export function applyAdminContentAction(action: AdminContentAction) {
  return apiFetch<AdminContentRow>('/api/admin/content/actions/', {
    method: 'POST',
    body: JSON.stringify(action),
  });
}

export function setAdminAccess(username: string, granted: boolean) {
  return apiFetch<{ username: string; granted: boolean }>('/api/admin/content/access/', {
    method: 'POST',
    body: JSON.stringify({ username, granted }),
  });
}

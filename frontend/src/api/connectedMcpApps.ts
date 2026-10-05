import { apiFetch } from './client';

export type ConnectedMcpApp = {
  id: number;
  name: string;
  scopes: string[];
  last_authorized: string;
};

export function fetchConnectedMcpApps(): Promise<ConnectedMcpApp[]> {
  return apiFetch('/api/account/connected-apps/');
}

export function revokeConnectedMcpApp(applicationId: number): Promise<{ revoked: boolean }> {
  return apiFetch(`/api/account/connected-apps/${applicationId}/`, { method: 'DELETE' });
}

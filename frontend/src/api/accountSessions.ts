import { apiFetch } from './client';

export type AccountSession = {
  public_id: string;
  is_current: boolean;
  user_agent: string;
  created_at: string | null;
  expires_at: string;
};

export type RevokeSessionResult = {
  revoked: boolean;
  was_current: boolean;
};

export async function fetchAccountSessions(): Promise<AccountSession[]> {
  return apiFetch<AccountSession[]>('/api/account/sessions/');
}

export async function revokeAccountSession(publicId: string): Promise<RevokeSessionResult> {
  return apiFetch<RevokeSessionResult>(`/api/account/sessions/${encodeURIComponent(publicId)}/`, {
    method: 'DELETE',
  });
}

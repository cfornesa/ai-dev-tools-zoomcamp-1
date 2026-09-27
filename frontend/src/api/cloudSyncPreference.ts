import { apiFetch } from './client';

export type CloudSyncPreference = {
  eligible: boolean;
  reason: string | null;
  source: string;
  enabled: boolean;
  signup_preselected: boolean;
  consent_version: string;
  consent_text: string;
  existing_local_pieces_offered_by: string;
  retention_days_after_disable: number;
};

export function fetchCloudSyncPreference(): Promise<CloudSyncPreference> {
  return apiFetch<CloudSyncPreference>('/api/account/cloud-sync/');
}

export function updateCloudSyncPreference(
  enabled: boolean,
  consent: Pick<CloudSyncPreference, 'consent_version' | 'consent_text'>,
): Promise<CloudSyncPreference> {
  return apiFetch<CloudSyncPreference>('/api/account/cloud-sync/', {
    method: 'PUT',
    body: JSON.stringify({ enabled, ...consent }),
  });
}

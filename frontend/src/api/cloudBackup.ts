import { apiFetch } from './client';

export type CloudBackupStatus = {
  enabled: boolean;
  paused: boolean;
  read_only: boolean;
  revision: number;
};

export function fetchCloudBackup(projectId: string): Promise<CloudBackupStatus> {
  return apiFetch<CloudBackupStatus>(`/api/projects/${projectId}/cloud-backup/`);
}

export function setCloudBackupAction(
  projectId: string,
  action: 'enable' | 'pause',
): Promise<CloudBackupStatus> {
  return apiFetch<CloudBackupStatus>(`/api/projects/${projectId}/cloud-backup/`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

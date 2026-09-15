import { apiFetch } from './client';

export type CloudBackupStatus = {
  enabled: boolean;
  paused: boolean;
  read_only: boolean;
  retention_state: 'active' | 'deleted' | 'entitlement_expired' | 'sync_disabled';
  retain_until: string | null;
  revision: number;
  // Issue #530: the plan-resolved scheduled-snapshot policy, so a client
  // can silently decide for itself whether the next snapshot is due --
  // the server never pushes a snapshot on its own.
  snapshot_cadence_days: number;
  snapshot_archive_enabled: boolean;
  last_snapshot_at: string | null;
};

export type CloudBackupManifestAsset = { id: string; checksum: string; byte_size: number };

export type CloudBackupManifestPayload = {
  project_id: string;
  scenes: Array<{ id: string; [key: string]: unknown }>;
  assets: CloudBackupManifestAsset[];
};

export type CloudBackupManifestResponse = {
  revision: number;
  checksum: string;
  manifest: CloudBackupManifestPayload;
};

export function putCloudBackupManifest(
  projectId: string,
  fields: { revision: number; idempotency_key: string; manifest: CloudBackupManifestPayload },
): Promise<CloudBackupManifestResponse> {
  return apiFetch<CloudBackupManifestResponse>(
    `/api/projects/${projectId}/cloud-backup/manifest/`,
    {
      method: 'PUT',
      body: JSON.stringify(fields),
    },
  );
}

export function putCloudBackupAsset(
  projectId: string,
  assetId: string,
  data: BodyInit,
  fields: { checksum: string; mimeType: string; idempotencyKey: string },
): Promise<{ asset_id: string; checksum: string; byte_size: number }> {
  return apiFetch(`/api/projects/${projectId}/cloud-backup/assets/${assetId}/`, {
    method: 'PUT',
    body: data,
    headers: {
      'Content-Type': fields.mimeType,
      'X-Asset-Checksum': fields.checksum,
      'X-Asset-Mime-Type': fields.mimeType,
      'X-Idempotency-Key': fields.idempotencyKey,
    },
  });
}

export type CloudBackupAssetChunkResponse = {
  asset_id: string;
  checksum: string;
  byte_size: number;
  complete: boolean;
  acknowledged_ranges: Array<{ start: number; end: number }>;
};

export function putCloudBackupAssetChunk(
  projectId: string,
  assetId: string,
  data: BodyInit,
  fields: {
    start: number;
    end: number;
    byteLength: number;
    checksum: string;
    mimeType: string;
    idempotencyKey: string;
  },
): Promise<CloudBackupAssetChunkResponse> {
  return apiFetch<CloudBackupAssetChunkResponse>(
    `/api/projects/${projectId}/cloud-backup/assets/${assetId}/chunks/`,
    {
      method: 'PUT',
      body: data,
      headers: {
        'Content-Type': fields.mimeType,
        'Content-Range': `bytes ${fields.start}-${fields.end - 1}/${fields.byteLength}`,
        'X-Asset-Checksum': fields.checksum,
        'X-Asset-Mime-Type': fields.mimeType,
        'X-Idempotency-Key': fields.idempotencyKey,
      },
    },
  );
}

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

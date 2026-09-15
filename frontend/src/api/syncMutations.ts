import { apiFetch } from './client';
import type { MutationOutboxRecord } from '../storage/mutationOutbox';

export type SyncMutationAcknowledgement = {
  acknowledged: true;
  replayed: boolean;
  operation_id: string;
  server_operation_id: string;
  client_sequence: number;
  payload_checksum: string;
  acknowledged_at: string;
};

/**
 * Authenticated transport for one durable outbox operation (#543).
 *
 * The server endpoint is intentionally separate from cloud-backup snapshots:
 * it acknowledges an operation identity and retains its payload for the
 * later deterministic merge/rebase stages. Network errors remain ordinary
 * rejected promises so the outbox can apply its bounded retry policy.
 */
export function sendSyncMutation(
  operation: MutationOutboxRecord,
): Promise<SyncMutationAcknowledgement> {
  return apiFetch<SyncMutationAcknowledgement>(
    `/api/projects/${operation.projectId}/sync/mutations/`,
    {
      method: 'POST',
      body: JSON.stringify({
        project_id: operation.projectId,
        scene_id: operation.sceneId,
        operation_id: operation.operationId,
        client_sequence: operation.clientSequence,
        kind: operation.kind,
        payload: operation.payload,
        payload_checksum: operation.payloadChecksum,
        schema_version: operation.schemaVersion,
        dependency_operation_ids: operation.dependencyOperationIds,
        client_created_at: operation.createdAt,
      }),
    },
  );
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendSyncMutation } from './syncMutations';
import type { MutationOutboxRecord } from '../storage/mutationOutbox';

const originalFetch = globalThis.fetch;

describe('sendSyncMutation', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends the durable operation identity to the authenticated endpoint', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          acknowledged: true,
          replayed: false,
          operation_id: 'op-1',
          server_operation_id: '7',
          client_sequence: 2,
          payload_checksum: 'a'.repeat(64),
          acknowledged_at: '2026-09-15T19:30:00Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const operation = {
      operationId: 'op-1',
      ownerId: 'owner-1',
      projectId: 'project-1',
      kind: 'scene',
      payload: { value: 1 },
      payloadChecksum: 'a'.repeat(64),
      schemaVersion: 1,
      clientSequence: 2,
      dependencyOperationIds: ['dependency-1'],
      createdAt: '2026-09-15T19:30:00Z',
      state: 'in-flight',
      attemptCount: 1,
      nextAttemptAt: '2026-09-15T19:30:00Z',
      lastErrorCode: null,
      acknowledgedAt: null,
    } satisfies MutationOutboxRecord;

    await expect(sendSyncMutation(operation)).resolves.toMatchObject({
      acknowledged: true,
      replayed: false,
    });
    const [url, request] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('/api/projects/project-1/sync/mutations/');
    expect(JSON.parse(String(request?.body))).toMatchObject({
      operation_id: 'op-1',
      client_sequence: 2,
      dependency_operation_ids: ['dependency-1'],
    });
  });
});

import { describe, expect, it } from 'vitest';

import {
  createConflictResolutionOperation,
  mergeSyncSnapshots,
  stableMergeFingerprint,
} from './conflictMerge';

const context = {
  baseVersion: 'scene-version-7',
  localOperationIds: ['local-1'],
  remoteOperationIds: ['remote-1'],
};

describe('deterministic hybrid conflict merge', () => {
  it('merges independent scene, metadata, and stable-ID media edits', () => {
    const base = {
      metadata: { title: 'Untitled', description: '' },
      scenes: [{ id: 'scene-a', title: 'A', media: [{ id: 'media-a', href: 'a.png' }] }],
    };
    const local = {
      metadata: { title: 'Local title', description: '' },
      scenes: [{ id: 'scene-a', title: 'A', media: [{ id: 'media-a', href: 'a.png' }] }],
    };
    const remote = {
      metadata: { title: 'Untitled', description: 'Remote description' },
      scenes: [
        {
          id: 'scene-a',
          title: 'A',
          media: [
            { id: 'media-a', href: 'a.png' },
            { id: 'media-b', href: 'b.png' },
          ],
        },
      ],
    };

    const result = mergeSyncSnapshots(base, local, remote, context);

    expect(result.conflicts).toEqual([]);
    expect(result.merged).toEqual({
      metadata: { title: 'Local title', description: 'Remote description' },
      scenes: [
        {
          id: 'scene-a',
          title: 'A',
          media: [
            { id: 'media-a', href: 'a.png' },
            { id: 'media-b', href: 'b.png' },
          ],
        },
      ],
    });
  });

  it('records overlapping artwork edits instead of using last-write-wins', () => {
    const base = { scenes: [{ id: 'scene-a', objects: [{ id: 'shape-1', x: 10 }] }] };
    const local = { scenes: [{ id: 'scene-a', objects: [{ id: 'shape-1', x: 20 }] }] };
    const remote = { scenes: [{ id: 'scene-a', objects: [{ id: 'shape-1', x: 30 }] }] };

    const result = mergeSyncSnapshots(base, local, remote, context);

    expect(result.merged).toEqual(base);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      path: 'scenes[scene-a].objects[shape-1].x',
      base: 10,
      local: 20,
      remote: 30,
      affectedIdentities: ['shape-1'],
      context,
    });
  });

  it('produces the same canonical fingerprint regardless of object key order', () => {
    expect(stableMergeFingerprint({ z: 1, a: { y: 2, x: 3 } })).toBe(
      stableMergeFingerprint({ a: { x: 3, y: 2 }, z: 1 }),
    );
  });

  it('creates an auditable idempotent resolution payload for an explicit choice', () => {
    const result = mergeSyncSnapshots({ value: 1 }, { value: 2 }, { value: 3 }, context);
    const operation = createConflictResolutionOperation(result, 'compose', context, { value: 4 });

    expect(operation).toMatchObject({
      kind: 'scene',
      baseVersion: 'scene-version-7',
      choice: 'compose',
      resolvedPayload: { value: 4 },
      audit: {
        conflictPaths: ['value'],
        localOperationIds: ['local-1'],
        remoteOperationIds: ['remote-1'],
      },
    });
    expect(operation.operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

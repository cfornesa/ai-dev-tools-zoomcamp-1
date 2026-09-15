/** Deterministic hybrid three-way merge primitives for offline sync (#544).
 *
 * The merge is deliberately conservative: unchanged sides are adopted, equal
 * edits are deduplicated, stable-ID collections are merged by identity, and
 * every other overlap becomes an auditable conflict.  No artwork-bearing
 * record is resolved by arrival time or last-write-wins.
 */

export type MergeOperationContext = {
  baseVersion: string;
  localOperationIds: string[];
  remoteOperationIds: string[];
};

export type MergeConflict = {
  path: string;
  base: unknown;
  local: unknown;
  remote: unknown;
  affectedIdentities: string[];
  context: MergeOperationContext;
};

export type MergeResult = {
  merged: unknown;
  conflicts: MergeConflict[];
};

export type ConflictResolutionChoice = 'keep-local' | 'keep-remote' | 'compose';

export type ConflictResolutionOperation = {
  operationId: string;
  kind: 'scene' | 'metadata' | 'media-reference';
  baseVersion: string;
  choice: ConflictResolutionChoice;
  resolvedPayload: unknown;
  audit: {
    conflictPaths: string[];
    localOperationIds: string[];
    remoteOperationIds: string[];
  };
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
    .join(',')}}`;
}

function equal(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStableIdCollection(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && typeof item.id === 'string' && item.id.length > 0)
  );
}

function pathFor(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function conflict(
  path: string,
  base: unknown,
  local: unknown,
  remote: unknown,
  context: MergeOperationContext,
  identity?: string,
): MergeConflict {
  return {
    path: path || '$',
    base,
    local,
    remote,
    affectedIdentities: identity ? [identity] : [],
    context: {
      baseVersion: context.baseVersion,
      localOperationIds: [...context.localOperationIds],
      remoteOperationIds: [...context.remoteOperationIds],
    },
  };
}

function mergeValue(
  base: unknown,
  local: unknown,
  remote: unknown,
  path: string,
  context: MergeOperationContext,
  identity?: string,
): MergeResult {
  if (equal(local, remote)) return { merged: local, conflicts: [] };
  if (equal(local, base)) return { merged: remote, conflicts: [] };
  if (equal(remote, base)) return { merged: local, conflicts: [] };

  if (isStableIdCollection(base) && isStableIdCollection(local) && isStableIdCollection(remote)) {
    const byId = (items: Array<Record<string, unknown>>) =>
      new Map(items.map((item) => [item.id as string, item]));
    const baseById = byId(base);
    const localById = byId(local);
    const remoteById = byId(remote);
    const ids = [...new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()])].sort(
      (left, right) => left.localeCompare(right),
    );
    const merged: Array<Record<string, unknown>> = [];
    const conflicts: MergeConflict[] = [];
    for (const id of ids) {
      const result = mergeValue(
        baseById.get(id),
        localById.get(id),
        remoteById.get(id),
        `${path}[${id}]`,
        context,
        id,
      );
      if (result.merged !== undefined) merged.push(result.merged as Record<string, unknown>);
      conflicts.push(...result.conflicts);
    }
    return { merged, conflicts };
  }

  if (isRecord(base) && isRecord(local) && isRecord(remote)) {
    const keys = [
      ...new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]),
    ].sort((left, right) => left.localeCompare(right));
    const merged: Record<string, unknown> = {};
    const conflicts: MergeConflict[] = [];
    for (const key of keys) {
      const result = mergeValue(
        base[key],
        local[key],
        remote[key],
        pathFor(path, key),
        context,
        identity,
      );
      if (result.merged !== undefined) merged[key] = result.merged;
      conflicts.push(...result.conflicts);
    }
    return { merged, conflicts };
  }

  return { merged: base, conflicts: [conflict(path, base, local, remote, context, identity)] };
}

export function mergeSyncSnapshots(
  base: unknown,
  local: unknown,
  remote: unknown,
  context: MergeOperationContext,
): MergeResult {
  return mergeValue(base, local, remote, '', context);
}

export function stableMergeFingerprint(value: unknown): string {
  return stableJson(value);
}

export function createConflictResolutionOperation(
  conflictResult: MergeResult,
  choice: ConflictResolutionChoice,
  context: MergeOperationContext,
  resolvedPayload: unknown,
): ConflictResolutionOperation {
  if (conflictResult.conflicts.length === 0) {
    throw new Error('A conflict resolution operation requires at least one conflict.');
  }
  return {
    operationId: crypto.randomUUID(),
    kind: 'scene',
    baseVersion: context.baseVersion,
    choice,
    resolvedPayload,
    audit: {
      conflictPaths: conflictResult.conflicts.map((item) => item.path).sort(),
      localOperationIds: [...context.localOperationIds],
      remoteOperationIds: [...context.remoteOperationIds],
    },
  };
}

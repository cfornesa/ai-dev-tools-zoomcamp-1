/** Stable, bounded summaries for comparing validated 2D scene versions (#1136). */
import { LIMITS, validateScene } from '../validation/scene';

const MAX_ITEMS = 50;
const MAX_SCENE_BYTES = LIMITS.maxScenePayloadBytes;
const PROPERTY_DEPTH_LIMIT = 12;

type JsonRecord = Record<string, unknown>;
type ChangedEntity = { id: string; properties: string[] };
type EntityList<T> = { count: number; items: T[]; omitted: number };
type EntityChanges = {
  added: EntityList<{ id: string }>;
  removed: EntityList<{ id: string }>;
  changed: EntityList<ChangedEntity>;
};
type LayerChanges = {
  added: EntityList<{ id: string }>;
  removed: EntityList<{ id: string }>;
  reordered: EntityList<{ id: string; from: number; to: number }>;
  renamed: EntityList<{ id: string; from: string; to: string }>;
};

export type SceneDiffSummary = {
  ok: true;
  shapes: EntityChanges;
  layers: LayerChanges;
  groups: EntityChanges;
  bindings: EntityChanges;
  canvas: { changed: boolean; properties: string[] };
};

export type SceneDiffError = {
  ok: false;
  error: { code: 'invalid_scene' | 'scene_too_large'; message: string };
};

export type SceneDiffResult = SceneDiffSummary | SceneDiffError;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function jsonBytes(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return null;
    return new TextEncoder().encode(serialized).byteLength;
  } catch {
    return null;
  }
}

function validateInput(value: unknown): SceneDiffError | null {
  const bytes = jsonBytes(value);
  if (bytes === null) {
    return { ok: false, error: { code: 'invalid_scene', message: 'Scene must be JSON data.' } };
  }
  if (bytes > MAX_SCENE_BYTES) {
    return {
      ok: false,
      error: { code: 'scene_too_large', message: `Scene exceeds ${MAX_SCENE_BYTES} bytes.` },
    };
  }
  try {
    if (!validateScene(value).valid) {
      return {
        ok: false,
        error: { code: 'invalid_scene', message: 'Scene does not match the scene schema.' },
      };
    }
  } catch {
    return {
      ok: false,
      error: { code: 'invalid_scene', message: 'Scene could not be validated.' },
    };
  }
  return null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function changedPaths(left: unknown, right: unknown, prefix = '', depth = 0): string[] {
  if (stableJson(left) === stableJson(right)) return [];
  if (depth >= PROPERTY_DEPTH_LIMIT || !isRecord(left) || !isRecord(right)) {
    return [prefix || '$'];
  }
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  return keys.flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!(key in left) || !(key in right)) return [path];
    return changedPaths(left[key], right[key], path, depth + 1);
  });
}

function cappedList<T>(values: T[]): EntityList<T> {
  return {
    count: values.length,
    items: values.slice(0, MAX_ITEMS),
    omitted: Math.max(0, values.length - MAX_ITEMS),
  };
}

function byId(values: unknown): Map<string, JsonRecord> {
  if (!Array.isArray(values)) return new Map();
  return new Map(
    values
      .filter((value): value is JsonRecord => isRecord(value) && typeof value.id === 'string')
      .map((value) => [value.id as string, value]),
  );
}

function compareEntities(before: unknown, after: unknown): EntityChanges {
  const left = byId(before);
  const right = byId(after);
  const ids = [...new Set([...left.keys(), ...right.keys()])].sort();
  const added: Array<{ id: string }> = [];
  const removed: Array<{ id: string }> = [];
  const changed: ChangedEntity[] = [];
  for (const id of ids) {
    const a = left.get(id);
    const b = right.get(id);
    if (!a) added.push({ id });
    else if (!b) removed.push({ id });
    else {
      const properties = changedPaths(a, b)
        .filter((path) => path !== 'id')
        .sort();
      if (properties.length) changed.push({ id, properties });
    }
  }
  return { added: cappedList(added), removed: cappedList(removed), changed: cappedList(changed) };
}

function compareLayers(before: unknown, after: unknown): LayerChanges {
  const left = byId(before);
  const right = byId(after);
  const ids = [...new Set([...left.keys(), ...right.keys()])].sort();
  const beforeIndex = new Map<string, number>();
  const afterIndex = new Map<string, number>();
  if (Array.isArray(before))
    before.forEach((item, index) => {
      if (isRecord(item) && typeof item.id === 'string') beforeIndex.set(item.id, index);
    });
  if (Array.isArray(after))
    after.forEach((item, index) => {
      if (isRecord(item) && typeof item.id === 'string') afterIndex.set(item.id, index);
    });
  const added: Array<{ id: string }> = [];
  const removed: Array<{ id: string }> = [];
  const reordered: Array<{ id: string; from: number; to: number }> = [];
  const renamed: Array<{ id: string; from: string; to: string }> = [];
  for (const id of ids) {
    const a = left.get(id);
    const b = right.get(id);
    if (!a) added.push({ id });
    else if (!b) removed.push({ id });
    else {
      const from = beforeIndex.get(id) ?? -1;
      const to = afterIndex.get(id) ?? -1;
      if (from !== to) reordered.push({ id, from, to });
      if (a.name !== b.name) renamed.push({ id, from: String(a.name), to: String(b.name) });
    }
  }
  return {
    added: cappedList(added),
    removed: cappedList(removed),
    reordered: cappedList(reordered),
    renamed: cappedList(renamed),
  };
}

/**
 * Compare two schema-valid 2D scenes without mutating either input.
 * Scene arrays are bounded by `schema/limits.json` (200 shapes/layers), and
 * JSON payloads by `maxScenePayloadBytes`, so sorted Map-based matching is
 * predictable at the largest supported document.
 */
export function summarizeSceneDiff(a: unknown, b: unknown): SceneDiffResult {
  const aError = validateInput(a);
  if (aError) return aError;
  const bError = validateInput(b);
  if (bError) return bError;
  const before = a as JsonRecord;
  const after = b as JsonRecord;
  const canvas = changedPaths(before.canvas, after.canvas).sort();
  return {
    ok: true,
    shapes: compareEntities(before.shapes, after.shapes),
    layers: compareLayers(before.layers, after.layers),
    groups: compareEntities(before.groups, after.groups),
    bindings: compareEntities(before.bindings, after.bindings),
    canvas: { changed: canvas.length > 0, properties: canvas.slice(0, MAX_ITEMS) },
  };
}

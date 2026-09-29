/**
 * Constrained HTML/CSS/JS projections for the structured 3D Code tab.
 *
 * The projections are intentionally non-executable. They expose only the
 * fields assigned to their sub-tab and always start parsing from the existing
 * Scene3DDocument, so an edit cannot silently discard fields owned elsewhere.
 */
import type { GrammarParseResult } from './codeGrammar';
import { validateScene3D } from '../validation/scene3d';
import type { Scene3DDocument } from '../pages/scene3dTypes';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const OBJECT_TYPES = new Set(['box', 'sphere', 'cylinder', 'plane', 'drawingPlane']);
const LIGHT_TYPES = new Set(['directional', 'point', 'ambient']);
const STRUCTURAL_TYPES = new Set(['camera', 'group', ...OBJECT_TYPES, ...LIGHT_TYPES]);

type StructuralEntry = {
  id: string;
  type: string;
  parentGroup: string | null;
  line: number;
};

function htmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function sceneEntries(scene: Scene3DDocument): StructuralEntry[] {
  const entries: StructuralEntry[] = [{ id: 'camera', type: 'camera', parentGroup: null, line: 0 }];
  const objectsByGroup = new Map<string | null, typeof scene.objects>();
  for (const object of scene.objects) {
    const items = objectsByGroup.get(object.groupId) ?? [];
    items.push(object);
    objectsByGroup.set(object.groupId, items);
  }
  for (const group of scene.groups) {
    entries.push({ id: group.id, type: 'group', parentGroup: null, line: 0 });
    for (const object of objectsByGroup.get(group.id) ?? []) {
      entries.push({ id: object.id, type: object.type, parentGroup: group.id, line: 0 });
    }
  }
  for (const object of objectsByGroup.get(null) ?? []) {
    entries.push({ id: object.id, type: object.type, parentGroup: null, line: 0 });
  }
  for (const light of scene.lights) {
    entries.push({ id: light.id, type: light.type, parentGroup: null, line: 0 });
  }
  return entries;
}

/** Generate the structural HTML fragment for the 3D Code tab. */
export function generateEditable3dHtml(scene: Scene3DDocument | null): string {
  if (!scene) return '<main id="scene-3d"></main>';
  const lines = sceneEntries(scene).map((entry) => {
    const parent = entry.parentGroup ? ` data-parent-group="${htmlEscape(entry.parentGroup)}"` : '';
    return `  <div data-object-id="${htmlEscape(entry.id)}" data-object-type="${entry.type}"${parent}></div>`;
  });
  return ['<main id="scene-3d">', ...lines, '</main>'].join('\n');
}

function lineNumber(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length;
}

function parseEntries(
  text: string,
): { ok: true; entries: StructuralEntry[] } | { ok: false; errors: string[] } {
  const root = /<main\b[^>]*\bid\s*=\s*["']scene-3d["'][^>]*>([\s\S]*)<\/main\s*>/i.exec(text);
  if (!root)
    return { ok: false, errors: ['Line 1: HTML must contain a <main id="scene-3d"> root.'] };
  const prefixLength = root.index ?? 0;
  const entries: StructuralEntry[] = [];
  const errors: string[] = [];
  const divPattern = /<div\b([^>]*)><\/div\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = divPattern.exec(root[1])) !== null) {
    const attributes = match[1];
    const line = lineNumber(text, prefixLength + (root.indexOf(match[0]) || 0) + match.index);
    const id = /\bdata-object-id\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];
    const type = /\bdata-object-type\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];
    const parentGroup = /\bdata-parent-group\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1] ?? null;
    if (!id || !ID_PATTERN.test(id)) {
      errors.push(`Line ${line}: missing or invalid data-object-id.`);
      continue;
    }
    if (!type || !STRUCTURAL_TYPES.has(type)) {
      errors.push(`Line ${line}: data-object-type for "${id}" is not supported.`);
      continue;
    }
    if (parentGroup !== null && !ID_PATTERN.test(parentGroup)) {
      errors.push(`Line ${line}: data-parent-group for "${id}" is invalid.`);
      continue;
    }
    entries.push({ id, type, parentGroup, line });
  }
  if (errors.length > 0) return { ok: false, errors };
  if (entries.length === 0)
    return { ok: false, errors: ['Line 1: the scene HTML contains no structural entries.'] };
  return { ok: true, entries };
}

function structuralKey(entry: StructuralEntry): string {
  return `${entry.type}:${entry.id}`;
}

/** Parse reorder/regroup-only HTML into a new canonical scene document. */
export function parseEditable3dHtml(
  text: string,
  previousScene: Scene3DDocument,
): GrammarParseResult<Scene3DDocument> {
  const parsed = parseEntries(text);
  if (!parsed.ok) return parsed;

  const expected = sceneEntries(previousScene);
  const expectedByKey = new Map(expected.map((entry) => [structuralKey(entry), entry]));
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const entry of parsed.entries) {
    const key = structuralKey(entry);
    const existing = expectedByKey.get(key);
    if (!existing) {
      errors.push(
        `Line ${entry.line}: "${entry.id}" is new or has been retyped; HTML only supports reorder/regroup.`,
      );
      continue;
    }
    if (seen.has(key)) errors.push(`Line ${entry.line}: duplicate structural entry "${entry.id}".`);
    seen.add(key);
    if (!OBJECT_TYPES.has(entry.type) && entry.parentGroup !== null) {
      errors.push(`Line ${entry.line}: only mesh objects may have data-parent-group.`);
    }
    if (
      entry.parentGroup !== null &&
      !previousScene.groups.some((group) => group.id === entry.parentGroup)
    ) {
      errors.push(`Line ${entry.line}: data-parent-group "${entry.parentGroup}" does not exist.`);
    }
  }
  for (const entry of expected) {
    if (!seen.has(structuralKey(entry))) {
      errors.push(
        `Line 1: existing ${entry.type} "${entry.id}" is missing; HTML cannot add or remove entries.`,
      );
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const next = structuredClone(previousScene);
  const objectEntries = parsed.entries.filter((entry) => OBJECT_TYPES.has(entry.type));
  const lightEntries = parsed.entries.filter((entry) => LIGHT_TYPES.has(entry.type));
  const groupEntries = parsed.entries.filter((entry) => entry.type === 'group');
  next.objects = objectEntries.map((entry) => {
    const object = previousScene.objects.find((candidate) => candidate.id === entry.id)!;
    return { ...object, groupId: entry.parentGroup };
  });
  next.lights = lightEntries.map((entry) =>
    previousScene.lights.find((candidate) => candidate.id === entry.id)!,
  );
  next.groups = groupEntries.map((entry) =>
    previousScene.groups.find((candidate) => candidate.id === entry.id)!,
  );
  const validation = validateScene3D(next);
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.errors.map((error) => `Line 1: ${error.path}: ${error.message}`),
    };
  }
  return { ok: true, scene: next };
}

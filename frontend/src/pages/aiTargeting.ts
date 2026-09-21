import type { SceneDocument } from '../api/projects';
import { buildOutline, getGroups, isEffectivelyLocked, type Group } from './sceneOutline';
import { getEditableShapes, type Shape } from './sceneShapes';

export type AITargetOption = {
  id: string;
  label: string;
  type: 'layer' | 'group' | 'shape' | 'media' | 'drawio-node';
  disabled?: boolean;
  disabledReason?: string;
  descendantIds: string[];
};

function descendantsOf(id: string, groups: Group[], shapes: Shape[]): string[] {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const shapesById = new Map(shapes.map((shape) => [shape.id, shape]));
  const result: string[] = [];
  const visit = (childId: string) => {
    if (result.includes(childId)) return;
    result.push(childId);
    const group = groupsById.get(childId);
    if (!group) return;
    group.childIds.forEach(visit);
  };
  if (groupsById.has(id)) visit(id);
  else if (shapesById.has(id)) result.push(id);
  return result;
}

function lockedReason(locked: boolean, kind: AITargetOption['type']): string | undefined {
  if (!locked) return undefined;
  return kind === 'drawio-node' ? 'Draw.io graph nodes are not editable here.' : 'Locked';
}

export function buildAITargetOptions(scene: SceneDocument): AITargetOption[] {
  const rows = buildOutline(scene);
  const groups = getGroups(scene);
  const shapes = getEditableShapes(Array.isArray(scene.shapes) ? scene.shapes : []);
  const options: AITargetOption[] = [];

  for (const row of rows) {
    const type = row.kind;
    const locked = row.kind === 'layer' ? row.locked : row.inheritedLocked;
    options.push({
      id: row.id,
      label: row.kind === 'shape' ? row.label : row.name,
      type,
      disabled: locked,
      disabledReason: lockedReason(locked, type),
      descendantIds:
        row.kind === 'layer'
          ? [
              row.id,
              ...groups
                .filter((group) => group.layerId === row.id)
                .flatMap((group) => descendantsOf(group.id, groups, shapes)),
              ...shapes.filter((shape) => shape.layerId === row.id).map((shape) => shape.id),
            ]
          : descendantsOf(row.id, groups, shapes),
    });
  }

  const seenMedia = new Set<string>();
  for (const shape of shapes) {
    if (shape.type !== 'image' || seenMedia.has(shape.mediaAssetId)) continue;
    seenMedia.add(shape.mediaAssetId);
    const locked = isEffectivelyLocked(scene, shape.id);
    options.push({
      id: shape.mediaAssetId,
      label: `Image asset ${shape.mediaAssetId}`,
      type: 'media',
      disabled: locked,
      disabledReason: lockedReason(locked, 'media'),
      descendantIds: [shape.mediaAssetId],
    });
  }

  const drawio = scene.drawio as { nodes?: unknown[]; objects?: unknown[] } | undefined;
  const nodes = Array.isArray(drawio?.nodes)
    ? drawio.nodes
    : Array.isArray(drawio?.objects)
      ? drawio.objects
      : [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const value = node as { id?: unknown; label?: unknown; name?: unknown };
    if (typeof value.id !== 'string') continue;
    options.push({
      id: value.id,
      label: String(value.label ?? value.name ?? value.id),
      type: 'drawio-node',
      disabled: true,
      disabledReason: 'Draw.io graph nodes are not editable here.',
      descendantIds: [value.id],
    });
  }
  return options;
}

export function targetIdsFor(options: AITargetOption[], selectedIds: string[]): string[] {
  return Array.from(
    new Set(
      selectedIds.flatMap(
        (id) => options.find((option) => option.id === id)?.descendantIds ?? [id],
      ),
    ),
  );
}

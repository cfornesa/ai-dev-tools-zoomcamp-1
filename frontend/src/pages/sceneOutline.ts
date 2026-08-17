/**
 * Task 24: pure data helpers and mutation functions for the scene outline
 * (layers, groups, and their draw-order relationship to shapes).
 *
 * These operate on the canonical scene document (see
 * ../../../schema/scene.schema.json's `$defs.layer` / `$defs.group`) the
 * same way `sceneShapes.ts` does for shapes: runtime-narrowed reads, and
 * mutations that return a brand new scene document rather than mutating in
 * place. Every mutation here is a pure function returning an `Outcome`:
 * either `{ ok: true, scene }` (the new scene document — or, for a
 * legitimate no-op such as "already at the top", the exact same `scene`
 * reference so callers can tell a no-op apart from a real change and skip
 * pushing an undo step) or `{ ok: false, error }` with a human-readable
 * explanation of why the action was rejected.
 *
 * Complexity/payload limits (`schema/limits.json`) and referential
 * integrity/cycle checks are enforced by reusing `validateScene` from
 * `../validation/scene` rather than duplicating that logic here — see
 * `checkCandidate` below.
 *
 * ## Draw-order rule (see Task 24's issue "Constraints")
 *
 * Layers draw in ascending `order`. Within a layer, top-level groups draw
 * in `groups` array order, then top-level shapes (`groupId === null`) draw
 * in `shapes` array order. A shape or group that belongs to a group draws
 * at its position within that group's `childIds`. There is no separate
 * "order" field for groups/shapes — reordering means moving array
 * positions (within `shapes`/`groups`, or within a group's `childIds`).
 *
 * ## Group membership model
 *
 * A shape's immediate parent group is `shape.groupId` (`null` = top-level
 * of its layer). A group has no `parentGroupId` field of its own — its
 * container is derived by searching every other group's `childIds` for
 * its id; a group not referenced by any other group's `childIds` is
 * top-level in its own `layerId`. Every mutation here that changes group
 * membership keeps `shape.groupId` and the owning group's `childIds` in
 * sync as two views of the same fact.
 */
import type { SceneDocument } from '../api/projects';
import { validateScene } from '../validation/scene';
import { getEditableShapes, type Shape } from './sceneShapes';

export type Layer = {
  id: string;
  name: string;
  order: number;
  visible: boolean;
  locked: boolean;
};

export type GroupTransform = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
};

export type Group = {
  id: string;
  name: string;
  layerId: string;
  childIds: string[];
  transform: GroupTransform;
  visible: boolean;
  locked: boolean;
};

export type Outcome =
  { ok: true; scene: SceneDocument; selectId?: string } | { ok: false; error: string };

function isLayer(value: unknown): value is Layer {
  const v = value as Partial<Layer> | null | undefined;
  return (
    !!v &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.order === 'number' &&
    typeof v.visible === 'boolean' &&
    typeof v.locked === 'boolean'
  );
}

function isGroup(value: unknown): value is Group {
  const v = value as Partial<Group> | null | undefined;
  return (
    !!v &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.layerId === 'string' &&
    Array.isArray(v.childIds) &&
    v.childIds.every((c) => typeof c === 'string') &&
    typeof v.visible === 'boolean' &&
    typeof v.locked === 'boolean' &&
    typeof v.transform === 'object' &&
    v.transform !== null
  );
}

function rawLayers(scene: SceneDocument): unknown[] {
  return Array.isArray(scene.layers) ? scene.layers : [];
}

function rawGroups(scene: SceneDocument): unknown[] {
  return Array.isArray(scene.groups) ? scene.groups : [];
}

function rawShapes(scene: SceneDocument): unknown[] {
  return Array.isArray(scene.shapes) ? scene.shapes : [];
}

function withLayers(scene: SceneDocument, layers: unknown[]): SceneDocument {
  return { ...scene, layers };
}

function withGroups(scene: SceneDocument, groups: unknown[]): SceneDocument {
  return { ...scene, groups };
}

function withShapes(scene: SceneDocument, shapes: unknown[]): SceneDocument {
  return { ...scene, shapes };
}

export function getLayers(scene: SceneDocument): Layer[] {
  return rawLayers(scene).filter(isLayer);
}

export function getGroups(scene: SceneDocument): Group[] {
  return rawGroups(scene).filter(isGroup);
}

function identityTransform(): GroupTransform {
  return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 };
}

function findParentGroup(id: string, groups: Group[]): Group | null {
  return groups.find((g) => g.childIds.includes(id)) ?? null;
}

function isGroupTopLevel(groupId: string, groups: Group[]): boolean {
  return !groups.some((g) => g.childIds.includes(groupId));
}

/** Reuses the shared validator (schema structure + referential integrity +
 * `schema/limits.json` complexity limits) to gate a candidate scene rather
 * than duplicating any of those rules here. Returns a human-readable
 * explanation for the first — preferring a limit violation — problem
 * found, or `null` if the candidate is valid. */
function checkCandidate(scene: SceneDocument): string | null {
  const result = validateScene(scene);
  if (result.valid) return null;
  const limitError = result.errors.find((e) => e.rule === 'limitExceeded');
  return (limitError ?? result.errors[0])?.message ?? 'This change would make the scene invalid.';
}

/** Removes a group id (and any dangling references to it) and collapses
 * any group left with no children as a result, repeating until stable —
 * so an empty group never lingers in the outline (Task 24 acceptance
 * criterion: removing a group's last child auto-removes it). */
export function pruneEmptyGroups(scene: SceneDocument): SceneDocument {
  let groups = getGroups(scene);
  let prunedAny = false;
  for (;;) {
    const emptyIds = groups.filter((g) => g.childIds.length === 0).map((g) => g.id);
    if (emptyIds.length === 0) break;
    const emptySet = new Set(emptyIds);
    groups = groups
      .filter((g) => !emptySet.has(g.id))
      .map((g) => ({ ...g, childIds: g.childIds.filter((cid) => !emptySet.has(cid)) }));
    prunedAny = true;
  }
  return prunedAny ? withGroups(scene, groups) : scene;
}

/** Removes a shape from the scene entirely: drops it from `shapes`, drops
 * its id from whichever group's `childIds` referenced it (if any), and
 * prunes any group left empty as a result. Used by the existing
 * shape-delete flow now that groups can exist. */
export function removeShapeFromScene(scene: SceneDocument, shapeId: string): SceneDocument {
  const nextShapesRaw = rawShapes(scene).filter((raw) => (raw as { id?: unknown }).id !== shapeId);
  const nextGroupsRaw = rawGroups(scene).map((raw) => {
    if (!isGroup(raw)) return raw;
    return raw.childIds.includes(shapeId)
      ? { ...raw, childIds: raw.childIds.filter((cid) => cid !== shapeId) }
      : raw;
  });
  const candidate = withGroups(withShapes(scene, nextShapesRaw), nextGroupsRaw);
  return pruneEmptyGroups(candidate);
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export function addLayer(scene: SceneDocument): Outcome {
  const layers = getLayers(scene);
  const nextOrder = layers.reduce((max, l) => Math.max(max, l.order), -1) + 1;
  const layer: Layer = {
    id: crypto.randomUUID(),
    name: `Layer ${layers.length + 1}`,
    order: nextOrder,
    visible: true,
    locked: false,
  };
  const candidate = withLayers(scene, [...rawLayers(scene), layer]);
  const error = checkCandidate(candidate);
  if (error) return { ok: false, error };
  return { ok: true, scene: candidate };
}

export function renameLayer(scene: SceneDocument, layerId: string, name: string): Outcome {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: 'A layer name cannot be empty.' };
  if (trimmed.length > 200) {
    return { ok: false, error: 'A layer name cannot be longer than 200 characters.' };
  }
  const layers = rawLayers(scene);
  const exists = layers.some((raw) => (raw as { id?: unknown }).id === layerId);
  if (!exists) return { ok: false, error: 'That layer no longer exists.' };
  const nextLayers = layers.map((raw) =>
    (raw as { id?: unknown }).id === layerId ? { ...(raw as Layer), name: trimmed } : raw,
  );
  return { ok: true, scene: withLayers(scene, nextLayers) };
}

export function deleteLayer(scene: SceneDocument, layerId: string): Outcome {
  const layers = getLayers(scene);
  if (!layers.some((l) => l.id === layerId)) {
    return { ok: false, error: 'That layer no longer exists.' };
  }
  if (layers.length <= 1) {
    return { ok: false, error: 'The scene must keep at least one layer.' };
  }
  const shapes = getEditableShapes(rawShapes(scene));
  const groups = getGroups(scene);
  const hasShapes = shapes.some((s) => s.layerId === layerId);
  const hasGroups = groups.some((g) => g.layerId === layerId);
  if (hasShapes || hasGroups) {
    return {
      ok: false,
      error: 'This layer still has shapes or groups on it. Delete them before deleting the layer.',
    };
  }
  const remaining = layers.filter((l) => l.id !== layerId).sort((a, b) => a.order - b.order);
  const renumbered = remaining.map((l, i) => ({ ...l, order: i }));
  return { ok: true, scene: withLayers(scene, renumbered) };
}

export function moveLayer(
  scene: SceneDocument,
  layerId: string,
  direction: 'up' | 'down',
): Outcome {
  const layers = getLayers(scene).sort((a, b) => a.order - b.order);
  const index = layers.findIndex((l) => l.id === layerId);
  if (index < 0) return { ok: false, error: 'That layer no longer exists.' };
  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= layers.length) return { ok: true, scene };
  const next = [...layers];
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  const renumbered = next.map((l, i) => ({ ...l, order: i }));
  return { ok: true, scene: withLayers(scene, renumbered) };
}

export function toggleLayerFlag(
  scene: SceneDocument,
  layerId: string,
  flag: 'visible' | 'locked',
): Outcome {
  const layers = rawLayers(scene);
  const idx = layers.findIndex((raw) => (raw as { id?: unknown }).id === layerId);
  if (idx < 0) return { ok: false, error: 'That layer no longer exists.' };
  const next = [...layers];
  const layer = next[idx] as Layer;
  next[idx] = { ...layer, [flag]: !layer[flag] };
  return { ok: true, scene: withLayers(scene, next) };
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

type Container = { kind: 'layer'; layerId: string } | { kind: 'group'; groupId: string };

function containerOf(id: string, shapes: Shape[], groups: Group[]): Container | null {
  const shape = shapes.find((s) => s.id === id);
  if (shape) {
    return shape.groupId
      ? { kind: 'group', groupId: shape.groupId }
      : { kind: 'layer', layerId: shape.layerId };
  }
  const group = groups.find((g) => g.id === id);
  if (group) {
    const parent = findParentGroup(id, groups);
    return parent
      ? { kind: 'group', groupId: parent.id }
      : { kind: 'layer', layerId: group.layerId };
  }
  return null;
}

function sameContainer(a: Container, b: Container): boolean {
  if (a.kind === 'layer' && b.kind === 'layer') return a.layerId === b.layerId;
  if (a.kind === 'group' && b.kind === 'group') return a.groupId === b.groupId;
  return false;
}

/** Combines two or more shapes/groups that belong to the same layer — not
 * necessarily the same immediate container — into one brand-new group with
 * an identity transform (Task 24 acceptance criterion: grouping never
 * moves anything visually). Each selected item is detached from wherever
 * it currently sits (the layer top level, or a parent group's `childIds`)
 * and attached to the new group instead, preserving the selected items'
 * relative draw order. When every selected item already shares one
 * immediate container, the new group is spliced into that exact
 * container at the position the selection occupied (matching prior
 * behavior); otherwise — since the items come from different containers —
 * the new group is placed at the layer's top level. Selections spanning
 * more than one layer, or mixing a group with one of its own descendants,
 * are rejected with an explanation rather than silently producing an
 * invalid or duplicated-membership scene document. */
export function groupItems(scene: SceneDocument, ids: string[]): Outcome {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length < 2) {
    return { ok: false, error: 'Select at least two shapes or groups to combine into a group.' };
  }

  const shapes = getEditableShapes(rawShapes(scene));
  const groups = getGroups(scene);

  let layerId: string | null = null;
  for (const id of uniqueIds) {
    const shape = shapes.find((s) => s.id === id);
    const group = shape ? undefined : groups.find((g) => g.id === id);
    if (!shape && !group)
      return { ok: false, error: 'One of the selected items no longer exists.' };
    const itemLayerId = shape ? shape.layerId : group!.layerId;
    if (layerId === null) {
      layerId = itemLayerId;
    } else if (layerId !== itemLayerId) {
      return {
        ok: false,
        error: 'You can only group items that belong to the same layer.',
      };
    }
    if (group) {
      const { shapeIds, groupIds } = collectDescendantIds(group.id, groups);
      const groupsDescendant = uniqueIds.some(
        (otherId) => otherId !== id && (shapeIds.has(otherId) || groupIds.has(otherId)),
      );
      if (groupsDescendant) {
        return {
          ok: false,
          error: 'Grouping a group with one of its own descendants is not allowed.',
        };
      }
    }
  }
  if (!layerId) return { ok: false, error: 'One of the selected items no longer exists.' };

  const orderedIds = buildOutline(scene)
    .filter((row) => row.kind !== 'layer' && uniqueIds.includes(row.id))
    .map((row) => row.id);
  if (orderedIds.length !== uniqueIds.length) {
    return { ok: false, error: 'One of the selected items no longer exists.' };
  }

  const containers = uniqueIds.map((id) => containerOf(id, shapes, groups)!);
  const [firstContainer, ...restContainers] = containers;
  const sharedContainer = restContainers.every((c) => sameContainer(c, firstContainer))
    ? firstContainer
    : null;

  const newGroup: Group = {
    id: crypto.randomUUID(),
    name: `Group ${groups.length + 1}`,
    layerId,
    childIds: orderedIds,
    transform: identityTransform(),
    visible: true,
    locked: false,
  };

  const nextShapesRaw = rawShapes(scene).map((raw) => {
    const s = raw as { id?: unknown };
    return uniqueIds.includes(String(s.id))
      ? { ...(raw as Record<string, unknown>), groupId: newGroup.id }
      : raw;
  });

  // Detach every selected item from whichever parent group's `childIds`
  // currently references it (top-level items aren't referenced by any
  // `childIds`, so this is a no-op for them).
  let nextGroupsRaw = rawGroups(scene).map((raw) => {
    const g = raw as { id?: unknown; childIds?: unknown };
    if (!Array.isArray(g.childIds)) return raw;
    const childIds = g.childIds as string[];
    if (!childIds.some((cid) => uniqueIds.includes(cid))) return raw;
    return {
      ...(raw as Record<string, unknown>),
      childIds: childIds.filter((cid) => !uniqueIds.includes(cid)),
    };
  });

  if (sharedContainer && sharedContainer.kind === 'group') {
    // Every selected item came from the same parent group: splice the new
    // group into that exact position rather than dropping to the layer
    // top level.
    const parent = groups.find((g) => g.id === sharedContainer.groupId)!;
    const insertAt = parent.childIds.findIndex((cid) => uniqueIds.includes(cid));
    nextGroupsRaw = nextGroupsRaw.map((raw) => {
      if ((raw as { id?: unknown }).id !== parent.id) return raw;
      const remaining = (raw as { childIds: string[] }).childIds;
      return {
        ...(raw as Record<string, unknown>),
        childIds: [...remaining.slice(0, insertAt), newGroup.id, ...remaining.slice(insertAt)],
      };
    });
  }
  nextGroupsRaw = [...nextGroupsRaw, newGroup];

  // Detaching selected items above can leave a source parent group with no
  // children left (e.g. grouping a top-level shape with the sole child of
  // an existing group) — prune it the same way removeShapeFromScene and
  // deleteGroupRecursive do, so a dangling empty group never lingers in
  // the outline. The brand-new group can never be empty (it always has at
  // least two children), so it's never a candidate for pruning here.
  const candidate = pruneEmptyGroups(withGroups(withShapes(scene, nextShapesRaw), nextGroupsRaw));
  const error = checkCandidate(candidate);
  if (error) return { ok: false, error };
  return { ok: true, scene: candidate, selectId: newGroup.id };
}

/** Moves a group's immediate children into the position the group
 * occupied — its parent group's `childIds`, or the layer's top level —
 * preserving their relative order and every id, then removes the group
 * entry itself. */
export function ungroupItem(scene: SceneDocument, groupId: string): Outcome {
  const groups = getGroups(scene);
  const group = groups.find((g) => g.id === groupId);
  if (!group) return { ok: false, error: 'That group no longer exists.' };

  const parent = findParentGroup(groupId, groups);
  const childSet = new Set(group.childIds);

  let nextGroupsRaw: unknown[];
  let nextGroupId: string | null;

  if (parent) {
    const nextParentChildIds = parent.childIds.flatMap((cid) =>
      cid === groupId ? group.childIds : [cid],
    );
    nextGroupsRaw = rawGroups(scene)
      .filter((raw) => (raw as { id?: unknown }).id !== groupId)
      .map((raw) =>
        (raw as { id?: unknown }).id === parent.id
          ? { ...(raw as Record<string, unknown>), childIds: nextParentChildIds }
          : raw,
      );
    nextGroupId = parent.id;
  } else {
    nextGroupsRaw = rawGroups(scene).filter((raw) => (raw as { id?: unknown }).id !== groupId);
    nextGroupId = null;
  }

  const nextShapesRaw = rawShapes(scene).map((raw) => {
    const s = raw as { id?: unknown };
    return childSet.has(String(s.id))
      ? { ...(raw as Record<string, unknown>), groupId: nextGroupId }
      : raw;
  });

  const candidate = withGroups(withShapes(scene, nextShapesRaw), nextGroupsRaw);
  return { ok: true, scene: candidate };
}

function collectDescendantIds(
  groupId: string,
  groups: Group[],
): { shapeIds: Set<string>; groupIds: Set<string> } {
  const shapeIds = new Set<string>();
  const groupIds = new Set<string>([groupId]);
  const groupsById = new Map(groups.map((g) => [g.id, g]));
  const stack = [groupId];
  while (stack.length > 0) {
    const gid = stack.pop()!;
    const g = groupsById.get(gid);
    if (!g) continue;
    for (const childId of g.childIds) {
      if (groupsById.has(childId)) {
        if (!groupIds.has(childId)) {
          groupIds.add(childId);
          stack.push(childId);
        }
      } else {
        shapeIds.add(childId);
      }
    }
  }
  return { shapeIds, groupIds };
}

/** Recursively removes a group and every descendant shape/group it
 * contains (as opposed to `ungroupItem`, which preserves descendants).
 * Also prunes any ancestor group left empty as a result. */
export function deleteGroupRecursive(scene: SceneDocument, groupId: string): Outcome {
  const groups = getGroups(scene);
  const group = groups.find((g) => g.id === groupId);
  if (!group) return { ok: false, error: 'That group no longer exists.' };

  const { shapeIds, groupIds } = collectDescendantIds(groupId, groups);
  const parent = findParentGroup(groupId, groups);

  const nextShapesRaw = rawShapes(scene).filter(
    (raw) => !shapeIds.has(String((raw as { id?: unknown }).id)),
  );
  let nextGroupsRaw = rawGroups(scene).filter(
    (raw) => !groupIds.has(String((raw as { id?: unknown }).id)),
  );
  if (parent) {
    nextGroupsRaw = nextGroupsRaw.map((raw) =>
      (raw as { id?: unknown }).id === parent.id
        ? {
            ...(raw as Record<string, unknown>),
            childIds: parent.childIds.filter((cid) => cid !== groupId),
          }
        : raw,
    );
  }

  const candidate = withGroups(withShapes(scene, nextShapesRaw), nextGroupsRaw);
  return { ok: true, scene: pruneEmptyGroups(candidate) };
}

export function toggleGroupFlag(
  scene: SceneDocument,
  groupId: string,
  flag: 'visible' | 'locked',
): Outcome {
  const groups = rawGroups(scene);
  const idx = groups.findIndex((raw) => (raw as { id?: unknown }).id === groupId);
  if (idx < 0) return { ok: false, error: 'That group no longer exists.' };
  const next = [...groups];
  const group = next[idx] as Group;
  next[idx] = { ...group, [flag]: !group[flag] };
  return { ok: true, scene: withGroups(scene, next) };
}

// ---------------------------------------------------------------------------
// Shared reorder (shapes and groups both live within a layer's top level or
// a group's childIds — see the draw-order rule above)
// ---------------------------------------------------------------------------

/** Swaps the given id with its up/down neighbor among the raw array
 * entries matching `matches`. Returns `null` if `id` isn't among the
 * matches at all, the exact same `rawArray` reference if the swap would
 * go out of bounds (a legitimate no-op — already first/last), or a new
 * array with the two entries swapped. */
function swapAmongMatching(
  rawArray: unknown[],
  id: string,
  direction: 'up' | 'down',
  matches: (item: unknown) => boolean,
): unknown[] | null {
  const positions: number[] = [];
  rawArray.forEach((item, i) => {
    if (matches(item)) positions.push(i);
  });
  const posIndex = positions.findIndex((i) => (rawArray[i] as { id?: unknown }).id === id);
  if (posIndex < 0) return null;
  const swapWith = direction === 'up' ? posIndex - 1 : posIndex + 1;
  if (swapWith < 0 || swapWith >= positions.length) return rawArray;
  const iA = positions[posIndex];
  const iB = positions[swapWith];
  const next = [...rawArray];
  [next[iA], next[iB]] = [next[iB], next[iA]];
  return next;
}

/** Reorders a shape or group up/down within its current layer top level or
 * parent group's `childIds` (moving it to a *different* layer or group is
 * out of scope for Task 24 — see the issue's "Out of scope"). */
export function moveItem(scene: SceneDocument, itemId: string, direction: 'up' | 'down'): Outcome {
  const groups = getGroups(scene);
  const shapes = getEditableShapes(rawShapes(scene));
  const isShape = shapes.some((s) => s.id === itemId);
  const isGroupItem = groups.some((g) => g.id === itemId);
  if (!isShape && !isGroupItem) return { ok: false, error: 'That item no longer exists.' };

  const parent = findParentGroup(itemId, groups);
  if (parent) {
    const idx = parent.childIds.indexOf(itemId);
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= parent.childIds.length) return { ok: true, scene };
    const nextChildIds = [...parent.childIds];
    [nextChildIds[idx], nextChildIds[swapWith]] = [nextChildIds[swapWith], nextChildIds[idx]];
    const nextGroups = rawGroups(scene).map((raw) =>
      (raw as { id?: unknown }).id === parent.id
        ? { ...(raw as Record<string, unknown>), childIds: nextChildIds }
        : raw,
    );
    return { ok: true, scene: withGroups(scene, nextGroups) };
  }

  if (isGroupItem) {
    const g = groups.find((x) => x.id === itemId)!;
    const next = swapAmongMatching(rawGroups(scene), itemId, direction, (item) => {
      const gi = item as { id?: unknown; layerId?: unknown };
      return gi.layerId === g.layerId && isGroupTopLevel(String(gi.id), groups);
    });
    if (next === null) return { ok: false, error: 'That item no longer exists.' };
    return next === rawGroups(scene)
      ? { ok: true, scene }
      : { ok: true, scene: withGroups(scene, next) };
  }

  const s = shapes.find((x) => x.id === itemId)!;
  const next = swapAmongMatching(rawShapes(scene), itemId, direction, (item) => {
    const si = item as { type?: unknown; layerId?: unknown; groupId?: unknown };
    return (
      typeof si.type === 'string' &&
      si.layerId === s.layerId &&
      (si.groupId === null || si.groupId === undefined)
    );
  });
  if (next === null) return { ok: false, error: 'That item no longer exists.' };
  return next === rawShapes(scene)
    ? { ok: true, scene }
    : { ok: true, scene: withShapes(scene, next) };
}

// ---------------------------------------------------------------------------
// Outline rendering
// ---------------------------------------------------------------------------

export type OutlineRow =
  | {
      kind: 'layer';
      id: string;
      depth: 0;
      name: string;
      visible: boolean;
      locked: boolean;
      isFirst: boolean;
      isLast: boolean;
    }
  | {
      kind: 'group';
      id: string;
      depth: number;
      name: string;
      visible: boolean;
      locked: boolean;
      childCount: number;
      layerId: string;
      isFirst: boolean;
      isLast: boolean;
    }
  | {
      kind: 'shape';
      id: string;
      depth: number;
      typeLabel: string;
      shapeType: Shape['type'];
      inheritedVisible: boolean;
      inheritedLocked: boolean;
      layerId: string;
      isFirst: boolean;
      isLast: boolean;
    };

/** Builds a flat, top-to-bottom list of outline rows in the scene's
 * deterministic draw order (see the module docstring), with `depth`
 * carrying each row's group-nesting depth for indentation. */
export function buildOutline(scene: SceneDocument): OutlineRow[] {
  const layers = getLayers(scene).sort((a, b) => a.order - b.order);
  const groups = getGroups(scene);
  const shapes = getEditableShapes(rawShapes(scene));
  const shapesById = new Map(shapes.map((s) => [s.id, s]));
  const groupsById = new Map(groups.map((g) => [g.id, g]));

  const rows: OutlineRow[] = [];

  function emitShape(
    shape: Shape,
    depth: number,
    isFirst: boolean,
    isLast: boolean,
    inheritedVisible: boolean,
    inheritedLocked: boolean,
  ) {
    rows.push({
      kind: 'shape',
      id: shape.id,
      depth,
      typeLabel: shape.type,
      shapeType: shape.type,
      inheritedVisible,
      inheritedLocked,
      layerId: shape.layerId,
      isFirst,
      isLast,
    });
  }

  function emitGroup(
    group: Group,
    depth: number,
    isFirst: boolean,
    isLast: boolean,
    ancestorVisible: boolean,
    ancestorLocked: boolean,
  ) {
    rows.push({
      kind: 'group',
      id: group.id,
      depth,
      name: group.name,
      visible: group.visible,
      locked: group.locked,
      childCount: group.childIds.length,
      layerId: group.layerId,
      isFirst,
      isLast,
    });
    const combinedVisible = ancestorVisible && group.visible;
    const combinedLocked = ancestorLocked || group.locked;
    const children = group.childIds
      .map((cid) => shapesById.get(cid) ?? groupsById.get(cid))
      .filter((c): c is Shape | Group => c !== undefined);
    children.forEach((child, i) => {
      const isFirstChild = i === 0;
      const isLastChild = i === children.length - 1;
      if ('childIds' in child) {
        emitGroup(child, depth + 1, isFirstChild, isLastChild, combinedVisible, combinedLocked);
      } else {
        emitShape(child, depth + 1, isFirstChild, isLastChild, combinedVisible, combinedLocked);
      }
    });
  }

  layers.forEach((layer, layerIndex) => {
    rows.push({
      kind: 'layer',
      id: layer.id,
      depth: 0,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      isFirst: layerIndex === 0,
      isLast: layerIndex === layers.length - 1,
    });

    const topGroups = groups.filter((g) => g.layerId === layer.id && isGroupTopLevel(g.id, groups));
    const topShapes = shapes.filter((s) => s.layerId === layer.id && s.groupId === null);

    topGroups.forEach((group, i) => {
      emitGroup(group, 1, i === 0, i === topGroups.length - 1, layer.visible, layer.locked);
    });
    topShapes.forEach((shape, i) => {
      emitShape(shape, 1, i === 0, i === topShapes.length - 1, layer.visible, layer.locked);
    });
  });

  return rows;
}

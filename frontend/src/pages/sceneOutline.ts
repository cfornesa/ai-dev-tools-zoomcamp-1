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
import { getEditableShapes, shapeLabel, type Shape } from './sceneShapes';

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

/** Builds a fresh, schema-valid layer (unique id, next sequential `order`,
 * visible and unlocked by default) — the single construction `addLayer`
 * below and `useSceneEditor.ts`'s `addShape`/`duplicateSelected` (Task 111,
 * issue #142: every new or duplicated shape gets its own independent
 * layer, never reusing an existing one) both build on, so a new layer's
 * shape never drifts between call sites. */
export function createLayerFor(scene: SceneDocument): Layer {
  const layers = getLayers(scene);
  const nextOrder = layers.reduce((max, l) => Math.max(max, l.order), -1) + 1;
  return {
    id: crypto.randomUUID(),
    name: `Layer ${layers.length + 1}`,
    order: nextOrder,
    visible: true,
    locked: false,
  };
}

export function addLayer(scene: SceneDocument): Outcome {
  const layer = createLayerFor(scene);
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

export function renameShape(scene: SceneDocument, shapeId: string, name: string): Outcome {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'A shape name cannot be empty.' };
  if (trimmed.length > 200) {
    return { ok: false, error: 'A shape name cannot be longer than 200 characters.' };
  }
  const shapes = rawShapes(scene);
  if (!shapes.some((raw) => (raw as { id?: unknown }).id === shapeId)) {
    return { ok: false, error: 'That shape no longer exists.' };
  }
  return {
    ok: true,
    scene: withShapes(
      scene,
      shapes.map((raw) =>
        (raw as { id?: unknown }).id === shapeId
          ? { ...(raw as Record<string, unknown>), name: trimmed }
          : raw,
      ),
    ),
  };
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

/** Combines two or more shapes/groups — regardless of which layer each one
 * individually belongs to (Task 111/#142: every shape is its own
 * independent layer, so requiring a shared layerId would make grouping
 * impossible) — into one brand-new group with an identity transform (Task
 * 24 acceptance criterion: grouping never moves anything visually). Each
 * selected item is detached from wherever it currently sits (the layer
 * top level, or a parent group's `childIds`) and attached to the new
 * group instead, preserving the selected items' relative draw order; each
 * member shape keeps its own individual `layerId` untouched. The new
 * group itself adopts the first selected item's layerId. When every
 * selected item already shares one immediate container, the new group is
 * spliced into that exact container at the position the selection
 * occupied (matching prior behavior); otherwise — since the items come
 * from different containers — the new group is placed at the layer's top
 * level. Mixing a group with one of its own descendants is rejected with
 * an explanation rather than silently producing an invalid or
 * duplicated-membership scene document. */
export function groupItems(scene: SceneDocument, ids: string[]): Outcome {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length < 2) {
    return { ok: false, error: 'Select at least two shapes or groups to combine into a group.' };
  }

  const shapes = getEditableShapes(rawShapes(scene));
  const groups = getGroups(scene);

  // Task 111 (issue #142): every shape is its own independent layer now,
  // so requiring every selected item to already share one layerId would
  // make it impossible to ever group two shapes together. The new group
  // simply adopts the first selected item's layerId (an arbitrary but
  // stable choice -- the group's own layerId only affects its outline/
  // top-level position, never its members' individually-tracked
  // layerIds, which `nextShapesRaw` below leaves untouched).
  let layerId: string | null = null;
  for (const id of uniqueIds) {
    const shape = shapes.find((s) => s.id === id);
    const group = shape ? undefined : groups.find((g) => g.id === id);
    if (!shape && !group)
      return { ok: false, error: 'One of the selected items no longer exists.' };
    if (layerId === null) {
      layerId = shape ? shape.layerId : group!.layerId;
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

/** Task 111 (issue #142): toggles a shape's own `visible`/`locked` flag —
 * the per-shape mirror of `toggleLayerFlag`/`toggleGroupFlag` above, now
 * that a shape carries its own flag rather than only inheriting one.
 * Absent (`undefined`) reads as `true` for `visible`/`false` for `locked`
 * (the schema field's own backward-compatibility default — see
 * `sceneShapes.ts`'s `BaseShape` doc comment), so the first toggle from
 * that implicit default flips to the explicit opposite. */
export function toggleShapeFlag(
  scene: SceneDocument,
  shapeId: string,
  flag: 'visible' | 'locked',
): Outcome {
  const shapes = rawShapes(scene);
  const idx = shapes.findIndex((raw) => (raw as { id?: unknown }).id === shapeId);
  if (idx < 0) return { ok: false, error: 'That shape no longer exists.' };
  const next = [...shapes];
  const shape = next[idx] as { visible?: boolean; locked?: boolean };
  const current = flag === 'visible' ? (shape.visible ?? true) : (shape.locked ?? false);
  next[idx] = { ...shape, [flag]: !current };
  return { ok: true, scene: withShapes(scene, next) };
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

  // Task 111 (issue #142): every shape is its own independent layer now,
  // so a "same layerId" sibling filter would always match only the shape
  // itself, making a plain array-position swap within `shapes` a
  // permanent no-op AND pointless even if it weren't -- both
  // `buildOutline` and `sceneDrawPlan.ts`'s `buildScenePlan` iterate
  // layers (sorted by `order`) as the primary top-level ordering, only
  // using `shapes`/`groups` array position as a tiebreaker *within* one
  // layer. Since a top-level shape is now effectively alone on its own
  // layer, "move this shape up/down" is the same operation as "move its
  // layer up/down among its peers" -- delegate to `moveLayer` so this
  // shape's position in the outline and on canvas actually changes,
  // consistent with a top-level group (still ordered by its own
  // `layerId`'s layer, unchanged by this task).
  const s = shapes.find((x) => x.id === itemId)!;
  return moveLayer(scene, s.layerId, direction);
}

// ---------------------------------------------------------------------------
// Reparenting (Task 76): moving an existing shape/group to a different
// layer, or into/out of a different group on the same layer — as opposed to
// `moveItem` above, which only reorders within the current container.
//
// Both functions below build a candidate scene document with the id/all
// other properties of the moved item left completely untouched (only
// `layerId`/`groupId`, or a group's membership in some other group's
// `childIds`, change), then reuse `checkCandidate` — the exact same
// `validateScene`-backed gate every other outline mutation in this file
// goes through — to reject the move with a textual explanation naming the
// exact limit (`maxGroupNestingDepth`, `maxGroupChildIds`) or cycle
// violated, rather than duplicating that detection here. `pruneEmptyGroups`
// (the same helper `removeShapeFromScene`/`deleteGroupRecursive` already
// use) runs on every candidate so a move that empties out a group's last
// child cannot leave a dangling empty group behind.
// ---------------------------------------------------------------------------

/** Moves a shape or group to a different layer's top level, detaching it
 * from its current parent group (if any). Preserves the item's id and
 * every other property. For a group, every descendant *group*'s `layerId`
 * moves with it (nested groups may freely share a layerId with one
 * another — only shapes are constrained to one-per-layer), but descendant
 * *shapes* keep their own individually-tracked `layerId` untouched (Task
 * 111/#142: forcing every descendant shape onto the same target layerId
 * would violate the one-shape-per-layer invariant the moment a group has
 * more than one member shape). Moving a group to a layer is therefore a
 * statement about the group's own top-level position, not a claim that
 * its member shapes now share one layer. */
export function moveItemToLayer(
  scene: SceneDocument,
  itemId: string,
  targetLayerId: string,
): Outcome {
  const layers = getLayers(scene);
  if (!layers.some((l) => l.id === targetLayerId)) {
    return { ok: false, error: 'That layer no longer exists.' };
  }

  const shapes = getEditableShapes(rawShapes(scene));
  const groups = getGroups(scene);
  const shape = shapes.find((s) => s.id === itemId);
  const group = shape ? undefined : groups.find((g) => g.id === itemId);
  if (!shape && !group) return { ok: false, error: 'That item no longer exists.' };

  if (shape) {
    if (shape.layerId === targetLayerId && shape.groupId === null) {
      return { ok: true, scene };
    }
    const nextShapesRaw = rawShapes(scene).map((raw) => {
      const s = raw as { id?: unknown };
      return s.id === itemId
        ? { ...(raw as Record<string, unknown>), layerId: targetLayerId, groupId: null }
        : raw;
    });
    const nextGroupsRaw = rawGroups(scene).map((raw) => {
      const g = raw as { id?: unknown; childIds?: unknown };
      if (!Array.isArray(g.childIds)) return raw;
      const childIds = g.childIds as string[];
      if (!childIds.includes(itemId)) return raw;
      return {
        ...(raw as Record<string, unknown>),
        childIds: childIds.filter((c) => c !== itemId),
      };
    });
    const candidate = pruneEmptyGroups(withGroups(withShapes(scene, nextShapesRaw), nextGroupsRaw));
    const error = checkCandidate(candidate);
    if (error) return { ok: false, error };
    return { ok: true, scene: candidate };
  }

  const movedGroup = group!;
  if (movedGroup.layerId === targetLayerId && isGroupTopLevel(movedGroup.id, groups)) {
    return { ok: true, scene };
  }
  const { groupIds } = collectDescendantIds(movedGroup.id, groups);
  const nextGroupsRaw = rawGroups(scene).map((raw) => {
    const g = raw as { id?: unknown; childIds?: unknown };
    if (groupIds.has(String(g.id))) {
      return { ...(raw as Record<string, unknown>), layerId: targetLayerId };
    }
    if (Array.isArray(g.childIds) && (g.childIds as string[]).includes(itemId)) {
      return {
        ...(raw as Record<string, unknown>),
        childIds: (g.childIds as string[]).filter((c) => c !== itemId),
      };
    }
    return raw;
  });
  const candidate = pruneEmptyGroups(withGroups(scene, nextGroupsRaw));
  const error = checkCandidate(candidate);
  if (error) return { ok: false, error };
  return { ok: true, scene: candidate };
}

/** Moves a shape or group into a different group — regardless of which
 * layer either one individually belongs to (Task 111/#142: every shape is
 * its own independent layer, so a same-layer precondition here would
 * reject moving almost any shape into almost any group; the moved item's
 * own `layerId` stays untouched, only its `groupId`/parent changes) — or
 * (when `targetGroupId` is `null`) promotes it out to its layer's top
 * level. Preserves the item's id and every other property. Rejects a move
 * into the item's own descendant, or one that would exceed
 * `maxGroupChildIds`/`maxGroupNestingDepth` — the same `checkCandidate`
 * gate every other mutation here uses. */
export function moveItemToGroup(
  scene: SceneDocument,
  itemId: string,
  targetGroupId: string | null,
): Outcome {
  const shapes = getEditableShapes(rawShapes(scene));
  const groups = getGroups(scene);
  const shape = shapes.find((s) => s.id === itemId);
  const group = shape ? undefined : groups.find((g) => g.id === itemId);
  if (!shape && !group) return { ok: false, error: 'That item no longer exists.' };

  const detachFromCurrentParent = (rawGroupsList: unknown[]): unknown[] =>
    rawGroupsList.map((raw) => {
      const g = raw as { id?: unknown; childIds?: unknown };
      if (!Array.isArray(g.childIds)) return raw;
      const childIds = g.childIds as string[];
      return childIds.includes(itemId)
        ? { ...(raw as Record<string, unknown>), childIds: childIds.filter((c) => c !== itemId) }
        : raw;
    });

  if (targetGroupId === null) {
    const parent = findParentGroup(itemId, groups);
    if (!parent) return { ok: true, scene }; // already top-level
    const nextGroupsRaw = detachFromCurrentParent(rawGroups(scene));
    const nextShapesRaw = shape
      ? rawShapes(scene).map((raw) => {
          const s = raw as { id?: unknown };
          return s.id === itemId ? { ...(raw as Record<string, unknown>), groupId: null } : raw;
        })
      : rawShapes(scene);
    const candidate = pruneEmptyGroups(withGroups(withShapes(scene, nextShapesRaw), nextGroupsRaw));
    const error = checkCandidate(candidate);
    if (error) return { ok: false, error };
    return { ok: true, scene: candidate };
  }

  if (targetGroupId === itemId) {
    return { ok: false, error: 'A group cannot be moved into itself.' };
  }
  const targetGroup = groups.find((g) => g.id === targetGroupId);
  if (!targetGroup) return { ok: false, error: 'That group no longer exists.' };
  // Task 111 (issue #142): every shape is its own independent layer now,
  // so requiring the moved item's layerId to match the target group's
  // would reject moving almost any shape into almost any group. A
  // shape's own layerId (like grouping itself -- see groupItems above)
  // stays untouched by this move; only its groupId changes.
  if (group) {
    const { groupIds } = collectDescendantIds(group.id, groups);
    if (groupIds.has(targetGroupId)) {
      return { ok: false, error: 'Moving a group into one of its own descendants is not allowed.' };
    }
  }
  const currentParent = findParentGroup(itemId, groups);
  if (currentParent?.id === targetGroupId) return { ok: true, scene }; // already there

  const nextGroupsRaw = detachFromCurrentParent(rawGroups(scene)).map((raw) => {
    const g = raw as { id?: unknown; childIds?: unknown };
    return g.id === targetGroupId
      ? { ...(raw as Record<string, unknown>), childIds: [...(g.childIds as string[]), itemId] }
      : raw;
  });
  const nextShapesRaw = shape
    ? rawShapes(scene).map((raw) => {
        const s = raw as { id?: unknown };
        return s.id === itemId
          ? { ...(raw as Record<string, unknown>), groupId: targetGroupId }
          : raw;
      })
    : rawShapes(scene);

  const candidate = pruneEmptyGroups(withGroups(withShapes(scene, nextShapesRaw), nextGroupsRaw));
  const error = checkCandidate(candidate);
  if (error) return { ok: false, error };
  return { ok: true, scene: candidate };
}

// ---------------------------------------------------------------------------
// Effective lock state (Task 80)
// ---------------------------------------------------------------------------

/** Returns whether a shape, group, or bare layer id is *effectively*
 * locked: for a shape/group, its own `locked` flag (groups only — shapes
 * have no `locked` field of their own), OR any ancestor group's `locked`
 * flag (walking up through arbitrary nesting depth), OR its layer's
 * `locked` flag. This is the single place the OR-cascade `buildOutline()`
 * displays is expressed — every mutation guard in `useSceneEditor.ts`
 * calls this same function rather than re-deriving the cascade.
 *
 * A bare layer id (one that doesn't resolve to any shape or group) is also
 * accepted: a layer has no ancestor of its own to cascade through, so its
 * effective lock state is exactly its own `locked` flag. This lets a
 * single reparenting destination check — "is the id I'm about to move an
 * item into locked?" — route through this same function whether the
 * destination is a layer (`moveItemToLayer`) or a group
 * (`moveItemToGroup`), rather than one of the two call sites needing a
 * separate raw `layer.locked` read.
 *
 * Returns `false` for an id that doesn't resolve to a shape, group, or
 * layer in the scene at all. */
export function isEffectivelyLocked(scene: SceneDocument, id: string): boolean {
  const shapes = getEditableShapes(rawShapes(scene));
  const groups = getGroups(scene);
  const layers = getLayers(scene);
  const layersById = new Map(layers.map((l) => [l.id, l]));
  const groupsById = new Map(groups.map((g) => [g.id, g]));

  const shape = shapes.find((s) => s.id === id);
  const group = shape ? undefined : groupsById.get(id);
  if (!shape && !group) {
    return layersById.get(id)?.locked ?? false;
  }

  const layerId = shape ? shape.layerId : group!.layerId;
  // Task 111 (issue #142): a shape now carries its own optional `locked`
  // flag (absent means unlocked, matching the schema field's own
  // backward-compatibility default) -- folded into the same OR-cascade a
  // group's own flag already went through.
  const ownLocked = shape ? (shape.locked ?? false) : group!.locked;

  let ancestorGroupId = shape ? shape.groupId : (findParentGroup(group!.id, groups)?.id ?? null);
  let ancestorLocked = false;
  while (ancestorGroupId) {
    const g = groupsById.get(ancestorGroupId);
    if (!g) break;
    ancestorLocked = ancestorLocked || g.locked;
    ancestorGroupId = findParentGroup(g.id, groups)?.id ?? null;
  }

  const layer = layersById.get(layerId);
  return ownLocked || ancestorLocked || (layer?.locked ?? false);
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
      // Task 80 (issue #110): the group's *own* visibility/lock flags,
      // cascaded down through every ancestor group and its layer — the
      // same OR-cascade `isEffectivelyLocked` applies to shapes, computed
      // here for groups too so a group nested under a hidden/locked
      // ancestor reads as hidden/locked in the outline even though its own
      // flag is still "visible"/"unlocked". `visible`/`locked` above stay
      // as the group's own flags (what the toggle buttons reflect and
      // mutate); these are the display-only cascaded values.
      inheritedVisible: boolean;
      inheritedLocked: boolean;
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
      // Task 80 (issue #110): a stable, readable label ("Circle 2") in
      // place of a truncated UUID — see `sceneShapes.ts`'s `shapeLabel`.
      label: string;
      // Task 111 (issue #142): a shape's own visibility/lock flags, the
      // same own-vs-cascaded distinction a group row already carries (see
      // that variant's own doc comment above) -- `visible`/`locked` here
      // are what the new per-shape toggle buttons reflect and mutate;
      // `inheritedVisible`/`inheritedLocked` are the display-only
      // cascaded values folding those in with every ancestor group and
      // the layer.
      visible: boolean;
      locked: boolean;
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
  ) {
    rows.push({
      kind: 'shape',
      id: shape.id,
      depth,
      typeLabel: shape.type,
      shapeType: shape.type,
      label: shapeLabel(shape, shapes),
      visible: shape.visible ?? true,
      locked: shape.locked ?? false,
      inheritedVisible: inheritedVisible && (shape.visible ?? true),
      inheritedLocked: isEffectivelyLocked(scene, shape.id),
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
  ) {
    rows.push({
      kind: 'group',
      id: group.id,
      depth,
      name: group.name,
      visible: group.visible,
      locked: group.locked,
      inheritedVisible: ancestorVisible && group.visible,
      inheritedLocked: isEffectivelyLocked(scene, group.id),
      childCount: group.childIds.length,
      layerId: group.layerId,
      isFirst,
      isLast,
    });
    const combinedVisible = ancestorVisible && group.visible;
    const children = group.childIds
      .map((cid) => shapesById.get(cid) ?? groupsById.get(cid))
      .filter((c): c is Shape | Group => c !== undefined);
    children.forEach((child, i) => {
      const isFirstChild = i === 0;
      const isLastChild = i === children.length - 1;
      if ('childIds' in child) {
        emitGroup(child, depth + 1, isFirstChild, isLastChild, combinedVisible);
      } else {
        emitShape(child, depth + 1, isFirstChild, isLastChild, combinedVisible);
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
      emitGroup(group, 1, i === 0, i === topGroups.length - 1, layer.visible);
    });
    // Task 111 (issue #142): `moveItem` on a top-level shape now delegates
    // to `moveLayer` on that shape's own layer (see its doc comment for
    // why -- every shape is effectively alone on its layer, so the
    // layer's position among ALL layers is what "move up/down" actually
    // changes). `isFirst`/`isLast` here must agree with that: the old
    // "first/last among this layer's topShapes" was always both true for
    // a layer with exactly one shape, permanently disabling the Move up/
    // down buttons. Using the layer's own position keeps them enabled/
    // disabled exactly when a `moveLayer` call would actually be a no-op.
    topShapes.forEach((shape, i) => {
      emitShape(
        shape,
        1,
        i === 0 && layerIndex === 0,
        i === topShapes.length - 1 && layerIndex === layers.length - 1,
        layer.visible,
      );
    });
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Selection breadcrumb (Task 80 / issue #110)
// ---------------------------------------------------------------------------

export type BreadcrumbSegment = { id: string; kind: 'layer' | 'group' | 'shape'; label: string };

/** Builds the ordered layer → group → … → item path for `id` (a shape or
 * group id) — e.g. `[Layer 1, Group A, Circle 2]` — so the Inspector panel
 * can show the selected item's context alongside its editable attributes
 * without the user having to cross-reference the outline tree by eye. The
 * last segment is always the item itself (its friendly label, from
 * `shapeLabel` for a shape or its own `name` for a group); every segment
 * before it is an ancestor, outermost (the layer) first.
 *
 * Returns an empty array for an id that doesn't resolve to a shape or group
 * in `scene` (e.g. nothing selected, or a stale id) — callers should treat
 * that the same as "no breadcrumb to show". */
export function outlineBreadcrumb(scene: SceneDocument, id: string | null): BreadcrumbSegment[] {
  if (id === null) return [];
  const shapes = getEditableShapes(rawShapes(scene));
  const groups = getGroups(scene);
  const layers = getLayers(scene);
  const layersById = new Map(layers.map((l) => [l.id, l]));

  const shape = shapes.find((s) => s.id === id);
  const group = shape ? undefined : groups.find((g) => g.id === id);
  if (!shape && !group) return [];

  const layerId = shape ? shape.layerId : group!.layerId;
  const layer = layersById.get(layerId);
  const segments: BreadcrumbSegment[] = layer
    ? [{ id: layer.id, kind: 'layer', label: layer.name }]
    : [];

  const ancestorChain: Group[] = [];
  let ancestorId = shape ? shape.groupId : (findParentGroup(group!.id, groups)?.id ?? null);
  const visited = new Set<string>();
  while (ancestorId && !visited.has(ancestorId)) {
    visited.add(ancestorId);
    const g = groups.find((x) => x.id === ancestorId);
    if (!g) break;
    ancestorChain.unshift(g);
    ancestorId = findParentGroup(g.id, groups)?.id ?? null;
  }
  segments.push(...ancestorChain.map((g) => ({ id: g.id, kind: 'group' as const, label: g.name })));

  if (shape) {
    segments.push({ id: shape.id, kind: 'shape', label: shapeLabel(shape, shapes) });
  } else if (group) {
    segments.push({ id: group.id, kind: 'group', label: group.name });
  }
  return segments;
}

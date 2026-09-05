/**
 * Validate canonical scene documents against ../../../schema/scene.schema.json.
 *
 * Mirrors `scenes/validation.py` — both load the same schema files from
 * `schema/` and apply the same three-stage pipeline: schema version, then
 * JSON Schema structure, then referential integrity and complexity/payload
 * limits. See `schema/README.md` for why the pipeline is split this way.
 *
 * This validation is advisory only: it exists to give editor users fast
 * feedback, not to be trusted for persisted or exported data. The Django
 * server (`scenes.validation.validate_scene`) is authoritative and
 * re-validates independently before save, AI-proposal acceptance,
 * publish, and export.
 */
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';

import sceneSchema from '../../../schema/scene.schema.json';
import rawLimits from '../../../schema/limits.json';
import rawNodeTypes from '../../../schema/node_types.json';

export const LIMITS: Record<string, number> = Object.fromEntries(
  Object.entries(rawLimits).filter(([key]) => !key.startsWith('$')),
) as Record<string, number>;

// Single source of truth (schema/node_types.json) for which graph node
// `type` strings are allowlisted per `family` -- see checkForbiddenNodeTypes
// below, and frontend/src/runtime/behaviorRuntime.ts's ALLOWED_NODE_TYPES_BY_FAMILY,
// which derives its own registry from this same file rather than keeping a
// second hand-written copy that could drift.
export const ALLOWED_NODE_TYPES_BY_FAMILY: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(rawNodeTypes).filter(([key]) => !key.startsWith('$')),
) as Record<string, readonly string[]>;

export const SUPPORTED_SCHEMA_VERSION = 1;

export type SceneValidationError = {
  path: string;
  rule: string;
  message: string;
};

export type SceneValidationResult = {
  valid: boolean;
  errors: SceneValidationError[];
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
const structuralValidate = ajv.compile(sceneSchema);

function formatPath(instancePath: string): string {
  if (!instancePath) return '$';
  // ajv instancePath looks like "/shapes/2/radius"; render as "$.shapes[2].radius".
  const segments = instancePath.split('/').filter(Boolean);
  let path = '$';
  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      path += `[${segment}]`;
    } else {
      path += `.${segment}`;
    }
  }
  return path;
}

function structuralRuleFor(error: ErrorObject): string {
  switch (error.keyword) {
    case 'required':
      return 'missingRequired';
    case 'additionalProperties':
      return 'unknownField';
    case 'type':
      return 'wrongType';
    case 'enum':
    case 'const':
    case 'pattern':
      return 'invalidValue';
    default:
      return 'invalid';
  }
}

function checkStructure(data: unknown): SceneValidationError[] {
  structuralValidate(data);
  const ajvErrors = structuralValidate.errors ?? [];
  return ajvErrors.map((error) => ({
    path: formatPath(error.instancePath),
    rule: structuralRuleFor(error),
    message: error.message ?? 'Invalid value.',
  }));
}

/**
 * Reject `NaN`/`Infinity`/`-Infinity` anywhere in the document.
 *
 * `JSON.parse` already rejects these three tokens outright (unlike
 * Python's `json` module, which accepts them as a non-standard
 * extension -- see `scenes/validation.py`'s matching check for why the
 * Python side needs this explicitly and this one is defense-in-depth),
 * so this only matters when `validateScene` is called on a JS object
 * that didn't come from parsing JSON text (e.g. constructed
 * programmatically, or round-tripped through some other path). Kept
 * explicit and symmetric with the Python validator rather than relying
 * on ajv's `minimum`/`maximum` keywords, which do correctly reject `NaN`
 * for *bounded* fields but -- like the schema itself -- have no bound to
 * check against for an unbounded numeric field (e.g.
 * `binding.mapping.inMin`, `graphNode.params` numeric values).
 */
function checkNonFiniteNumbers(data: unknown, path = '$'): SceneValidationError[] {
  const errors: SceneValidationError[] = [];
  if (typeof data === 'number' && !Number.isFinite(data)) {
    errors.push({
      path,
      rule: 'nonFiniteNumber',
      message: `${String(data)} is not a finite number; NaN and Infinity are not allowed.`,
    });
  } else if (Array.isArray(data)) {
    data.forEach((value, index) => {
      errors.push(...checkNonFiniteNumbers(value, `${path}[${index}]`));
    });
  } else if (data !== null && typeof data === 'object') {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      errors.push(...checkNonFiniteNumbers(value, `${path}.${key}`));
    }
  }
  return errors;
}

/**
 * Reject a graph node whose `type` isn't allowlisted for its `family`.
 * Mirrors `scenes/validation.py`'s `_check_forbidden_node_types` -- see
 * its docstring for why this check exists at the shared validateScene
 * layer (not only in `behaviorRuntime.ts`'s execution-time check) and why
 * the `output` family is exempt.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkForbiddenNodeTypes(data: any): SceneValidationError[] {
  const errors: SceneValidationError[] = [];
  const nodes: Array<{ family?: unknown; type?: unknown }> = data.graph?.nodes ?? [];
  nodes.forEach((node, index) => {
    const family = typeof node.family === 'string' ? node.family : undefined;
    const allowed = family ? ALLOWED_NODE_TYPES_BY_FAMILY[family] : undefined;
    if (!allowed || allowed.length === 0) return; // unknown/reserved family
    if (!allowed.includes(node.type as string)) {
      errors.push({
        path: `$.graph.nodes[${index}].type`,
        rule: 'forbiddenNodeType',
        message: `type ${JSON.stringify(node.type)} is not allowlisted for family ${JSON.stringify(family)}.`,
      });
    }
  });
  return errors;
}

/** Detects a cycle anywhere in a set of directed edges using standard
 * three-color DFS. Returns the id of one node participating in a cycle,
 * or `null` if the graph is acyclic. Lives here (not
 * `frontend/src/runtime/behaviorRuntime.ts`, which re-exports it) so
 * `checkGraphCycles` below can use it too -- previously graph *connection*
 * cycles (as opposed to group `childIds` cycles, checked by
 * `hasGroupCycle` above) were detected only by
 * `behaviorRuntime.ts`'s `validateBehaviorGraph`, an execution-time-only
 * check, meaning a cyclic graph could still be saved, published, and
 * exported; it just could never run (Task 72). `frontend/src/pages/graphEditing.ts`'s
 * `checkGraphConnection` also reuses this exact algorithm (via
 * `behaviorRuntime.ts`'s re-export) to reject a candidate connection that
 * would introduce a cycle before ever writing it to scene state, rather
 * than a third implementation that could disagree with either check. */
export function findCycle(
  nodeIds: string[],
  edges: Array<{ from: string; to: string }>,
): string | null {
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of edges) {
    if (adjacency.has(edge.from)) adjacency.get(edge.from)!.push(edge.to);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(nodeIds.map((id) => [id, WHITE]));
  let cycleNode: string | null = null;

  function visit(id: string): void {
    if (cycleNode !== null) return;
    color.set(id, GRAY);
    for (const next of adjacency.get(id) ?? []) {
      if (cycleNode !== null) return;
      const nextColor = color.get(next);
      if (nextColor === GRAY) {
        cycleNode = next;
        return;
      }
      if (nextColor === WHITE) visit(next);
    }
    color.set(id, BLACK);
  }

  for (const id of nodeIds) {
    if (cycleNode !== null) break;
    if (color.get(id) === WHITE) visit(id);
  }
  return cycleNode;
}

function duplicateIds(items: Array<{ id?: unknown }>, collection: string): SceneValidationError[] {
  const seen = new Set<string>();
  const errors: SceneValidationError[] = [];
  for (const item of items) {
    const itemId = String(item.id);
    if (seen.has(itemId)) {
      errors.push({
        path: `$.${collection}`,
        rule: 'duplicateId',
        message: `Duplicate id '${itemId}' in ${collection}.`,
      });
    }
    seen.add(itemId);
  }
  return errors;
}

function hasGroupCycle(
  groupId: string,
  groupsById: Map<string, { childIds: string[] }>,
  visiting: Set<string>,
): boolean {
  if (visiting.has(groupId)) return true;
  const nextVisiting = new Set(visiting);
  nextVisiting.add(groupId);
  const group = groupsById.get(groupId);
  for (const childId of group?.childIds ?? []) {
    if (groupsById.has(childId) && hasGroupCycle(childId, groupsById, nextVisiting)) {
      return true;
    }
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkReferences(data: any): SceneValidationError[] {
  const errors: SceneValidationError[] = [];

  const layers: Array<{ id: string }> = data.layers ?? [];
  const shapes: Array<{ id: string; layerId: string; groupId: string | null }> = data.shapes ?? [];
  const groups: Array<{ id: string; layerId: string; childIds: string[] }> = data.groups ?? [];
  const nodes: Array<{ id: string }> = data.graph?.nodes ?? [];
  const connections: Array<{ id: string; fromNodeId: string; toNodeId: string }> =
    data.graph?.connections ?? [];
  const bindings: Array<{ id: string; targetScope: string; targetId: string | null }> =
    data.bindings ?? [];

  errors.push(...duplicateIds(layers, 'layers'));
  errors.push(...duplicateIds(shapes, 'shapes'));
  errors.push(...duplicateIds(groups, 'groups'));
  errors.push(...duplicateIds(nodes, 'graph.nodes'));
  errors.push(...duplicateIds(connections, 'graph.connections'));
  errors.push(...duplicateIds(bindings, 'bindings'));

  const layerIds = new Set(layers.map((l) => l.id));
  const shapeIds = new Set(shapes.map((s) => s.id));
  const groupIds = new Set(groups.map((g) => g.id));
  const nodeIds = new Set(nodes.map((n) => n.id));

  shapes.forEach((shape, index) => {
    if (!layerIds.has(shape.layerId)) {
      errors.push({
        path: `$.shapes[${index}].layerId`,
        rule: 'danglingReference',
        message: `layerId '${shape.layerId}' does not match any layer.`,
      });
    }
    if (shape.groupId !== null && shape.groupId !== undefined && !groupIds.has(shape.groupId)) {
      errors.push({
        path: `$.shapes[${index}].groupId`,
        rule: 'danglingReference',
        message: `groupId '${shape.groupId}' does not match any group.`,
      });
    }
  });

  // Task 111 (issue #142): every shape is its own independent layer -- no
  // two shapes may share a layerId. Mirrors scenes/validation.py's
  // identical check (see that module's doc comment for why this is a
  // sibling check to danglingReference rather than a schema constraint,
  // and why a legacy document isn't rejected outright -- see
  // `normalizeSceneLayers` below).
  const shapeIndicesByLayerId = new Map<string, number[]>();
  shapes.forEach((shape, index) => {
    if (shape.layerId == null) return;
    const indices = shapeIndicesByLayerId.get(shape.layerId) ?? [];
    indices.push(index);
    shapeIndicesByLayerId.set(shape.layerId, indices);
  });
  for (const [layerId, indices] of shapeIndicesByLayerId) {
    if (indices.length > 1) {
      for (const index of indices) {
        errors.push({
          path: `$.shapes[${index}].layerId`,
          rule: 'duplicateLayerAssignment',
          message: `layerId '${layerId}' is assigned to ${indices.length} shapes; each shape must have its own layer.`,
        });
      }
    }
  }

  const groupsById = new Map(groups.map((g) => [g.id, g]));
  groups.forEach((group, index) => {
    if (!layerIds.has(group.layerId)) {
      errors.push({
        path: `$.groups[${index}].layerId`,
        rule: 'danglingReference',
        message: `layerId '${group.layerId}' does not match any layer.`,
      });
    }
    (group.childIds ?? []).forEach((childId, childIndex) => {
      if (childId === group.id) {
        errors.push({
          path: `$.groups[${index}].childIds[${childIndex}]`,
          rule: 'danglingReference',
          message: 'A group cannot list itself as a child.',
        });
      } else if (!shapeIds.has(childId) && !groupIds.has(childId)) {
        errors.push({
          path: `$.groups[${index}].childIds[${childIndex}]`,
          rule: 'danglingReference',
          message: `childId '${childId}' does not match any shape or group.`,
        });
      }
    });
    if (hasGroupCycle(group.id, groupsById, new Set())) {
      errors.push({
        path: `$.groups[${index}].childIds`,
        rule: 'cyclicReference',
        message: `Group '${group.id}' contains a cycle through its children.`,
      });
    }
  });

  bindings.forEach((binding, index) => {
    if (binding.targetScope === 'shape' && !shapeIds.has(binding.targetId ?? '')) {
      errors.push({
        path: `$.bindings[${index}].targetId`,
        rule: 'danglingReference',
        message: `targetId '${binding.targetId}' does not match any shape.`,
      });
    } else if (binding.targetScope === 'group' && !groupIds.has(binding.targetId ?? '')) {
      errors.push({
        path: `$.bindings[${index}].targetId`,
        rule: 'danglingReference',
        message: `targetId '${binding.targetId}' does not match any group.`,
      });
    } else if (
      (binding.targetScope === 'scene' || binding.targetScope === 'interaction') &&
      binding.targetId !== null
    ) {
      errors.push({
        path: `$.bindings[${index}].targetId`,
        rule: 'invalidValue',
        message: `targetId must be null when targetScope is '${binding.targetScope}'.`,
      });
    }
  });

  errors.push(...checkForbiddenNodeTypes(data));

  const graphCycleNodeIds = nodes
    .map((n) => n.id)
    .filter((id): id is string => typeof id === 'string');
  const graphCycleEdges = connections
    .filter((c) => typeof c.fromNodeId === 'string' && typeof c.toNodeId === 'string')
    .map((c) => ({ from: c.fromNodeId, to: c.toNodeId }));
  const graphCycleNode = findCycle(graphCycleNodeIds, graphCycleEdges);
  if (graphCycleNode !== null) {
    errors.push({
      path: '$.graph.connections',
      rule: 'graphCycle',
      message: `Graph contains a cycle through node '${graphCycleNode}'.`,
    });
  }

  connections.forEach((connection, index) => {
    if (!nodeIds.has(connection.fromNodeId)) {
      errors.push({
        path: `$.graph.connections[${index}].fromNodeId`,
        rule: 'danglingReference',
        message: `fromNodeId '${connection.fromNodeId}' does not match any graph node.`,
      });
    }
    if (!nodeIds.has(connection.toNodeId)) {
      errors.push({
        path: `$.graph.connections[${index}].toNodeId`,
        rule: 'danglingReference',
        message: `toNodeId '${connection.toNodeId}' does not match any graph node.`,
      });
    }
  });

  return errors;
}

// The schema bounds the supported draw.io vocabulary; this mirrors the
// server-side reference checks so malformed imports fail consistently.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkDrawioReferences(data: any): SceneValidationError[] {
  if (data.documentType !== 'drawio') return [];
  const document = data.drawio ?? {};
  const layers: Array<{ id: string }> = document.layers ?? [];
  const objects: Array<{ id: string; layerId: string; parentId: string | null; type: string; text?: string }> =
    document.objects ?? [];
  const layerIds = new Set(layers.map((layer) => layer.id));
  const objectIds = new Set(objects.map((object) => object.id));
  const errors: SceneValidationError[] = [];
  if (layerIds.size !== layers.length) {
    errors.push({ path: '$.drawio.layers', rule: 'duplicateId', message: 'Draw.io layer IDs must be unique.' });
  }
  if (objectIds.size !== objects.length) {
    errors.push({ path: '$.drawio.objects', rule: 'duplicateId', message: 'Draw.io object IDs must be unique.' });
  }
  objects.forEach((object, index) => {
    if (!layerIds.has(object.layerId)) {
      errors.push({
        path: `$.drawio.objects[${index}].layerId`,
        rule: 'danglingReference',
        message: `layerId '${object.layerId}' does not match any draw.io layer.`,
      });
    }
    if (object.parentId !== null && !objectIds.has(object.parentId)) {
      errors.push({
        path: `$.drawio.objects[${index}].parentId`,
        rule: 'danglingReference',
        message: `parentId '${object.parentId}' does not match any draw.io object.`,
      });
    }
    if (object.type === 'text' && !object.text?.trim()) {
      errors.push({
        path: `$.drawio.objects[${index}].text`,
        rule: 'invalidValue',
        message: 'Text objects require non-empty text.',
      });
    }
  });
  return errors;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupNestingDepth(
  groupId: string,
  groupsById: Map<string, any>,
  seen: Set<string>,
): number {
  if (seen.has(groupId)) return 0; // a cycle is reported separately by checkReferences
  const group = groupsById.get(groupId);
  if (!group) return 0;
  const childGroupIds: string[] = (group.childIds ?? []).filter((c: string) => groupsById.has(c));
  if (childGroupIds.length === 0) return 1;
  const nextSeen = new Set(seen);
  nextSeen.add(groupId);
  return 1 + Math.max(...childGroupIds.map((c) => groupNestingDepth(c, groupsById, nextSeen)));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkLimits(data: any): SceneValidationError[] {
  const errors: SceneValidationError[] = [];

  const cap = (path: string, count: number, limitKey: string) => {
    const limit = LIMITS[limitKey];
    if (count > limit) {
      errors.push({
        path,
        rule: 'limitExceeded',
        message: `${limitKey} exceeded: ${count} exceeds the limit of ${limit}.`,
      });
    }
  };

  const shapes: Array<Record<string, unknown>> = data.shapes ?? [];
  const groups: Array<{ id: string; childIds: string[] }> = data.groups ?? [];
  const layers: unknown[] = data.layers ?? [];
  const bindings: unknown[] = data.bindings ?? [];
  const nodes: Array<{ family: string }> = data.graph?.nodes ?? [];
  const connections: unknown[] = data.graph?.connections ?? [];

  cap('$.shapes', shapes.length, 'maxShapes');
  cap('$.groups', groups.length, 'maxGroups');
  cap('$.layers', layers.length, 'maxLayers');
  cap('$.bindings', bindings.length, 'maxBindings');
  cap('$.graph.nodes', nodes.length, 'maxGraphNodes');
  cap('$.graph.connections', connections.length, 'maxGraphConnections');

  const conditionalCount = nodes.filter((n) => n.family === 'condition').length;
  cap('$.graph.nodes', conditionalCount, 'maxConditionalNodes');

  groups.forEach((group, index) => {
    cap(`$.groups[${index}].childIds`, (group.childIds ?? []).length, 'maxGroupChildIds');
  });

  shapes.forEach((shape, index) => {
    if (shape.type === 'path') {
      cap(`$.shapes[${index}].points`, ((shape.points as unknown[]) ?? []).length, 'maxPathPoints');
    }
  });

  const emitters = shapes.filter((s) => s.type === 'particleEmitter');
  cap('$.shapes', emitters.length, 'maxParticleEmitters');
  const totalRate = emitters.reduce((sum, e) => sum + ((e.rate as number) ?? 0), 0);
  cap('$.shapes', totalRate, 'maxTotalParticleRate');

  const maxDepth = LIMITS.maxGroupNestingDepth;
  const groupsById = new Map(groups.map((g) => [g.id, g]));
  groups.forEach((group, index) => {
    const depth = groupNestingDepth(group.id, groupsById, new Set());
    if (depth > maxDepth) {
      errors.push({
        path: `$.groups[${index}]`,
        rule: 'limitExceeded',
        message: `maxGroupNestingDepth exceeded: ${depth} exceeds the limit of ${maxDepth}.`,
      });
    }
  });

  const payloadBytes = new TextEncoder().encode(JSON.stringify(data)).length;
  cap('$', payloadBytes, 'maxScenePayloadBytes');

  return errors;
}

type NormalizableLayer = {
  id: string;
  name: string;
  order: number;
  visible: boolean;
  locked: boolean;
  [key: string]: unknown;
};
type NormalizableShape = { id: string; layerId: string; [key: string]: unknown };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NormalizableScene = {
  layers: NormalizableLayer[];
  shapes: NormalizableShape[];
  [key: string]: any;
};

/**
 * Task 111 (issue #142): read-time normalization for the shared-layerId
 * invariant `checkReferences`' `duplicateLayerAssignment` rule now
 * enforces going forward. Mirrors `scenes/validation.py`'s
 * `normalize_scene_layers` -- see that function's doc comment for the full
 * rationale (why this exists as a caller-invoked step rather than inside
 * `validateScene` itself, and why `SceneVersion.scene_json` immutability
 * rules out a database backfill).
 *
 * Given a scene document that may predate this task (multiple shapes
 * sharing one `layerId`, which was allowed before), returns an equivalent
 * document where every such conflict is resolved by giving each
 * conflicting shape its own new layer (cloned from the original layer's
 * `visible`/`locked` state, named with a "(copy)" suffix), preserving
 * every shape's relative position in `shapes` (draw order) and every
 * other field untouched. Returns the original object unchanged (and
 * `changed: false`) if there was nothing to normalize.
 *
 * Called by `useEditorWorkspaceState.ts` (and every other call site that
 * loads a `SceneVersion.scene_json` into a working copy --
 * `EditorWorkspace.tsx`'s restore/AI-accept handlers) before
 * `validateScene`, so a legacy scene never fails to load just because it
 * predates this invariant.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeSceneLayers(data: any): { scene: any; changed: boolean } {
  const scene = data as NormalizableScene;
  const shapes: NormalizableShape[] = Array.isArray(scene.shapes) ? scene.shapes : [];
  const layers: NormalizableLayer[] = Array.isArray(scene.layers) ? scene.layers : [];
  const layersById = new Map(layers.map((l) => [l.id, l]));

  const usedIds = new Set<string>([
    ...layers.map((l) => l.id),
    ...shapes.map((s) => s.id),
    ...(Array.isArray(scene.groups) ? scene.groups.map((g: { id: string }) => g.id) : []),
  ]);

  let counter = 1;
  function freshId(base: string): string {
    let candidate = `${base}-layer-${counter}`;
    while (usedIds.has(candidate)) {
      counter += 1;
      candidate = `${base}-layer-${counter}`;
    }
    usedIds.add(candidate);
    counter += 1;
    return candidate;
  }

  let maxOrder = layers.reduce((max, l) => Math.max(max, l.order ?? 0), -1);

  const seenLayerIds = new Set<string>();
  const newLayers = [...layers];
  let changed = false;
  const newShapes = shapes.map((shape) => {
    const layerId = shape.layerId;
    if (layerId != null && seenLayerIds.has(layerId)) {
      const original = layersById.get(layerId);
      maxOrder += 1;
      const newLayer: NormalizableLayer = {
        id: freshId(layerId),
        name: original ? `${original.name} (copy)` : 'Layer',
        order: maxOrder,
        visible: original?.visible ?? true,
        locked: original?.locked ?? false,
      };
      newLayers.push(newLayer);
      changed = true;
      return { ...shape, layerId: newLayer.id };
    }
    if (layerId != null) seenLayerIds.add(layerId);
    return shape;
  });

  if (!changed) return { scene: data, changed: false };
  return { scene: { ...scene, layers: newLayers, shapes: newShapes }, changed: true };
}

export function validateScene(data: unknown): SceneValidationResult {
  if (typeof data !== 'object' || data === null) {
    return {
      valid: false,
      errors: [{ path: '$', rule: 'wrongType', message: 'Scene document must be a JSON object.' }],
    };
  }

  const schemaVersion = (data as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    return {
      valid: false,
      errors: [
        {
          path: '$.schemaVersion',
          rule: 'unsupportedSchemaVersion',
          message: `Unsupported schema version: ${JSON.stringify(schemaVersion)}. Only version ${SUPPORTED_SCHEMA_VERSION} is supported.`,
        },
      ],
    };
  }

  const structuralErrors = checkStructure(data);
  if (structuralErrors.length > 0) {
    return { valid: false, errors: structuralErrors };
  }

  const nonFiniteErrors = checkNonFiniteNumbers(data);
  if (nonFiniteErrors.length > 0) {
    return { valid: false, errors: nonFiniteErrors };
  }

  const referenceErrors = checkReferences(data);
  referenceErrors.push(...checkDrawioReferences(data));
  if (referenceErrors.length > 0) {
    return { valid: false, errors: referenceErrors };
  }

  const limitErrors = checkLimits(data);
  return { valid: limitErrors.length === 0, errors: limitErrors };
}

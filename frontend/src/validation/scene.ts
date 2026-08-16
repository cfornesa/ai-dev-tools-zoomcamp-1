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

export const LIMITS: Record<string, number> = Object.fromEntries(
  Object.entries(rawLimits).filter(([key]) => !key.startsWith('$')),
) as Record<string, number>;

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

  const referenceErrors = checkReferences(data);
  if (referenceErrors.length > 0) {
    return { valid: false, errors: referenceErrors };
  }

  const limitErrors = checkLimits(data);
  return { valid: limitErrors.length === 0, errors: limitErrors };
}

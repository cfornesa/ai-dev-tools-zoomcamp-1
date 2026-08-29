/**
 * Validate canonical 3D scene documents against ../../../schema/scene3d.schema.json.
 *
 * Mirrors `scenes/validation3d.py` — both load the same schema files from
 * `schema/` and apply the same three-stage pipeline: schema
 * version/document type, then JSON Schema structure, then referential
 * integrity and complexity/payload limits. See `schema/README3d.md` for
 * why the pipeline is split this way, and `frontend/src/validation/scene.ts`
 * for the identical pattern this mirrors for the 2D schema.
 *
 * This validation is advisory only: it exists to give editor users fast
 * feedback, not to be trusted for persisted or exported data. The Django
 * server (`scenes.validation3d.validate_scene3d`) is authoritative.
 *
 * A `scene3d` document is a genuinely separate document family from the 2D
 * canonical scene (see #208's decision): never pass its output to
 * `validateScene` in `scene.ts`, or vice versa.
 */
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';

import scene3dSchema from '../../../schema/scene3d.schema.json';
import rawLimits3d from '../../../schema/limits3d.json';

export const LIMITS3D: Record<string, number> = Object.fromEntries(
  Object.entries(rawLimits3d).filter(([key]) => !key.startsWith('$')),
) as Record<string, number>;

export const SUPPORTED_SCHEMA_VERSION = 1;
export const SUPPORTED_DOCUMENT_TYPE = 'scene3d';

export type Scene3DValidationError = {
  path: string;
  rule: string;
  message: string;
};

export type Scene3DValidationResult = {
  valid: boolean;
  errors: Scene3DValidationError[];
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
const structuralValidate = ajv.compile(scene3dSchema);

function formatPath(instancePath: string): string {
  if (!instancePath) return '$';
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
    case 'unevaluatedProperties':
      return 'unknownField';
    case 'type':
      return 'wrongType';
    case 'enum':
    case 'const':
    case 'pattern':
    case 'oneOf':
      return 'invalidValue';
    default:
      return 'invalid';
  }
}

function checkStructure(data: unknown): Scene3DValidationError[] {
  structuralValidate(data);
  const ajvErrors = structuralValidate.errors ?? [];
  return ajvErrors.map((error) => ({
    path: formatPath(error.instancePath),
    rule: structuralRuleFor(error),
    message: error.message ?? 'Invalid value.',
  }));
}

/**
 * Reject `NaN`/`Infinity`/`-Infinity` anywhere in the document. See
 * `scene.ts`'s identical check for the full rationale -- kept explicit and
 * symmetric with the Python validator (`scenes/validation3d.py`) rather
 * than relying solely on ajv's `minimum`/`maximum`, which have no bound to
 * check an unbounded field against in the first place.
 */
function checkNonFiniteNumbers(data: unknown, path = '$'): Scene3DValidationError[] {
  const errors: Scene3DValidationError[] = [];
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

function checkDuplicateIds(
  items: Array<{ id?: unknown }>,
  collection: string,
): Scene3DValidationError[] {
  const seen = new Set<string>();
  const errors: Scene3DValidationError[] = [];
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

/**
 * Check cross-references JSON Schema cannot express (see
 * schema/README3d.md's "Fixtures and the schema/validator split"
 * section): ids unique within their collection, and an object's groupId
 * must resolve to a real group or be null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkReferences(data: any): Scene3DValidationError[] {
  const errors: Scene3DValidationError[] = [];

  const lights: Array<{ id?: unknown }> = data.lights ?? [];
  const groups: Array<{ id?: unknown }> = data.groups ?? [];
  const objects: Array<{ id?: unknown; groupId?: unknown }> = data.objects ?? [];

  errors.push(...checkDuplicateIds(lights, 'lights'));
  errors.push(...checkDuplicateIds(groups, 'groups'));
  errors.push(...checkDuplicateIds(objects, 'objects'));

  const groupIds = new Set(groups.map((g) => g.id as string));
  objects.forEach((obj, index) => {
    const groupId = obj.groupId;
    if (groupId != null && !groupIds.has(groupId as string)) {
      errors.push({
        path: `$.objects[${index}].groupId`,
        rule: 'danglingReference',
        message: `groupId ${JSON.stringify(groupId)} does not match any group.`,
      });
    }
  });

  return errors;
}

/** Enforce schema/limits3d.json scene-wide complexity and payload caps. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkLimits(data: any): Scene3DValidationError[] {
  const errors: Scene3DValidationError[] = [];

  function cap(path: string, count: number, limitKey: string): void {
    const limit = LIMITS3D[limitKey];
    if (count > limit) {
      errors.push({
        path,
        rule: 'limitExceeded',
        message: `${limitKey} exceeded: ${count} exceeds the limit of ${limit}.`,
      });
    }
  }

  const objects: unknown[] = data.objects ?? [];
  const groups: unknown[] = data.groups ?? [];
  const lights: unknown[] = data.lights ?? [];

  cap('$.objects', objects.length, 'maxObjects');
  cap('$.groups', groups.length, 'maxGroups');
  cap('$.lights', lights.length, 'maxLights');

  const payloadBytes = new TextEncoder().encode(JSON.stringify(data)).length;
  cap('$', payloadBytes, 'maxScenePayloadBytes');

  return errors;
}

export function validateScene3D(data: unknown): Scene3DValidationResult {
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

  const documentType = (data as { documentType?: unknown }).documentType;
  if (documentType !== SUPPORTED_DOCUMENT_TYPE) {
    return {
      valid: false,
      errors: [
        {
          path: '$.documentType',
          rule: 'invalidValue',
          message: `Unsupported documentType: ${JSON.stringify(documentType)}. Only ${JSON.stringify(SUPPORTED_DOCUMENT_TYPE)} is supported.`,
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
  if (referenceErrors.length > 0) {
    return { valid: false, errors: referenceErrors };
  }

  const limitErrors = checkLimits(data);
  return { valid: limitErrors.length === 0, errors: limitErrors };
}

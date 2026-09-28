/**
 * The first 3D Code-tab grammar slice (issue #1025).
 *
 * This is deliberately a projection of a Scene3DDocument, not a second scene
 * format: object transforms and materials are editable. Parsing starts from the
 * previous document, applies the allowlisted edits, and validates
 * the complete candidate with the canonical Scene3D schema validator.
 */
import type { GrammarParseResult } from './codeGrammar';
import { validateScene3D } from '../validation/scene3d';
import type { Scene3DDocument, Transform3D, Vec3 } from '../pages/scene3dTypes';

export const CODE_GRAMMAR_3D_VERSION = 1;

const HEADER = `// codeGrammar3d v${CODE_GRAMMAR_3D_VERSION}`;
const ROOT_START = 'scene3d.transforms {';
const MATERIALS_ROOT_START = 'scene3d.materials {';
const NUMBER = '-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?';
const ID = '[A-Za-z0-9_-]{1,64}';
const COLOR = '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})';

const FIELD_PATTERN = new RegExp(
  `^(position|rotation|scale) = \\{ x: (${NUMBER}), y: (${NUMBER}), z: (${NUMBER}) \\};$`,
);
const OBJECT_PATTERN = new RegExp(`^object "(${ID})" \\{$`);
const MATERIAL_COLOR_PATTERN = new RegExp(`^(color|emissive) = "(${COLOR})";$`);
const MATERIAL_OPACITY_PATTERN = new RegExp(`^opacity = (${NUMBER});$`);

const TRANSFORM_FIELDS = ['position', 'rotation', 'scale'] as const;
type TransformField = (typeof TRANSFORM_FIELDS)[number];

export type GrammarParseResult3d = GrammarParseResult<Scene3DDocument>;

function formatNumber(value: number): string {
  return JSON.stringify(value);
}

function formatVec3(value: Vec3): string {
  return `{ x: ${formatNumber(value.x)}, y: ${formatNumber(value.y)}, z: ${formatNumber(value.z)} }`;
}

function formatTransformField(field: TransformField, transform: Transform3D): string {
  return `    ${field} = ${formatVec3(transform[field])};`;
}

function formatMaterialField(field: 'color' | 'emissive', value: string): string {
  return `    ${field} = "${value}";`;
}

/** Generate the deterministic, transform-only 3D grammar text. */
export function generateEditable3dTransforms(scene: Scene3DDocument | null): string {
  if (!scene) return `${HEADER}\n${ROOT_START}\n}`;

  const lines = [HEADER, ROOT_START];
  for (const object of scene.objects) {
    lines.push(`  object "${object.id}" {`);
    for (const field of TRANSFORM_FIELDS) {
      lines.push(formatTransformField(field, object.transform));
    }
    lines.push('  }');
  }
  lines.push('}');
  return lines.join('\n');
}

/** Generate the deterministic, material-only 3D grammar text. */
export function generateEditable3dMaterials(scene: Scene3DDocument | null): string {
  if (!scene) return `${HEADER}\n${MATERIALS_ROOT_START}\n}`;

  const lines = [HEADER, MATERIALS_ROOT_START];
  for (const object of scene.objects) {
    lines.push(`  object "${object.id}" {`);
    lines.push(formatMaterialField('color', object.material.color));
    if (object.material.opacity !== undefined) {
      lines.push(`    opacity = ${formatNumber(object.material.opacity)};`);
    }
    if (object.material.emissive !== undefined) {
      lines.push(formatMaterialField('emissive', object.material.emissive));
    }
    lines.push('  }');
  }
  lines.push('}');
  return lines.join('\n');
}

function failure(line: number, message: string): GrammarParseResult3d {
  return { ok: false, errors: [`Line ${line}: ${message}`] };
}

function cloneScene(scene: Scene3DDocument): Scene3DDocument {
  return JSON.parse(JSON.stringify(scene)) as Scene3DDocument;
}

function parseVec3(match: RegExpExecArray): Vec3 {
  return { x: Number(match[2]), y: Number(match[3]), z: Number(match[4]) };
}

function validationFailure(
  result: ReturnType<typeof validateScene3D>,
  fieldLines: Map<string, number>,
): GrammarParseResult3d {
  return {
    ok: false,
    errors: result.errors.map((error) => {
      const objectMatch =
        /^\$\.objects\[(\d+)\]\.((?:transform|material)\.(?:position|rotation|scale|color|opacity|emissive))/.exec(
          error.path,
        );
      const line = objectMatch
        ? (fieldLines.get(`${objectMatch[1]}.${objectMatch[2]}`) ??
          fieldLines.get(`${objectMatch[1]}.${objectMatch[2].split('.').pop()}`) ??
          1)
        : 1;
      return `Line ${line}: ${error.path}: ${error.message}`;
    }),
  };
}

/**
 * Parse the transform-only grammar without executing or evaluating input.
 * Every object in the previous scene must appear exactly once; no object or
 * non-transform field can be added through this projection.
 */
export function parseEditable3dTransforms(
  text: string,
  previousScene: Scene3DDocument,
): GrammarParseResult3d {
  const previousValidation = validateScene3D(previousScene);
  if (!previousValidation.valid) {
    return validationFailure(previousValidation, new Map());
  }

  const lines = text.split(/\r?\n/);
  let index = 0;
  const nextNonEmpty = (): { value: string; line: number } | null => {
    while (index < lines.length && lines[index].trim() === '') index += 1;
    if (index >= lines.length) return null;
    const line = index + 1;
    const value = lines[index].trim();
    index += 1;
    return { value, line };
  };

  const header = nextNonEmpty();
  if (!header || header.value !== HEADER) return failure(header?.line ?? 1, `expected ${HEADER}.`);
  const rootStart = nextNonEmpty();
  if (!rootStart || rootStart.value !== ROOT_START) {
    return failure(rootStart?.line ?? header.line + 1, `expected ${ROOT_START}.`);
  }

  const candidate = cloneScene(previousScene);
  const objectIndexById = new Map(
    candidate.objects.map((object, objectIndex) => [object.id, objectIndex]),
  );
  const seen = new Set<string>();
  const fieldLines = new Map<string, number>();

  while (true) {
    const objectStart = nextNonEmpty();
    if (!objectStart) return failure(lines.length, 'expected an object block or closing `}`.');
    if (objectStart.value === '}') break;

    const objectMatch = OBJECT_PATTERN.exec(objectStart.value);
    if (!objectMatch) {
      return failure(objectStart.line, 'expected `object "<id>" {` or the closing `}`.');
    }
    const objectId = objectMatch[1];
    const objectIndex = objectIndexById.get(objectId);
    if (objectIndex === undefined) {
      return failure(
        objectStart.line,
        `object "${objectId}" is not present in the previous scene.`,
      );
    }
    if (seen.has(objectId))
      return failure(objectStart.line, `object "${objectId}" appears more than once.`);
    seen.add(objectId);

    const transforms = candidate.objects[objectIndex].transform;
    for (const field of TRANSFORM_FIELDS) {
      const fieldLine = nextNonEmpty();
      if (!fieldLine)
        return failure(lines.length, `object "${objectId}" is missing its ${field} line.`);
      const fieldMatch = FIELD_PATTERN.exec(fieldLine.value);
      if (!fieldMatch || fieldMatch[1] !== field) {
        return failure(
          fieldLine.line,
          `object "${objectId}" expected the ${field} transform line.`,
        );
      }
      transforms[field] = parseVec3(fieldMatch);
      fieldLines.set(`${objectIndex}.${field}`, fieldLine.line);
    }

    const objectEnd = nextNonEmpty();
    if (!objectEnd || objectEnd.value !== '}') {
      return failure(
        objectEnd?.line ?? lines.length,
        `object ${objectId} must end with a closing brace.`,
      );
    }
  }

  const trailing = nextNonEmpty();
  if (trailing) return failure(trailing.line, 'only one transform block is allowed.');
  for (const object of candidate.objects) {
    if (!seen.has(object.id))
      return failure(2, `object "${object.id}" is missing from the transform block.`);
  }

  const validation = validateScene3D(candidate);
  return validation.valid
    ? { ok: true, scene: candidate }
    : validationFailure(validation, fieldLines);
}

/**
 * Parse the material-only grammar without executing or evaluating input.
 * Every object in the previous scene must appear exactly once; no object or
 * non-material field can be added through this projection.
 */
export function parseEditable3dMaterials(
  text: string,
  previousScene: Scene3DDocument,
): GrammarParseResult3d {
  const previousValidation = validateScene3D(previousScene);
  if (!previousValidation.valid) {
    return validationFailure(previousValidation, new Map());
  }

  const lines = text.split(/\r?\n/);
  let index = 0;
  const nextNonEmpty = (): { value: string; line: number } | null => {
    while (index < lines.length && lines[index].trim() === '') index += 1;
    if (index >= lines.length) return null;
    const line = index + 1;
    const value = lines[index].trim();
    index += 1;
    return { value, line };
  };

  const header = nextNonEmpty();
  if (!header || header.value !== HEADER) return failure(header?.line ?? 1, `expected ${HEADER}.`);
  const rootStart = nextNonEmpty();
  if (!rootStart || rootStart.value !== MATERIALS_ROOT_START) {
    return failure(rootStart?.line ?? header.line + 1, `expected ${MATERIALS_ROOT_START}.`);
  }

  const candidate = cloneScene(previousScene);
  const objectIndexById = new Map(
    candidate.objects.map((object, objectIndex) => [object.id, objectIndex]),
  );
  const seen = new Set<string>();
  const fieldLines = new Map<string, number>();

  while (true) {
    const objectStart = nextNonEmpty();
    if (!objectStart) return failure(lines.length, 'expected an object block or closing `}`.');
    if (objectStart.value === '}') break;

    const objectMatch = OBJECT_PATTERN.exec(objectStart.value);
    if (!objectMatch) {
      return failure(objectStart.line, 'expected `object "<id>" {` or the closing `}`.');
    }
    const objectId = objectMatch[1];
    const objectIndex = objectIndexById.get(objectId);
    if (objectIndex === undefined) {
      return failure(
        objectStart.line,
        `object "${objectId}" is not present in the previous scene.`,
      );
    }
    if (seen.has(objectId))
      return failure(objectStart.line, `object "${objectId}" appears more than once.`);
    seen.add(objectId);

    const material = candidate.objects[objectIndex].material;
    const colorLine = nextNonEmpty();
    if (!colorLine) return failure(lines.length, `object "${objectId}" is missing its color line.`);
    const colorMatch = MATERIAL_COLOR_PATTERN.exec(colorLine.value);
    if (!colorMatch || colorMatch[1] !== 'color') {
      return failure(colorLine.line, `object "${objectId}" expected its color material line.`);
    }
    material.color = colorMatch[2];
    fieldLines.set(`${objectIndex}.material.color`, colorLine.line);

    const seenFields = new Set<string>(['color']);
    while (true) {
      const fieldLine = nextNonEmpty();
      if (!fieldLine)
        return failure(lines.length, `object "${objectId}" is missing its closing brace.`);
      if (fieldLine.value === '}') break;

      const colorFieldMatch = MATERIAL_COLOR_PATTERN.exec(fieldLine.value);
      const opacityMatch = MATERIAL_OPACITY_PATTERN.exec(fieldLine.value);
      const field = colorFieldMatch?.[1] ?? (opacityMatch ? 'opacity' : null);
      if (!field || (field !== 'emissive' && field !== 'opacity')) {
        return failure(
          fieldLine.line,
          `object "${objectId}" contains an unsupported or malformed material field.`,
        );
      }
      if (seenFields.has(field)) {
        return failure(fieldLine.line, `object "${objectId}" repeats its ${field} material field.`);
      }
      seenFields.add(field);
      if (field === 'emissive') {
        material.emissive = colorFieldMatch![2];
      } else {
        material.opacity = Number(opacityMatch![1]);
      }
      fieldLines.set(`${objectIndex}.material.${field}`, fieldLine.line);
    }
  }

  const trailing = nextNonEmpty();
  if (trailing) return failure(trailing.line, 'only one materials block is allowed.');
  for (const object of candidate.objects) {
    if (!seen.has(object.id))
      return failure(2, `object "${object.id}" is missing from the materials block.`);
  }

  const validation = validateScene3D(candidate);
  return validation.valid
    ? { ok: true, scene: candidate }
    : validationFailure(validation, fieldLines);
}

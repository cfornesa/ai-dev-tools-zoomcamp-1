/**
 * The first 3D Code-tab grammar slice (issue #1025).
 *
 * This is deliberately a projection of a Scene3DDocument, not a second scene
 * format: only object transforms are editable. Parsing starts from the
 * previous document, applies the allowlisted transform edits, and validates
 * the complete candidate with the canonical Scene3D schema validator.
 */
import type { GrammarParseResult } from './codeGrammar';
import { validateScene3D } from '../validation/scene3d';
import type { Scene3DDocument, Transform3D, Vec3 } from '../pages/scene3dTypes';

export const CODE_GRAMMAR_3D_VERSION = 1;

const HEADER = `// codeGrammar3d v${CODE_GRAMMAR_3D_VERSION}`;
const ROOT_START = 'scene3d.transforms {';
const NUMBER = '-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?';
const ID = '[A-Za-z0-9_-]{1,64}';

const FIELD_PATTERN = new RegExp(
  `^(position|rotation|scale) = \\{ x: (${NUMBER}), y: (${NUMBER}), z: (${NUMBER}) \\};$`,
);
const OBJECT_PATTERN = new RegExp(`^object "(${ID})" \\{$`);

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
      const objectMatch = /^\$\.objects\[(\d+)\]\.transform\.(position|rotation|scale)/.exec(
        error.path,
      );
      const line = objectMatch ? (fieldLines.get(`${objectMatch[1]}.${objectMatch[2]}`) ?? 1) : 1;
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

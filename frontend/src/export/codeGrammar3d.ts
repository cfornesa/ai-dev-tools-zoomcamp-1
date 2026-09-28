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
import type { LightType, Scene3DDocument, Transform3D, Vec3 } from '../pages/scene3dTypes';

export const CODE_GRAMMAR_3D_VERSION = 1;

const HEADER = `// codeGrammar3d v${CODE_GRAMMAR_3D_VERSION}`;
const ROOT_START = 'scene3d.transforms {';
const MATERIALS_ROOT_START = 'scene3d.materials {';
const LIGHTS_ROOT_START = 'scene3d.lights {';
const NUMBER = '-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?';
const ID = '[A-Za-z0-9_-]{1,64}';
const COLOR = '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})';

const FIELD_PATTERN = new RegExp(
  `^(position|rotation|scale) = \\{ x: (${NUMBER}), y: (${NUMBER}), z: (${NUMBER}) \\};$`,
);
const OBJECT_PATTERN = new RegExp(`^object "(${ID})" \\{$`);
const MATERIAL_COLOR_PATTERN = new RegExp(`^(color|emissive) = "(${COLOR})";$`);
const MATERIAL_OPACITY_PATTERN = new RegExp(`^opacity = (${NUMBER});$`);
const LIGHT_PATTERN = new RegExp(`^light "(${ID})" \\{$`);
const LIGHT_TYPE_PATTERN = /^type = "([A-Za-z]+)";$/;
const LIGHT_COLOR_PATTERN = new RegExp(`^color = "(${COLOR})";$`);
const LIGHT_INTENSITY_PATTERN = new RegExp(`^intensity = (${NUMBER});$`);
const LIGHT_NAME_PATTERN = /^name = "([A-Za-z0-9 _-]{1,200})";$/;
const LIGHT_VEC3_PATTERN = new RegExp(
  `^(position|direction) = \\{ x: (${NUMBER}), y: (${NUMBER}), z: (${NUMBER}) \\};$`,
);

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

/** Generate the deterministic, schema-allowlisted light-only 3D grammar. */
export function generateEditable3dLights(scene: Scene3DDocument | null): string {
  if (!scene) return `${HEADER}\n${LIGHTS_ROOT_START}\n}`;

  const lines = [HEADER, LIGHTS_ROOT_START];
  for (const light of scene.lights) {
    lines.push(`  light "${light.id}" {`);
    if (light.name !== undefined) lines.push(`    name = "${light.name}";`);
    lines.push(`    type = "${light.type}";`);
    lines.push(`    color = "${light.color}";`);
    lines.push(`    intensity = ${formatNumber(light.intensity)};`);
    if (light.position !== undefined) lines.push(`    position = ${formatVec3(light.position)};`);
    if (light.direction !== undefined)
      lines.push(`    direction = ${formatVec3(light.direction)};`);
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
      const lightMatch =
        /^\$\.lights\[(\d+)\]\.(name|type|color|intensity|position|direction)/.exec(error.path);
      const line = objectMatch
        ? (fieldLines.get(`${objectMatch[1]}.${objectMatch[2]}`) ??
          fieldLines.get(`${objectMatch[1]}.${objectMatch[2].split('.').pop()}`) ??
          1)
        : lightMatch
          ? (fieldLines.get(`light.${lightMatch[1]}.${lightMatch[2]}`) ?? 1)
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

/** Parse the light-only grammar without executing or evaluating input. */
export function parseEditable3dLights(
  text: string,
  previousScene: Scene3DDocument,
): GrammarParseResult3d {
  const previousValidation = validateScene3D(previousScene);
  if (!previousValidation.valid) return validationFailure(previousValidation, new Map());

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
  if (!rootStart || rootStart.value !== LIGHTS_ROOT_START) {
    return failure(rootStart?.line ?? header.line + 1, `expected ${LIGHTS_ROOT_START}.`);
  }

  const candidate = cloneScene(previousScene);
  const lightIndexById = new Map(
    candidate.lights.map((light, lightIndex) => [light.id, lightIndex]),
  );
  const seen = new Set<string>();
  const fieldLines = new Map<string, number>();

  while (true) {
    const lightStart = nextNonEmpty();
    if (!lightStart) return failure(lines.length, 'expected a light block or closing `}`.');
    if (lightStart.value === '}') break;
    const lightMatch = LIGHT_PATTERN.exec(lightStart.value);
    if (!lightMatch)
      return failure(lightStart.line, 'expected `light "<id>" {` or the closing `}`.');
    const lightId = lightMatch[1];
    const lightIndex = lightIndexById.get(lightId);
    if (lightIndex === undefined)
      return failure(lightStart.line, `light "${lightId}" is not present in the previous scene.`);
    if (seen.has(lightId))
      return failure(lightStart.line, `light "${lightId}" appears more than once.`);
    seen.add(lightId);

    const light = candidate.lights[lightIndex];
    const nameOrType = nextNonEmpty();
    if (!nameOrType) return failure(lines.length, `light "${lightId}" is missing its type line.`);
    let typeLine = nameOrType;
    const nameMatch = LIGHT_NAME_PATTERN.exec(nameOrType.value);
    if (nameMatch) {
      light.name = nameMatch[1];
      fieldLines.set(`light.${lightIndex}.name`, nameOrType.line);
      typeLine = nextNonEmpty() ?? { value: '', line: lines.length };
    }
    const typeMatch = LIGHT_TYPE_PATTERN.exec(typeLine.value);
    if (!typeMatch || !(['directional', 'point', 'ambient'] as string[]).includes(typeMatch[1])) {
      return failure(typeLine.line, `light "${lightId}" has an unsupported light type.`);
    }
    light.type = typeMatch[1] as LightType;
    fieldLines.set(`light.${lightIndex}.type`, typeLine.line);

    const colorLine = nextNonEmpty();
    const colorMatch = colorLine && LIGHT_COLOR_PATTERN.exec(colorLine.value);
    if (!colorLine || !colorMatch) {
      return failure(
        colorLine?.line ?? lines.length,
        colorLine
          ? `light "${lightId}" contains an unsupported or malformed light property.`
          : `light "${lightId}" expected its color line.`,
      );
    }
    light.color = colorMatch[1];
    fieldLines.set(`light.${lightIndex}.color`, colorLine.line);

    const intensityLine = nextNonEmpty();
    const intensityMatch = intensityLine && LIGHT_INTENSITY_PATTERN.exec(intensityLine.value);
    if (!intensityLine || !intensityMatch) {
      return failure(
        intensityLine?.line ?? lines.length,
        intensityLine
          ? `light "${lightId}" contains an unsupported or malformed light property.`
          : `light "${lightId}" expected its intensity line.`,
      );
    }
    light.intensity = Number(intensityMatch[1]);
    fieldLines.set(`light.${lightIndex}.intensity`, intensityLine.line);

    const seenFields = new Set<string>(['name', 'type', 'color', 'intensity']);
    while (true) {
      const fieldLine = nextNonEmpty();
      if (!fieldLine)
        return failure(lines.length, `light "${lightId}" is missing its closing brace.`);
      if (fieldLine.value === '}') break;
      const vecMatch = LIGHT_VEC3_PATTERN.exec(fieldLine.value);
      if (!vecMatch || seenFields.has(vecMatch[1])) {
        return failure(
          fieldLine.line,
          `light "${lightId}" contains an unsupported or repeated light property.`,
        );
      }
      const field = vecMatch[1] as 'position' | 'direction';
      seenFields.add(field);
      light[field] = { x: Number(vecMatch[2]), y: Number(vecMatch[3]), z: Number(vecMatch[4]) };
      fieldLines.set(`light.${lightIndex}.${field}`, fieldLine.line);
    }
  }

  const trailing = nextNonEmpty();
  if (trailing) return failure(trailing.line, 'only one lights block is allowed.');
  for (const light of candidate.lights) {
    if (!seen.has(light.id))
      return failure(2, `light "${light.id}" is missing from the lights block.`);
  }

  const validation = validateScene3D(candidate);
  return validation.valid
    ? { ok: true, scene: candidate }
    : validationFailure(validation, fieldLines);
}

function sectionBody(section: string): string[] {
  return section.split('\n').slice(1);
}

/** Generate one editable text block composing transforms, materials, and lights. */
export function generateEditable3dScene(scene: Scene3DDocument | null): string {
  const sections = [
    generateEditable3dTransforms(scene),
    generateEditable3dMaterials(scene),
    generateEditable3dLights(scene),
  ];
  return [HEADER, ...sections.flatMap(sectionBody)].join('\n');
}

/** Parse the combined editable text block, applying all three projections atomically. */
export function parseEditable3dScene(
  text: string,
  previousScene: Scene3DDocument,
): GrammarParseResult3d {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== HEADER) return failure(1, `expected ${HEADER}.`);
  const roots = [ROOT_START, MATERIALS_ROOT_START, LIGHTS_ROOT_START];
  let cursor = 1;
  let scene = previousScene;
  for (const root of roots) {
    while (cursor < lines.length && lines[cursor].trim() === '') cursor += 1;
    const start = cursor;
    if (lines[cursor]?.trim() !== root) return failure(cursor + 1, `expected ${root}.`);
    let depth = 0;
    do {
      depth += (lines[cursor].match(/\{/g) ?? []).length;
      depth -= (lines[cursor].match(/\}/g) ?? []).length;
      cursor += 1;
    } while (cursor < lines.length && depth > 0);
    if (depth !== 0) return failure(lines.length, `unterminated ${root} block.`);
    const section = [HEADER, ...lines.slice(start, cursor)].join('\n');
    const result =
      root === ROOT_START
        ? parseEditable3dTransforms(section, scene)
        : root === MATERIALS_ROOT_START
          ? parseEditable3dMaterials(section, scene)
          : parseEditable3dLights(section, scene);
    if (!result.ok) {
      return {
        ok: false,
        errors: result.errors.map((error) => {
          const match = /^Line (\d+):(.*)$/.exec(error);
          return match ? `Line ${start + Number(match[1]) - 1}:${match[2]}` : error;
        }),
      };
    }
    scene = result.scene;
  }
  while (cursor < lines.length && lines[cursor].trim() === '') cursor += 1;
  return cursor === lines.length
    ? { ok: true, scene }
    : failure(cursor + 1, 'unexpected trailing content.');
}

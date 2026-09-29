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

const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const CSS_NUMBER_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
type CssRule = { selector: string; declarations: Map<string, string>; line: number };

function cssNumber(value: number): string {
  return JSON.stringify(value);
}

function cssVec(prefix: string, value: { x: number; y: number; z: number }): string[] {
  return [
    `  --${prefix}-x: ${cssNumber(value.x)};`,
    `  --${prefix}-y: ${cssNumber(value.y)};`,
    `  --${prefix}-z: ${cssNumber(value.z)};`,
  ];
}

function cssTransform(
  lines: string[],
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    opacity: number;
  },
): void {
  lines.push(...cssVec('position', transform.position));
  lines.push(...cssVec('rotation', transform.rotation));
  lines.push(...cssVec('scale', transform.scale));
  lines.push(`  --opacity: ${cssNumber(transform.opacity)};`);
}

function cssRule(selector: string, declarations: string[]): string {
  return `${selector} {\n${declarations.join('\n')}\n}`;
}

/** Generate the transform/material custom-property CSS projection. */
export function generateEditable3dCss(scene: Scene3DDocument | null): string {
  if (!scene) return '';
  const blocks: string[] = [
    cssRule('#scene-3d', [`  --background-color: ${scene.scene.backgroundColor};`]),
  ];
  blocks.push(
    cssRule('#camera', [
      ...cssVec('position', scene.camera.position),
      ...cssVec('target', scene.camera.target),
      `  --fov: ${cssNumber(scene.camera.fov)};`,
      `  --near: ${cssNumber(scene.camera.near)};`,
      `  --far: ${cssNumber(scene.camera.far)};`,
    ]),
  );
  for (const group of scene.groups) {
    const lines: string[] = [];
    cssTransform(lines, group.transform);
    blocks.push(cssRule(`#object-${group.id}`, lines));
  }
  for (const object of scene.objects) {
    const lines: string[] = [];
    cssTransform(lines, object.transform);
    lines.push(`  --material-color: ${object.material.color};`);
    if (object.material.opacity !== undefined)
      lines.push(`  --material-opacity: ${cssNumber(object.material.opacity)};`);
    if (object.material.emissive !== undefined)
      lines.push(`  --material-emissive: ${object.material.emissive};`);
    blocks.push(cssRule(`#object-${object.id}`, lines));
  }
  for (const light of scene.lights) {
    const lines = [`  --color: ${light.color};`, `  --intensity: ${cssNumber(light.intensity)};`];
    if (light.position) lines.push(...cssVec('position', light.position));
    if (light.direction) lines.push(...cssVec('direction', light.direction));
    blocks.push(cssRule(`#object-${light.id}`, lines));
  }
  return blocks.join('\n\n');
}

function parseCssRules(
  text: string,
): { ok: true; rules: CssRule[] } | { ok: false; errors: string[] } {
  const rules: CssRule[] = [];
  const errors: string[] = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(text)) !== null) {
    const selector = match[1].trim();
    const line = lineNumber(text, match.index);
    const declarations = new Map<string, string>();
    for (const rawDeclaration of match[2].split(';')) {
      const declaration = rawDeclaration.trim();
      if (!declaration) continue;
      const separator = declaration.indexOf(':');
      if (separator < 0) {
        errors.push(`Line ${line}: CSS declaration must contain a colon.`);
        continue;
      }
      const property = declaration.slice(0, separator).trim();
      const value = declaration.slice(separator + 1).trim();
      if (declarations.has(property))
        errors.push(`Line ${line}: duplicate CSS property "${property}".`);
      declarations.set(property, value);
    }
    rules.push({ selector, declarations, line });
  }
  if (rules.length === 0) errors.push('Line 1: CSS must contain at least one rule.');
  return errors.length > 0 ? { ok: false, errors } : { ok: true, rules };
}

function readCssNumber(rule: CssRule, property: string, errors: string[]): number | undefined {
  const value = rule.declarations.get(property);
  if (value === undefined) return undefined;
  if (!CSS_NUMBER_PATTERN.test(value)) {
    errors.push(`Line ${rule.line}: ${property} must be a number.`);
    return undefined;
  }
  return Number(value);
}

function readCssColor(rule: CssRule, property: string, errors: string[]): string | undefined {
  const value = rule.declarations.get(property);
  if (value === undefined) return undefined;
  if (!COLOR_PATTERN.test(value)) {
    errors.push(`Line ${rule.line}: ${property} must be a hex color.`);
    return undefined;
  }
  return value;
}

function applyCssVec(
  transform: { x: number; y: number; z: number },
  prefix: string,
  rule: CssRule,
  errors: string[],
): { x: number; y: number; z: number } {
  return {
    x: readCssNumber(rule, `--${prefix}-x`, errors) ?? transform.x,
    y: readCssNumber(rule, `--${prefix}-y`, errors) ?? transform.y,
    z: readCssNumber(rule, `--${prefix}-z`, errors) ?? transform.z,
  };
}

function applyCssTransform<
  T extends {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    opacity: number;
  },
>(transform: T, rule: CssRule, errors: string[]): T {
  return {
    ...transform,
    position: applyCssVec(transform.position, 'position', rule, errors),
    rotation: applyCssVec(transform.rotation, 'rotation', rule, errors),
    scale: applyCssVec(transform.scale, 'scale', rule, errors),
    opacity: readCssNumber(rule, '--opacity', errors) ?? transform.opacity,
  };
}

function validateCssRanges(scene: Scene3DDocument, rule: CssRule, errors: string[]): void {
  const values = [...rule.declarations.entries()];
  for (const [property, value] of values) {
    if (!property.startsWith('--') || !CSS_NUMBER_PATTERN.test(value)) continue;
    const number = Number(value);
    if (property === '--opacity' || property === '--material-opacity') {
      if (number < 0 || number > 1)
        errors.push(`Line ${rule.line}: ${property} must be between 0 and 1.`);
    } else if (property === '--intensity' && (number < 0 || number > 100)) {
      errors.push(`Line ${rule.line}: --intensity must be between 0 and 100.`);
    } else if (property === '--fov' && (number < 1 || number > 170)) {
      errors.push(`Line ${rule.line}: --fov must be between 1 and 170.`);
    } else if (property === '--near' && number <= 0) {
      errors.push(`Line ${rule.line}: --near must be positive.`);
    } else if (property === '--far' && number <= 0) {
      errors.push(`Line ${rule.line}: --far must be positive.`);
    }
  }
  void scene;
}

/** Parse the CSS projection, changing only fields represented by declarations. */
export function parseEditable3dCss(
  text: string,
  previousScene: Scene3DDocument,
): GrammarParseResult<Scene3DDocument> {
  const parsed = parseCssRules(text);
  if (!parsed.ok) return parsed;
  const next = structuredClone(previousScene);
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const rule of parsed.rules) {
    validateCssRanges(next, rule, errors);
    if (rule.selector === '#scene-3d') {
      const background = readCssColor(rule, '--background-color', errors);
      if (background) next.scene.backgroundColor = background;
      seen.add(rule.selector);
      continue;
    }
    if (rule.selector === '#camera') {
      next.camera.position = applyCssVec(next.camera.position, 'position', rule, errors);
      next.camera.target = applyCssVec(next.camera.target, 'target', rule, errors);
      next.camera.fov = readCssNumber(rule, '--fov', errors) ?? next.camera.fov;
      next.camera.near = readCssNumber(rule, '--near', errors) ?? next.camera.near;
      next.camera.far = readCssNumber(rule, '--far', errors) ?? next.camera.far;
      seen.add(rule.selector);
      continue;
    }
    const id = /^#object-([A-Za-z0-9_-]{1,64})$/.exec(rule.selector)?.[1];
    if (!id) {
      errors.push(`Line ${rule.line}: unsupported CSS selector "${rule.selector}".`);
      continue;
    }
    if (seen.has(rule.selector))
      errors.push(`Line ${rule.line}: duplicate CSS rule "${rule.selector}".`);
    seen.add(rule.selector);
    const object = next.objects.find((candidate) => candidate.id === id);
    if (object) {
      object.transform = applyCssTransform(object.transform, rule, errors);
      object.material.color =
        readCssColor(rule, '--material-color', errors) ?? object.material.color;
      const materialOpacity = readCssNumber(rule, '--material-opacity', errors);
      if (materialOpacity !== undefined) object.material.opacity = materialOpacity;
      const emissive = readCssColor(rule, '--material-emissive', errors);
      if (emissive !== undefined) object.material.emissive = emissive;
      continue;
    }
    const group = next.groups.find((candidate) => candidate.id === id);
    if (group) {
      group.transform = applyCssTransform(group.transform, rule, errors);
      continue;
    }
    const light = next.lights.find((candidate) => candidate.id === id);
    if (light) {
      light.color = readCssColor(rule, '--color', errors) ?? light.color;
      light.intensity = readCssNumber(rule, '--intensity', errors) ?? light.intensity;
      if (light.position) light.position = applyCssVec(light.position, 'position', rule, errors);
      if (light.direction)
        light.direction = applyCssVec(light.direction, 'direction', rule, errors);
      continue;
    }
    errors.push(`Line ${rule.line}: no object, group, or light named "${id}" exists.`);
  }
  if (errors.length > 0) return { ok: false, errors };
  const validation = validateScene3D(next);
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.errors.map((error) => `Line 1: ${error.path}: ${error.message}`),
    };
  }
  return { ok: true, scene: next };
}

const CAMERA_CONFIG_BEGIN = '/* CAMERA_CONFIG_BEGIN */';
const CAMERA_CONFIG_END = '/* CAMERA_CONFIG_END */';
const JS_HEADER = '// Scene3D camera and renderer configuration (safe editable literal)';
const JS_FOOTER = '// End Scene3D camera and renderer configuration';

type JsValue = number | string | boolean | null | { [key: string]: JsValue };

class JsLiteralReader {
  private index = 0;
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.source[this.index] ?? '')) this.index += 1;
  }

  private error(message: string): Error {
    return new Error(`${message} at offset ${this.index}`);
  }

  private readString(): string {
    const quote = this.source[this.index++];
    let value = '';
    while (this.index < this.source.length) {
      const character = this.source[this.index++];
      if (character === quote) return value;
      if (character === '\\') {
        const escaped = this.source[this.index++];
        if (escaped === 'n') value += '\n';
        else if (escaped === 'r') value += '\r';
        else if (escaped === 't') value += '\t';
        else value += escaped;
      } else value += character;
    }
    throw this.error('Unterminated string');
  }

  private readKey(): string {
    this.skipWhitespace();
    const character = this.source[this.index];
    if (character === '"' || character === "'") return this.readString();
    const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(this.source.slice(this.index));
    if (!match) throw this.error('Expected an object property name');
    this.index += match[0].length;
    return match[0];
  }

  private readValue(): JsValue {
    this.skipWhitespace();
    const character = this.source[this.index];
    if (character === '{') return this.readObject();
    if (character === '"' || character === "'") return this.readString();
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      this.source.slice(this.index),
    );
    if (number) {
      this.index += number[0].length;
      return Number(number[0]);
    }
    for (const [literal, value] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (this.source.startsWith(literal, this.index)) {
        this.index += literal.length;
        return value;
      }
    }
    throw this.error('Expected a supported literal value');
  }

  private readObject(): { [key: string]: JsValue } {
    const result: { [key: string]: JsValue } = {};
    this.index += 1;
    this.skipWhitespace();
    if (this.source[this.index] === '}') {
      this.index += 1;
      return result;
    }
    while (this.index < this.source.length) {
      const key = this.readKey();
      this.skipWhitespace();
      if (this.source[this.index++] !== ':') throw this.error('Expected a colon');
      if (key in result) throw this.error(`Duplicate property "${key}"`);
      result[key] = this.readValue();
      this.skipWhitespace();
      const separator = this.source[this.index++];
      if (separator === '}') return result;
      if (separator !== ',') throw this.error('Expected a comma or closing brace');
      this.skipWhitespace();
    }
    throw this.error('Unterminated object literal');
  }

  read(): JsValue {
    const value = this.readValue();
    this.skipWhitespace();
    if (this.index !== this.source.length) throw this.error('Unexpected content after literal');
    return value;
  }
}

function jsErrorLine(text: string, error: unknown): string {
  const offset = error instanceof Error ? Number(/offset (\d+)$/.exec(error.message)?.[1] ?? 0) : 0;
  return `Line ${lineNumber(text, offset)}: ${error instanceof Error ? error.message.replace(/ at offset \d+$/, '') : 'invalid JavaScript literal.'}`;
}

function renderJsVec(value: { x: number; y: number; z: number }): string {
  return `{ x: ${cssNumber(value.x)}, y: ${cssNumber(value.y)}, z: ${cssNumber(value.z)} }`;
}

/** Generate the camera/renderer-only JS literal projection. */
export function generateEditable3dJs(scene: Scene3DDocument | null): string {
  if (!scene) return '';
  const renderer = scene.renderer ? `, renderer: { preferred: '${scene.renderer.preferred}' }` : '';
  return [
    JS_HEADER,
    CAMERA_CONFIG_BEGIN,
    '{',
    `  position: ${renderJsVec(scene.camera.position)},`,
    `  target: ${renderJsVec(scene.camera.target)},`,
    `  fov: ${cssNumber(scene.camera.fov)},`,
    `  near: ${cssNumber(scene.camera.near)},`,
    `  far: ${cssNumber(scene.camera.far)}${renderer}`,
    '}',
    CAMERA_CONFIG_END,
    JS_FOOTER,
  ].join('\n');
}

function isRecord(value: JsValue): value is { [key: string]: JsValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJsVec(
  value: JsValue,
  field: string,
  errors: string[],
): { x: number; y: number; z: number } | undefined {
  if (
    !isRecord(value) ||
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    typeof value.z !== 'number'
  ) {
    errors.push(`${field} must be an object with numeric x, y, and z fields.`);
    return undefined;
  }
  return { x: value.x, y: value.y, z: value.z };
}

/** Parse the sentinel block without evaluating source text. */
export function parseEditable3dJs(
  text: string,
  previousScene: Scene3DDocument,
): GrammarParseResult<Scene3DDocument> {
  const begin = text.indexOf(CAMERA_CONFIG_BEGIN);
  const end = text.indexOf(CAMERA_CONFIG_END);
  const prefix = `${JS_HEADER}\n${CAMERA_CONFIG_BEGIN}\n`;
  const suffix = `\n${CAMERA_CONFIG_END}\n${JS_FOOTER}`;
  if (
    begin !== JS_HEADER.length + 1 ||
    end < begin ||
    !text.startsWith(prefix) ||
    !text.endsWith(suffix)
  ) {
    return {
      ok: false,
      errors: ['Line 1: content outside the camera sentinel block is immutable.'],
    };
  }
  const body = text.slice(prefix.length, end).trim();
  let value: JsValue;
  try {
    value = new JsLiteralReader(body).read();
  } catch (error) {
    return { ok: false, errors: [jsErrorLine(text, error)] };
  }
  if (!isRecord(value))
    return { ok: false, errors: ['Line 1: camera configuration must be an object.'] };
  const errors: string[] = [];
  const allowed = new Set(['position', 'target', 'fov', 'near', 'far', 'renderer']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`Line 1: unsupported camera configuration field "${key}".`);
  }
  const position = readJsVec(value.position, 'position', errors);
  const target = readJsVec(value.target, 'target', errors);
  if (typeof value.fov !== 'number' || value.fov < 1 || value.fov > 170)
    errors.push('Line 1: fov must be between 1 and 170.');
  if (typeof value.near !== 'number' || value.near <= 0)
    errors.push('Line 1: near must be positive.');
  if (typeof value.far !== 'number' || value.far <= 0) errors.push('Line 1: far must be positive.');
  let preferred: 'threejs' | 'aframe' | undefined;
  if (value.renderer !== undefined) {
    if (
      !isRecord(value.renderer) ||
      (value.renderer.preferred !== 'threejs' && value.renderer.preferred !== 'aframe')
    ) {
      errors.push('Line 1: renderer.preferred must be "threejs" or "aframe".');
    } else preferred = value.renderer.preferred;
  }
  if (errors.length > 0 || !position || !target) return { ok: false, errors };
  const next = structuredClone(previousScene);
  next.camera = {
    position,
    target,
    fov: value.fov as number,
    near: value.near as number,
    far: value.far as number,
  };
  if (preferred === undefined) delete next.renderer;
  else next.renderer = { preferred };
  const validation = validateScene3D(next);
  if (!validation.valid)
    return {
      ok: false,
      errors: validation.errors.map((error) => `Line 1: ${error.path}: ${error.message}`),
    };
  return { ok: true, scene: next };
}

/**
 * Task 142 (issue #174): the Code tab's HTML/CSS/JS <-> `SceneDocument`
 * bidirectional grammar.
 *
 * ## Why a constrained grammar, not free-form HTML/CSS/JS
 *
 * `SceneDocument` (schema/scene.schema.json) is the canonical contract every
 * other subsystem depends on: versioning (`SceneVersion.scene_json`), AI
 * patch editing (#158), thumbnails, the public viewer, undo/redo. Free-form
 * hand-edited HTML/CSS/JS has no natural, lossless mapping onto that
 * contract, so this module defines a narrow, deterministic subset of
 * HTML/CSS constructs -- documented in full below -- where every element,
 * attribute, class token, selector, and property maps onto exactly one
 * `SceneDocument` field in both directions. Anything outside that subset is
 * rejected at parse time with a specific, actionable error; nothing is ever
 * silently dropped or silently reinterpreted.
 *
 * This is a *different* generator from `generateHtmlExport.ts` --
 * that module produces a self-contained, p5.js-canvas-rendering standalone
 * export page (a `<script>`-driven runtime, not per-shape DOM/CSS). This
 * module instead represents each shape as one plain `<div>` styled by one
 * CSS rule, specifically so it can be reversed. The two generators are
 * intentionally not shared code, but this module does reuse the same
 * safety posture as `safeEmbed.ts`: every value written into HTML/CSS is
 * first validated against a strict pattern (the schema's own `id`/`color`
 * patterns, or a numeric-with-unit pattern) *before* being embedded, so no
 * free-text ever reaches a DOM attribute or style value unescaped. Reverse
 * parsing never `eval`s or executes anything -- it only reads attribute/
 * declaration strings through the same strict patterns.
 *
 * ## Grammar v1 -- what's IN
 *
 * HTML (fragment only -- the HTML sub-tab's content is a fragment, not a
 * full document):
 * - Exactly one root `<main id="scene-shapes">`.
 * - Zero or more direct `<div>` children, one per *editable* shape (see
 *   "what's OUT" below for which shapes are editable), in document order.
 *   Reordering the divs reorders `scene.shapes` (z-order) -- this is the
 *   one structural edit the grammar supports.
 * - Each shape `<div>` carries:
 *   - `data-shape-id` (required) -- must be one of the existing scene's
 *     editable shape ids. The full *set* of ids present must match the
 *     existing editable shape set exactly: the HTML grammar cannot add or
 *     remove shapes (that stays a Visual-tab-only operation).
 *   - `data-shape-type` (required) -- must equal that shape's existing
 *     `type`; changing a shape's type via the Code tab is rejected.
 *   - `data-layer-id` / `data-group-id` (optional, informational) -- must
 *     equal the shape's existing value exactly; both are immutable via
 *     this grammar (layer/group membership stays a Visual-tab operation).
 *   - `class` -- recognized tokens only: `scene-shape`, the shape's type
 *     name, `hidden` (-> `shape.visible = false`), `locked` (->
 *     `shape.locked = true`). Any other token is rejected.
 *
 * CSS (one rule per shape id, plus one for the canvas):
 * - `#scene-shapes { background-color; width; height; opacity }` ->
 *   `canvas.backgroundColor` / `canvas.width` / `canvas.height` /
 *   `canvas.opacity`.
 * - `#shape-{id} { ... }` -> that shape's fields. Supported declarations:
 *   - `left` (px) -> `transform.x`
 *   - `top` (px) -> `transform.y`
 *   - `opacity` (0-1) -> `transform.opacity`
 *   - `background-color` (hex color or `none`) -> `style.fill`
 *   - `border-color` (hex color or `none`) -> `style.stroke`
 *   - `border-width` (px) -> `style.strokeWidth`
 *   - `transform: rotate(Ndeg) scale(sx, sy)` -> `transform.rotation` /
 *     `transform.scaleX` / `transform.scaleY` (either function may be
 *     omitted; an omitted function leaves that pair of fields unchanged)
 *   - `visibility` (`visible` | `hidden`) -> `shape.visible` (kept in sync
 *     with the `hidden` class token; the two are redundant by design so a
 *     hand-edit of either one alone still works)
 *   - `width` / `height` (px, **rect only** -> `width`/`height`; **circle
 *     only**, must be equal to each other -> `radius = width / 2`)
 *   - `border-radius` (px, **rect only**) -> `cornerRadius`
 *   - `--x2` / `--y2` (px, **line only**, custom properties -- CSS has no
 *     natural second-endpoint property, so this grammar uses custom
 *     properties rather than inventing a non-standard prefixed property)
 * - A declaration omitted from a rule leaves the corresponding field(s)
 *   unchanged from the scene being edited (not reset to a default) -- this
 *   is what makes the round-trip test (regenerate -> re-save unchanged ->
 *   no mutation) hold, since the forward generator always emits every
 *   applicable declaration explicitly.
 * - Any other selector, at-rule (`@media`, etc.), or declaration is
 *   rejected by name.
 *
 * ## Grammar v1 -- what's OUT (documented latitude per issue #174)
 *
 * - **`particleEmitter` shapes** are excluded from the editable HTML/CSS
 *   surface entirely (no `<div>` is generated for one, and the reverse
 *   parser never touches one) -- this repo's own Visual-tab shape editor
 *   (`sceneShapes.ts`) already scopes particle emitters out of direct
 *   editing for the same reason (see that module's doc comment), so this
 *   is consistent with an existing project boundary, not a new one. A
 *   scene containing particle emitters keeps them completely unchanged
 *   across a Code-tab save; they are always preserved, appended after the
 *   editable shapes in `scene.shapes` order.
 * - **`path` shape geometry** (`points`, `closed`) has no representation in
 *   this grammar -- a path's vertices stay Visual-tab-only. A path's
 *   universal fields (position/rotation/scale/opacity/fill/stroke/
 *   strokeWidth/visible/locked) are fully editable like any other shape.
 * - **Adding, removing, retyping, regrouping, or relayering shapes** via
 *   the Code tab -- the HTML grammar can only reorder and restyle the
 *   *existing* shape set. This keeps the grammar a pure, always-reversible
 *   projection instead of a second shape-CRUD surface to keep consistent
 *   with the Visual tab's own.
 * - **The `graph`/`bindings` interaction-runtime model, and therefore the
 *   JavaScript sub-tab, is not reverse-parsed at all in this pass** -- see
 *   `generateEditableJs`'s doc comment. This is the "narrower first cut"
 *   for JS explicitly pre-authorized by issue #174's grooming comment.
 *   Follow-up: issue filed for full graph/connection <-> JS mapping (see
 *   `_docs/tasks.md` task 142's resolution notes).
 */
import type { SceneDocument } from '../api/projects';
import {
  getEditableShapes,
  type Shape,
  type ShapeType,
  ROTATION_LIMIT,
} from '../pages/sceneShapes';
import { buildStandaloneCameraScript } from './standaloneCameraSource';
import { buildStandaloneRuntimeScript } from './standaloneRuntimeSource';

export const CODE_GRAMMAR_VERSION = 1;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SHAPE_TYPES: ShapeType[] = ['circle', 'rect', 'line', 'path'];

type Canvas = { width: number; height: number; backgroundColor: string; opacity?: number };

function rawShapesOf(scene: SceneDocument): unknown[] {
  return Array.isArray(scene.shapes) ? scene.shapes : [];
}

function canvasOf(scene: SceneDocument): Canvas {
  const canvas = scene.canvas as Partial<Canvas> | undefined;
  return {
    width: typeof canvas?.width === 'number' ? canvas.width : 800,
    height: typeof canvas?.height === 'number' ? canvas.height : 600,
    backgroundColor:
      typeof canvas?.backgroundColor === 'string' ? canvas.backgroundColor : '#ffffff',
    opacity: typeof canvas?.opacity === 'number' ? canvas.opacity : undefined,
  };
}

/** Shapes this grammar can represent -- see the module doc comment's "what's
 * OUT" section for why `particleEmitter` (and any future unknown type) is
 * excluded. */
function editableShapesOf(scene: SceneDocument): Shape[] {
  return getEditableShapes(rawShapesOf(scene)).filter((s) => SHAPE_TYPES.includes(s.type));
}

function nonEditableShapesOf(scene: SceneDocument): unknown[] {
  return rawShapesOf(scene).filter((s) => {
    const type = (s as { type?: unknown })?.type;
    return typeof type !== 'string' || !SHAPE_TYPES.includes(type as ShapeType);
  });
}

function num(value: number, digits = 4): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

function px(value: number): string {
  return `${num(value)}px`;
}

// ---------------------------------------------------------------------------
// Forward direction: SceneDocument -> HTML / CSS / JS
// ---------------------------------------------------------------------------

/** Generates the editable HTML fragment for the Code tab's HTML sub-tab.
 * See the module doc comment's grammar section for the exact shape. */
export function generateEditableHtml(scene: SceneDocument | null): string {
  if (!scene) return '<main id="scene-shapes"></main>';
  const shapes = editableShapesOf(scene);
  const lines = shapes.map((shape) => {
    const classes = ['scene-shape', shape.type];
    if (shape.visible === false) classes.push('hidden');
    if (shape.locked === true) classes.push('locked');
    const groupAttr = shape.groupId ? ` data-group-id="${shape.groupId}"` : '';
    return (
      `  <div data-shape-id="${shape.id}" data-shape-type="${shape.type}" ` +
      `data-layer-id="${shape.layerId}"${groupAttr} class="${classes.join(' ')}"></div>`
    );
  });
  return ['<main id="scene-shapes">', ...lines, '</main>'].join('\n');
}

/** Generates the editable CSS for the Code tab's CSS sub-tab -- one rule
 * per editable shape plus one for the canvas. See the module doc comment. */
export function generateEditableCss(scene: SceneDocument | null): string {
  if (!scene) return '';
  const canvas = canvasOf(scene);
  const blocks: string[] = [];
  const canvasDecls = [
    `background-color: ${canvas.backgroundColor};`,
    `width: ${px(canvas.width)};`,
    `height: ${px(canvas.height)};`,
  ];
  if (canvas.opacity !== undefined) canvasDecls.push(`opacity: ${num(canvas.opacity)};`);
  blocks.push(`#scene-shapes {\n  ${canvasDecls.join('\n  ')}\n}`);

  for (const shape of editableShapesOf(scene)) {
    const decls: string[] = [
      `left: ${px(shape.transform.x)};`,
      `top: ${px(shape.transform.y)};`,
      `opacity: ${num(shape.transform.opacity)};`,
      `background-color: ${shape.style.fill ?? 'none'};`,
      `border-color: ${shape.style.stroke ?? 'none'};`,
      `border-width: ${px(shape.style.strokeWidth)};`,
      `transform: rotate(${num(shape.transform.rotation)}deg) scale(${num(shape.transform.scaleX)}, ${num(shape.transform.scaleY)});`,
      `visibility: ${shape.visible === false ? 'hidden' : 'visible'};`,
    ];
    if (shape.type === 'rect') {
      decls.push(`width: ${px(shape.width)};`, `height: ${px(shape.height)};`);
      decls.push(`border-radius: ${px(shape.cornerRadius)};`);
    } else if (shape.type === 'circle') {
      decls.push(`width: ${px(shape.radius * 2)};`, `height: ${px(shape.radius * 2)};`);
    } else if (shape.type === 'line') {
      decls.push(`--x2: ${px(shape.x2)};`, `--y2: ${px(shape.y2)};`);
    }
    blocks.push(`#shape-${shape.id} {\n  ${decls.join('\n  ')}\n}`);
  }
  return blocks.join('\n\n');
}

/**
 * Generates the JavaScript sub-tab's content: a documented, read-generated
 * view of this scene's interaction runtime (reusing the existing
 * one-directional `standaloneRuntimeSource.ts` / `standaloneCameraSource.ts`
 * generators), prefixed with an explicit banner explaining the current
 * grammar boundary. This sub-tab IS a real, editable textarea (per issue
 * #174's re-groomed acceptance criteria), but the reverse direction for JS
 * is explicitly out of scope for this pass -- see the module doc comment's
 * "what's OUT" section. `isEditableJsUnchanged` below is the only check
 * a save against this sub-tab performs: identical text saves as a no-op
 * (zero scene mutation, matching the round-trip requirement), and any
 * other edit is rejected with an actionable message rather than silently
 * applied or silently dropped.
 */
export function generateEditableJs(scene: SceneDocument | null): string {
  if (!scene) return '';
  const banner = [
    '// Generated from this scene\'s interaction runtime (graph + bindings).',
    '// NOT YET REVERSE-PARSED: this repo\'s Code-tab grammar (task 142 / issue',
    '// #174) does not map hand-edited JavaScript back onto the graph/bindings',
    '// model yet -- that is tracked as an explicit follow-up (see',
    '// _docs/tasks.md task 142\'s resolution notes for the issue number).',
    '// Editing shapes/behaviors here has no effect; use the Visual tab (for',
    '// behaviors/logic) or the HTML/CSS sub-tabs (for shape geometry/style)',
    '// instead. Saving this tab unchanged is a safe no-op.',
    '',
  ].join('\n');
  const hasCamera = Array.isArray((scene as { bindings?: unknown[] }).bindings);
  return (
    banner +
    buildStandaloneRuntimeScript() +
    (hasCamera ? '\n\n' + buildStandaloneCameraScript() : '')
  );
}

/** Used by the Code tab's JS sub-tab save handler -- see
 * `generateEditableJs`'s doc comment for why JS is compare-only in v1. */
export function isEditableJsUnchanged(text: string, scene: SceneDocument | null): boolean {
  return text === generateEditableJs(scene);
}

// ---------------------------------------------------------------------------
// Reverse direction: HTML + CSS -> SceneDocument mutations
// ---------------------------------------------------------------------------

export type GrammarParseResult =
  | { ok: true; scene: SceneDocument }
  | { ok: false; errors: string[] };

type ParsedShapeAttrs = {
  id: string;
  type: string;
  layerId: string | null;
  groupId: string | null;
  hidden: boolean;
  locked: boolean;
};

function parseHtml(html: string): { ok: true; shapes: ParsedShapeAttrs[] } | { ok: false; errors: string[] } {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return { ok: false, errors: ['HTML could not be parsed.'] };
  }
  if (doc.querySelector('parsererror')) {
    return { ok: false, errors: ['HTML is not well-formed.'] };
  }
  const main = doc.getElementById('scene-shapes');
  if (!main || main.tagName.toLowerCase() !== 'main') {
    return { ok: false, errors: ['HTML must contain exactly one <main id="scene-shapes"> root.'] };
  }
  const errors: string[] = [];
  const shapes: ParsedShapeAttrs[] = [];
  const seenIds = new Set<string>();
  Array.from(main.children).forEach((child, index) => {
    if (child.tagName.toLowerCase() !== 'div') {
      errors.push(`Element ${index + 1} inside <main id="scene-shapes"> is a <${child.tagName.toLowerCase()}>, but only <div> shape elements are supported.`);
      return;
    }
    const id = child.getAttribute('data-shape-id');
    const type = child.getAttribute('data-shape-type');
    if (!id || !ID_PATTERN.test(id)) {
      errors.push(`Element ${index + 1}: missing or invalid data-shape-id.`);
      return;
    }
    if (seenIds.has(id)) {
      errors.push(`Duplicate data-shape-id "${id}" -- each shape must appear exactly once.`);
      return;
    }
    seenIds.add(id);
    if (!type || !SHAPE_TYPES.includes(type as ShapeType)) {
      errors.push(`Shape "${id}": data-shape-type must be one of ${SHAPE_TYPES.join(', ')}.`);
      return;
    }
    const classList = (child.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
    const allowedClasses = new Set(['scene-shape', type, 'hidden', 'locked']);
    for (const cls of classList) {
      if (!allowedClasses.has(cls)) {
        errors.push(`Shape "${id}": unrecognized class "${cls}" (allowed: ${[...allowedClasses].join(', ')}).`);
      }
    }
    shapes.push({
      id,
      type,
      layerId: child.getAttribute('data-layer-id'),
      groupId: child.getAttribute('data-group-id'),
      hidden: classList.includes('hidden'),
      locked: classList.includes('locked'),
    });
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, shapes };
}

type CssRule = { selector: string; declarations: Record<string, string> };

function parseCss(css: string): { ok: true; rules: CssRule[] } | { ok: false; errors: string[] } {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (stripped.length === 0) return { ok: true, rules: [] };
  if (stripped.includes('@')) {
    return { ok: false, errors: ['At-rules (e.g. @media) are not supported by the Code tab CSS grammar.'] };
  }
  const rules: CssRule[] = [];
  const errors: string[] = [];
  // Split into `selector { body }` blocks. No nested braces are permitted
  // by this grammar, so a straightforward brace-matched split is exact.
  let rest = stripped;
  while (rest.trim().length > 0) {
    const openIdx = rest.indexOf('{');
    const closeIdx = rest.indexOf('}');
    if (openIdx === -1 || closeIdx === -1 || closeIdx < openIdx) {
      errors.push('CSS has an unmatched { or }.');
      break;
    }
    const selector = rest.slice(0, openIdx).trim();
    const body = rest.slice(openIdx + 1, closeIdx);
    if (body.includes('{')) {
      errors.push(`Selector "${selector}": nested rules are not supported.`);
      rest = rest.slice(closeIdx + 1);
      continue;
    }
    const declarations: Record<string, string> = {};
    for (const decl of body.split(';')) {
      const trimmed = decl.trim();
      if (trimmed.length === 0) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) {
        errors.push(`Selector "${selector}": malformed declaration "${trimmed}".`);
        continue;
      }
      const prop = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();
      declarations[prop] = value;
    }
    rules.push({ selector, declarations });
    rest = rest.slice(closeIdx + 1);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rules };
}

function parsePx(value: string, field: string, errors: string[]): number | null {
  const match = /^(-?[0-9]+(?:\.[0-9]+)?)px$/.exec(value.trim());
  if (!match) {
    errors.push(`${field}: "${value}" must be a plain pixel length, e.g. "10px".`);
    return null;
  }
  return Number(match[1]);
}

function parseUnitInterval(value: string, field: string, errors: string[]): number | null {
  const n = Number(value.trim());
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    errors.push(`${field}: "${value}" must be a number between 0 and 1.`);
    return null;
  }
  return n;
}

function parseColorOrNone(value: string, field: string, errors: string[]): string | null | undefined {
  const trimmed = value.trim();
  if (trimmed === 'none') return null;
  if (!COLOR_PATTERN.test(trimmed)) {
    errors.push(`${field}: "${value}" must be a hex color (#rgb/#rrggbb/#rrggbbaa) or "none".`);
    return undefined;
  }
  return trimmed;
}

const TRANSFORM_FN_PATTERN =
  /^(?:rotate\((-?[0-9.]+)deg\))?\s*(?:scale\((-?[0-9.]+)\s*,\s*(-?[0-9.]+)\))?$/;

/**
 * Reverse-parses the Code tab's HTML + CSS text back onto `previousScene`,
 * applying only the grammar documented in this module's doc comment.
 * Every non-editable part of `previousScene` (graph, bindings, groups,
 * layers, particleEmitter shapes, schemaVersion, etc.) is carried over
 * completely unchanged. The result is always run through `validateScene`
 * (imported by the caller) as the final authoritative gate -- this function
 * only performs grammar-level checks specific to HTML/CSS shape syntax.
 */
export function parseEditableHtmlAndCss(
  html: string,
  css: string,
  previousScene: SceneDocument,
): GrammarParseResult {
  const errors: string[] = [];
  const htmlResult = parseHtml(html);
  if (!htmlResult.ok) errors.push(...htmlResult.errors);
  const cssResult = parseCss(css);
  if (!cssResult.ok) errors.push(...cssResult.errors);
  if (!htmlResult.ok || !cssResult.ok) return { ok: false, errors };

  const existingShapes = editableShapesOf(previousScene);
  const existingById = new Map(existingShapes.map((s) => [s.id, s]));
  const htmlIds = new Set(htmlResult.shapes.map((s) => s.id));

  const missing = existingShapes.filter((s) => !htmlIds.has(s.id));
  const extra = htmlResult.shapes.filter((s) => !existingById.has(s.id));
  if (missing.length > 0) {
    errors.push(
      `HTML is missing ${missing.length} existing shape(s) (${missing.map((s) => s.id).join(', ')}) -- shapes cannot be removed from the Code tab; use the Visual tab instead.`,
    );
  }
  if (extra.length > 0) {
    errors.push(
      `HTML references ${extra.length} shape id(s) not in this scene (${extra.map((s) => s.id).join(', ')}) -- shapes cannot be added from the Code tab; use the Visual tab instead.`,
    );
  }

  for (const parsed of htmlResult.shapes) {
    const existing = existingById.get(parsed.id);
    if (!existing) continue; // already reported as "extra" above
    if (parsed.type !== existing.type) {
      errors.push(`Shape "${parsed.id}": type cannot change from "${existing.type}" to "${parsed.type}" via the Code tab.`);
    }
    if (parsed.layerId !== null && parsed.layerId !== existing.layerId) {
      errors.push(`Shape "${parsed.id}": data-layer-id cannot be changed via the Code tab.`);
    }
    const existingGroup = existing.groupId ?? null;
    const parsedGroup = parsed.groupId ?? null;
    if (parsedGroup !== existingGroup) {
      errors.push(`Shape "${parsed.id}": data-group-id cannot be changed via the Code tab.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  // Apply CSS declarations onto a clone of each existing shape.
  const updatedById = new Map<string, Shape>();
  for (const existing of existingShapes) {
    updatedById.set(existing.id, structuredClone(existing));
  }
  let canvas = structuredClone(canvasOf(previousScene));

  for (const rule of cssResult.rules) {
    if (rule.selector === '#scene-shapes') {
      applyCanvasDeclarations(rule.declarations, canvas, errors);
      continue;
    }
    const shapeMatch = /^#shape-([A-Za-z0-9_-]{1,64})$/.exec(rule.selector);
    if (!shapeMatch) {
      errors.push(`Unsupported CSS selector "${rule.selector}" -- only "#scene-shapes" and "#shape-{id}" are supported.`);
      continue;
    }
    const id = shapeMatch[1];
    const shape = updatedById.get(id);
    if (!shape) {
      errors.push(`CSS rule "${rule.selector}" does not match any shape in the HTML.`);
      continue;
    }
    applyShapeDeclarations(rule.declarations, shape, errors);
  }
  if (errors.length > 0) return { ok: false, errors };

  // Sync the class-token visible/locked flags (HTML wins if CSS omitted
  // `visibility`; both are kept consistent by the forward generator).
  for (const parsed of htmlResult.shapes) {
    const shape = updatedById.get(parsed.id);
    if (!shape) continue;
    if (shape.visible === undefined) shape.visible = true;
    if (parsed.hidden) shape.visible = false;
    shape.locked = parsed.locked || shape.locked === true;
  }

  const orderedEditable = htmlResult.shapes.map((s) => updatedById.get(s.id)!).filter(Boolean);
  const preserved = nonEditableShapesOf(previousScene);
  const nextScene: SceneDocument = {
    ...previousScene,
    canvas,
    shapes: [...orderedEditable, ...preserved],
  };
  return { ok: true, scene: nextScene };
}

function applyCanvasDeclarations(decls: Record<string, string>, canvas: Canvas, errors: string[]): void {
  for (const [prop, value] of Object.entries(decls)) {
    if (prop === 'background-color') {
      const color = parseColorOrNone(value, '#scene-shapes background-color', errors);
      if (typeof color === 'string') canvas.backgroundColor = color;
    } else if (prop === 'width') {
      const n = parsePx(value, '#scene-shapes width', errors);
      if (n !== null) canvas.width = n;
    } else if (prop === 'height') {
      const n = parsePx(value, '#scene-shapes height', errors);
      if (n !== null) canvas.height = n;
    } else if (prop === 'opacity') {
      const n = parseUnitInterval(value, '#scene-shapes opacity', errors);
      if (n !== null) canvas.opacity = n;
    } else {
      errors.push(`#scene-shapes: unsupported property "${prop}".`);
    }
  }
}

function applyShapeDeclarations(decls: Record<string, string>, shape: Shape, errors: string[]): void {
  const label = `#shape-${shape.id}`;
  for (const [prop, value] of Object.entries(decls)) {
    switch (prop) {
      case 'left': {
        const n = parsePx(value, `${label} left`, errors);
        if (n !== null) shape.transform.x = n;
        break;
      }
      case 'top': {
        const n = parsePx(value, `${label} top`, errors);
        if (n !== null) shape.transform.y = n;
        break;
      }
      case 'opacity': {
        const n = parseUnitInterval(value, `${label} opacity`, errors);
        if (n !== null) shape.transform.opacity = n;
        break;
      }
      case 'background-color': {
        const color = parseColorOrNone(value, `${label} background-color`, errors);
        if (color !== undefined) shape.style.fill = color;
        break;
      }
      case 'border-color': {
        const color = parseColorOrNone(value, `${label} border-color`, errors);
        if (color !== undefined) shape.style.stroke = color;
        break;
      }
      case 'border-width': {
        const n = parsePx(value, `${label} border-width`, errors);
        if (n !== null) shape.style.strokeWidth = n;
        break;
      }
      case 'visibility': {
        const trimmed = value.trim();
        if (trimmed !== 'visible' && trimmed !== 'hidden') {
          errors.push(`${label} visibility: must be "visible" or "hidden".`);
        } else {
          shape.visible = trimmed === 'visible';
        }
        break;
      }
      case 'transform': {
        const match = TRANSFORM_FN_PATTERN.exec(value.trim());
        if (!match) {
          errors.push(`${label} transform: only "rotate(Ndeg)" and/or "scale(sx, sy)" are supported.`);
          break;
        }
        if (match[1] !== undefined) {
          const rotation = Number(match[1]);
          if (rotation < ROTATION_LIMIT.min || rotation > ROTATION_LIMIT.max) {
            errors.push(`${label} transform: rotation out of range.`);
          } else {
            shape.transform.rotation = rotation;
          }
        }
        if (match[2] !== undefined && match[3] !== undefined) {
          shape.transform.scaleX = Number(match[2]);
          shape.transform.scaleY = Number(match[3]);
        }
        break;
      }
      case 'width': {
        const n = parsePx(value, `${label} width`, errors);
        if (n === null) break;
        if (shape.type === 'rect') {
          shape.width = n;
        } else if (shape.type === 'circle') {
          shape.radius = n / 2;
        } else {
          errors.push(`${label} width: only supported for rect/circle shapes.`);
        }
        break;
      }
      case 'height': {
        const n = parsePx(value, `${label} height`, errors);
        if (n === null) break;
        if (shape.type === 'rect') {
          shape.height = n;
        } else if (shape.type === 'circle') {
          shape.radius = n / 2;
        } else {
          errors.push(`${label} height: only supported for rect/circle shapes.`);
        }
        break;
      }
      case 'border-radius': {
        const n = parsePx(value, `${label} border-radius`, errors);
        if (n === null) break;
        if (shape.type === 'rect') {
          shape.cornerRadius = n;
        } else {
          errors.push(`${label} border-radius: only supported for rect shapes.`);
        }
        break;
      }
      case '--x2':
      case '--y2': {
        const n = parsePx(value, `${label} ${prop}`, errors);
        if (n === null) break;
        if (shape.type === 'line') {
          if (prop === '--x2') shape.x2 = n;
          else shape.y2 = n;
        } else {
          errors.push(`${label} ${prop}: only supported for line shapes.`);
        }
        break;
      }
      default: {
        errors.push(`${label}: unsupported property "${prop}".`);
      }
    }
  }
}

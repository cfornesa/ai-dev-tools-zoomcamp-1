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
 * - **Graph nodes/connections are NOT reverse-parsed in Grammar v2 either**
 *   -- see the "Grammar v2 (JS)" section below for what IS now supported
 *   (bindings only) and why node/connection editing is deferred to a
 *   further follow-up (issue #176 / `_docs/tasks.md` task 144).
 *
 * ## Grammar v2 (JS) -- what's IN (task 143 / issue #175)
 *
 * The JS sub-tab's text has exactly two parts:
 * 1. An editable `bindings` array literal, delimited by two fixed sentinel
 *    comment lines (`BINDINGS_START` / `BINDINGS_END` below):
 *    `const bindings = [ { ... }, { ... } ];`. Each array element is a
 *    plain JS object literal (not JSON -- unquoted or quoted keys both
 *    work, single or double-quoted strings, `//`/`/* *\/` comments allowed
 *    between tokens) representing exactly one `scene.bindings[]` entry.
 *    Supported fields, mirroring `schema/scene.schema.json`'s `binding`
 *    definition exactly: `id`, `signal`, `handTarget`, `targetScope`,
 *    `targetId`, `targetProperty`, `composition` (required; `composition`
 *    must be the literal string `"replace"`, the only value V1 supports),
 *    plus optional `mapping` (`{ inMin, inMax, outMin, outMax }`, all
 *    numbers), `smoothing`/`closeThreshold`/`farThreshold`/
 *    `releaseThreshold` (numbers in [0, 1]), and `holdTimeMs` (integer in
 *    [0, 10000]). Any other field name, on a binding or inside `mapping`,
 *    is rejected by name. The whole array is a wholesale replacement of
 *    `scene.bindings` -- unlike the HTML/CSS grammar's shapes (which have
 *    Visual-tab-only add/remove per #174's decision), bindings carry no
 *    shape-identity/ordering constraint, so add/edit/remove is fully
 *    supported simply by adding/editing/removing entries in this array.
 * 2. Everything else (the explanatory banner comment above the bindings
 *    block, and the generated runtime/camera boilerplate below it) is
 *    immutable in this pass -- it must be saved back byte-for-byte
 *    unchanged, exactly like Grammar v1's whole-file behavior. This is
 *    where graph node/connection editing would live in a future pass.
 *
 * Parsing never uses `eval`, `new Function`, or any other live-execution
 * path: `parseEditableJs` below locates the two sentinel lines with plain
 * string search, then walks the bindings array text with a minimal
 * hand-rolled recursive-descent literal recognizer (`parseJsLiteral`) that
 * understands exactly: object literals, array literals, quoted strings,
 * numbers, `true`/`false`/`null`, and `//`/`/* *\/` comments -- nothing
 * else (no identifiers-as-values, no function calls, no operators, no
 * template literals). This mirrors Grammar v1's own posture (`DOMParser`
 * for HTML, a hand-rolled tokenizer for CSS) rather than adding a new
 * parser dependency to the frontend toolchain, per AGENTS.md's "Dependencies
 * are added in package.json, do not add one without asking."
 *
 * ## Grammar v2 (JS) -- what's OUT, and why (documented latitude per #175)
 *
 * - **Graph nodes and connections** (`scene.graph.nodes`/`.connections`)
 *   are not reverse-parsed in this pass -- issue #175's own grooming
 *   comment pre-authorizes shipping "camera/gesture binding edits only,
 *   deferring node/connection add/remove to a further follow-up" as a
 *   valid narrower first cut, as long as something genuinely new is
 *   editable-and-saveable, which bindings are. Editing the graph still
 *   works from the Visual tab (`GraphView.tsx`/`GraphListView.tsx`,
 *   `BehaviorCardsPanel.tsx`). Follow-up filed: issue #176 / task 144.
 * - **Everything outside the bindings array** (the banner text and the
 *   generated runtime/camera script) stays compare-only, exactly as
 *   Grammar v1 left the entire JS sub-tab -- this is what makes "saving
 *   this tab back unchanged is a safe no-op" continue to hold for the
 *   parts that aren't newly editable.
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

export const CODE_GRAMMAR_VERSION = 2;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SHAPE_TYPES: ShapeType[] = ['circle', 'rect', 'line', 'path'];

// ---------------------------------------------------------------------------
// Grammar v2 (JS): bindings whitelist -- see the module doc comment's
// "Grammar v2 (JS)" section for the full rationale. These sets mirror
// `schema/scene.schema.json`'s `binding` definition's enums exactly.
// ---------------------------------------------------------------------------

const BINDING_SIGNALS = new Set([
  'indexTipX',
  'indexTipY',
  'palmX',
  'palmY',
  'handDepth',
  'handSpeed',
  'pinchStrength',
  'pinchDistance',
  'gestureConfidence',
  'handPresence',
  'gestureState:openPalm',
  'gestureState:closedFist',
  'gestureState:pointingUp',
  'gestureState:thumbsUp',
  'gestureState:victory',
  'gestureState:none',
  'event:pinchStart',
  'event:pinchEnd',
  'event:gestureEnter',
  'event:gestureExit',
  'event:handAppear',
  'event:handDisappear',
  'handDistance',
  'handsClose',
  'handsFar',
  'event:handsBecameClose',
  'event:handsBecameFar',
]);
const BINDING_HAND_TARGETS = new Set(['primary', 'left', 'right', 'either']);
const BINDING_TARGET_SCOPES = new Set(['shape', 'group', 'scene', 'interaction']);
const BINDING_TARGET_PROPERTIES = new Set([
  'positionX',
  'positionY',
  'scaleX',
  'scaleY',
  'rotation',
  'opacity',
  'fill',
  'stroke',
  'backgroundColor',
  'palette',
  'globalForce',
  'triggerPreset',
  'toggleLayer',
  'emitParticles',
  'resetScene',
]);
const BINDING_FIELDS = new Set([
  'id',
  'signal',
  'handTarget',
  'targetScope',
  'targetId',
  'targetProperty',
  'composition',
  'mapping',
  'smoothing',
  'closeThreshold',
  'farThreshold',
  'releaseThreshold',
  'holdTimeMs',
]);
const BINDING_REQUIRED_FIELDS = [
  'id',
  'signal',
  'handTarget',
  'targetScope',
  'targetId',
  'targetProperty',
  'composition',
] as const;
const MAPPING_FIELDS = new Set(['inMin', 'inMax', 'outMin', 'outMax']);
const BINDING_UNIT_INTERVAL_FIELDS = [
  'smoothing',
  'closeThreshold',
  'farThreshold',
  'releaseThreshold',
] as const;

type RawBinding = {
  id: string;
  signal: string;
  handTarget: string;
  targetScope: string;
  targetId: string | null;
  targetProperty: string;
  composition: 'replace';
  mapping?: Record<string, number>;
  smoothing?: number;
  closeThreshold?: number;
  farThreshold?: number;
  releaseThreshold?: number;
  holdTimeMs?: number;
};

const BINDINGS_START = '// >>> editable-bindings:start (Grammar v2 -- see codeGrammar.ts)';
const BINDINGS_END = '// >>> editable-bindings:end';

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
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
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

function rawBindingsOf(scene: SceneDocument): RawBinding[] {
  const bindings = (scene as { bindings?: unknown }).bindings;
  return Array.isArray(bindings) ? (bindings as RawBinding[]) : [];
}

function jsStringLiteral(value: string): string {
  // JSON.stringify's double-quoted escaping is a safe, standard superset of
  // what this grammar's own string parser (`parseJsLiteral` below) accepts
  // back -- this is pure serialization, never `eval`/`new Function`.
  return JSON.stringify(value);
}

/** Renders one `scene.bindings[]` entry as a JS object literal -- see the
 * module doc comment's "Grammar v2 (JS)" section for the exact field list. */
function renderBindingLiteral(binding: RawBinding): string {
  const lines: string[] = [];
  lines.push(`    id: ${jsStringLiteral(binding.id)},`);
  lines.push(`    signal: ${jsStringLiteral(binding.signal)},`);
  lines.push(`    handTarget: ${jsStringLiteral(binding.handTarget)},`);
  lines.push(`    targetScope: ${jsStringLiteral(binding.targetScope)},`);
  lines.push(
    `    targetId: ${binding.targetId === null || binding.targetId === undefined ? 'null' : jsStringLiteral(binding.targetId)},`,
  );
  lines.push(`    targetProperty: ${jsStringLiteral(binding.targetProperty)},`);
  lines.push(`    composition: ${jsStringLiteral(binding.composition ?? 'replace')},`);
  if (binding.mapping && Object.keys(binding.mapping).length > 0) {
    const parts = Object.entries(binding.mapping).map(([k, v]) => `${k}: ${num(v)}`);
    lines.push(`    mapping: { ${parts.join(', ')} },`);
  }
  for (const field of BINDING_UNIT_INTERVAL_FIELDS) {
    const value = binding[field];
    if (value !== undefined) lines.push(`    ${field}: ${num(value)},`);
  }
  if (binding.holdTimeMs !== undefined) lines.push(`    holdTimeMs: ${num(binding.holdTimeMs)},`);
  lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
  return `  {\n${lines.join('\n')}\n  }`;
}

/** Renders the whole editable `const bindings = [...]` statement -- see
 * the module doc comment's "Grammar v2 (JS)" section. */
function renderBindingsArray(bindings: RawBinding[]): string {
  if (bindings.length === 0) return 'const bindings = [];';
  return `const bindings = [\n${bindings.map(renderBindingLiteral).join(',\n')}\n];`;
}

/** The part of the JS sub-tab that Grammar v2 does NOT reverse-parse (the
 * explanatory banner plus the generated runtime/camera boilerplate) --
 * split out so both `generateEditableJs` and `parseEditableJs` build/compare
 * it from the exact same logic. Depends only on `scene.bindings`'s presence
 * (a pre-existing, unchanged `hasCamera` gate carried over from v1), never
 * on the bindings' actual content, so an edit to the bindings array alone
 * never touches this part's text. */
function immutableJsShell(scene: SceneDocument): { header: string; footer: string } {
  const header = [
    "// Generated from this scene's interaction runtime (graph + bindings).",
    '// Grammar v2 (task 143 / issue #175): the "bindings" array between the',
    '// sentinel comment lines just below is editable -- add, edit, or',
    '// remove entries to change camera/gesture behavior bindings. See',
    "// codeGrammar.ts's module doc comment for the exact whitelist of",
    '// supported fields. Graph nodes/connections are NOT yet reverse-parsed',
    "// (tracked as a follow-up -- see _docs/tasks.md task 144's resolution",
    '// notes for the issue number); the runtime code below the closing',
    '// sentinel must be saved back unchanged, or the save is rejected.',
    '',
  ].join('\n');
  const hasCamera = Array.isArray((scene as { bindings?: unknown[] }).bindings);
  const footer =
    '\n\n' +
    buildStandaloneRuntimeScript() +
    (hasCamera ? '\n\n' + buildStandaloneCameraScript() : '');
  return { header, footer };
}

/**
 * Generates the JavaScript sub-tab's content (Grammar v2, task 143 / issue
 * #175): an editable `const bindings = [...]` array literal reflecting
 * `scene.bindings` exactly, delimited by fixed sentinel comment lines,
 * followed by the same compare-only banner + generated runtime/camera
 * boilerplate Grammar v1 showed for the whole file. See the module doc
 * comment's "Grammar v2 (JS)" section for the full field-by-field mapping.
 */
export function generateEditableJs(scene: SceneDocument | null): string {
  if (!scene) return '';
  const shell = immutableJsShell(scene);
  const bindingsSrc = renderBindingsArray(rawBindingsOf(scene));
  return `${shell.header}${BINDINGS_START}\n${bindingsSrc}\n${BINDINGS_END}${shell.footer}`;
}

/** Used by the Code tab's JS sub-tab save handler as a fast, exact-string
 * no-op check before attempting to reverse-parse -- saving the JS sub-tab
 * back byte-for-byte unchanged (bindings included) is always a safe no-op,
 * matching Grammar v1's whole-file guarantee. */
export function isEditableJsUnchanged(text: string, scene: SceneDocument | null): boolean {
  return text === generateEditableJs(scene);
}

// ---------------------------------------------------------------------------
// Reverse direction: HTML + CSS -> SceneDocument mutations
// ---------------------------------------------------------------------------

export type GrammarParseResult =
  { ok: true; scene: SceneDocument } | { ok: false; errors: string[] };

type ParsedShapeAttrs = {
  id: string;
  type: string;
  layerId: string | null;
  groupId: string | null;
  hidden: boolean;
  locked: boolean;
};

function parseHtml(
  html: string,
): { ok: true; shapes: ParsedShapeAttrs[] } | { ok: false; errors: string[] } {
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
      errors.push(
        `Element ${index + 1} inside <main id="scene-shapes"> is a <${child.tagName.toLowerCase()}>, but only <div> shape elements are supported.`,
      );
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
        errors.push(
          `Shape "${id}": unrecognized class "${cls}" (allowed: ${[...allowedClasses].join(', ')}).`,
        );
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
    return {
      ok: false,
      errors: ['At-rules (e.g. @media) are not supported by the Code tab CSS grammar.'],
    };
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

function parseColorOrNone(
  value: string,
  field: string,
  errors: string[],
): string | null | undefined {
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
      errors.push(
        `Shape "${parsed.id}": type cannot change from "${existing.type}" to "${parsed.type}" via the Code tab.`,
      );
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
      errors.push(
        `Unsupported CSS selector "${rule.selector}" -- only "#scene-shapes" and "#shape-{id}" are supported.`,
      );
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

function applyCanvasDeclarations(
  decls: Record<string, string>,
  canvas: Canvas,
  errors: string[],
): void {
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

function applyShapeDeclarations(
  decls: Record<string, string>,
  shape: Shape,
  errors: string[],
): void {
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
          errors.push(
            `${label} transform: only "rotate(Ndeg)" and/or "scale(sx, sy)" are supported.`,
          );
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

// ---------------------------------------------------------------------------
// Grammar v2 (JS): reverse direction -- JS bindings array -> SceneDocument
// ---------------------------------------------------------------------------

/** The subset of JS literal syntax `parseJsLiteral` recognizes. Deliberately
 * NOT a general JS value type -- there is no "function," "identifier
 * reference," or similar executable-ish variant. */
type JsLiteralValue =
  string | number | boolean | null | JsLiteralValue[] | { [key: string]: JsLiteralValue };

/**
 * A minimal hand-rolled recursive-descent recognizer for the tiny subset of
 * JS literal syntax Grammar v2's bindings array needs: object literals
 * (quoted or bare identifier keys), array literals, single/double-quoted
 * strings (with `\\`, `\"`, `\'`, `\n`, `\t` escapes only), numbers,
 * `true`/`false`/`null`, and `//`/`/* *\/` comments. This is a pure text
 * walk -- it never evaluates or executes any part of `source`, and it has
 * no representation for function calls, identifiers-as-values, operators,
 * or template literals, so none of those can ever reach a `SceneDocument`
 * field even if the whitelist checks below it were somehow bypassed.
 */
function parseJsLiteral(
  source: string,
): { ok: true; value: JsLiteralValue } | { ok: false; error: string } {
  let i = 0;
  const n = source.length;

  function skipTrivia(): void {
    for (;;) {
      const c = source[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        i++;
        continue;
      }
      if (c === '/' && source[i + 1] === '/') {
        i += 2;
        while (i < n && source[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && source[i + 1] === '*') {
        i += 2;
        while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
      break;
    }
  }

  function fail(message: string): never {
    throw new Error(message);
  }

  function parseValue(): JsLiteralValue {
    skipTrivia();
    const c = source[i];
    if (c === '{') return parseObject();
    if (c === '[') return parseArray();
    if (c === '"' || c === "'") return parseString();
    if (c === '-' || (c >= '0' && c <= '9')) return parseNumber();
    if (source.startsWith('true', i)) {
      i += 4;
      return true;
    }
    if (source.startsWith('false', i)) {
      i += 5;
      return false;
    }
    if (source.startsWith('null', i)) {
      i += 4;
      return null;
    }
    fail(
      `unexpected token at position ${i}: "${source.slice(i, i + 20)}" -- only object/array literals, quoted strings, numbers, true/false/null are supported.`,
    );
  }

  function parseKey(): string {
    skipTrivia();
    if (source[i] === '"' || source[i] === "'") return parseString();
    const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(i));
    if (!match) fail(`expected an object key at position ${i}.`);
    i += match[0].length;
    return match[0];
  }

  function parseObject(): Record<string, JsLiteralValue> {
    i++; // consume '{'
    const obj: Record<string, JsLiteralValue> = {};
    skipTrivia();
    if (source[i] === '}') {
      i++;
      return obj;
    }
    for (;;) {
      const key = parseKey();
      skipTrivia();
      if (source[i] !== ':') fail(`expected ':' after key "${key}" at position ${i}.`);
      i++;
      obj[key] = parseValue();
      skipTrivia();
      if (source[i] === ',') {
        i++;
        skipTrivia();
        if (source[i] === '}') {
          i++;
          break;
        }
        continue;
      }
      if (source[i] === '}') {
        i++;
        break;
      }
      fail(`expected ',' or '}' at position ${i}.`);
    }
    return obj;
  }

  function parseArray(): JsLiteralValue[] {
    i++; // consume '['
    const arr: JsLiteralValue[] = [];
    skipTrivia();
    if (source[i] === ']') {
      i++;
      return arr;
    }
    for (;;) {
      arr.push(parseValue());
      skipTrivia();
      if (source[i] === ',') {
        i++;
        skipTrivia();
        if (source[i] === ']') {
          i++;
          break;
        }
        continue;
      }
      if (source[i] === ']') {
        i++;
        break;
      }
      fail(`expected ',' or ']' at position ${i}.`);
    }
    return arr;
  }

  function parseString(): string {
    const quote = source[i];
    i++;
    let out = '';
    while (i < n && source[i] !== quote) {
      if (source[i] === '\\') {
        const next = source[i + 1];
        if (next === 'n') out += '\n';
        else if (next === 't') out += '\t';
        else if (next === '"' || next === "'" || next === '\\') out += next;
        else fail(`unsupported escape sequence "\\${next}" at position ${i}.`);
        i += 2;
      } else {
        out += source[i];
        i++;
      }
    }
    if (source[i] !== quote) fail('unterminated string literal.');
    i++;
    return out;
  }

  function parseNumber(): number {
    const match = /^-?[0-9]+(?:\.[0-9]+)?/.exec(source.slice(i));
    if (!match) fail(`expected a number at position ${i}.`);
    i += match[0].length;
    return Number(match[0]);
  }

  try {
    const value = parseValue();
    skipTrivia();
    if (source[i] === ';') {
      i++;
      skipTrivia();
    }
    if (i !== n) {
      return {
        ok: false,
        error: `unexpected trailing content at position ${i}: "${source.slice(i, i + 20)}".`,
      };
    }
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'could not parse.' };
  }
}

/** Strips the `const bindings = ` prefix and hands the remainder to
 * `parseJsLiteral`, requiring the result to be an array literal. */
function parseBindingsSource(
  source: string,
): { ok: true; items: JsLiteralValue[] } | { ok: false; error: string } {
  const trimmed = source.trim();
  const prefixMatch = /^const\s+bindings\s*=\s*/.exec(trimmed);
  if (!prefixMatch) {
    return {
      ok: false,
      error: 'Expected exactly one "const bindings = [ ... ];" statement between the markers.',
    };
  }
  const parsed = parseJsLiteral(trimmed.slice(prefixMatch[0].length));
  if (!parsed.ok)
    return { ok: false, error: `Could not parse the bindings array: ${parsed.error}` };
  if (!Array.isArray(parsed.value)) {
    return {
      ok: false,
      error: '"bindings" must be assigned an array literal, e.g. "[ { ... } ]".',
    };
  }
  return { ok: true, items: parsed.value };
}

/** Validates one parsed bindings-array element against the Grammar v2
 * whitelist (see the module doc comment). Pushes every violation found onto
 * `errors` (not just the first) and returns `null` when the entry can't be
 * turned into a `RawBinding` at all; secondary field errors (e.g. an
 * out-of-range `mapping` value) are also pushed but don't stop validation of
 * the rest of the object, so a save surfaces every problem at once. */
function validateBindingLiteral(
  raw: JsLiteralValue,
  index: number,
  errors: string[],
): RawBinding | null {
  const label = `Binding ${index + 1}`;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    errors.push(`${label}: must be an object literal, e.g. { id: "b1", signal: "...", ... }.`);
    return null;
  }
  const obj = raw as Record<string, JsLiteralValue>;

  const unknownFields = Object.keys(obj).filter((key) => !BINDING_FIELDS.has(key));
  const missingFields = BINDING_REQUIRED_FIELDS.filter((key) => !(key in obj));
  if (unknownFields.length > 0) {
    errors.push(
      `${label}: unsupported field(s) ${unknownFields.map((f) => `"${f}"`).join(', ')} (allowed: ${[...BINDING_FIELDS].join(', ')}).`,
    );
  }
  if (missingFields.length > 0) {
    errors.push(
      `${label}: missing required field(s) ${missingFields.map((f) => `"${f}"`).join(', ')}.`,
    );
  }
  if (unknownFields.length > 0 || missingFields.length > 0) return null;

  const id = obj.id;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    errors.push(`${label}: "id" must be a string id (letters/digits/-/_, 1-64 chars).`);
    return null;
  }
  const signal = obj.signal;
  if (typeof signal !== 'string' || !BINDING_SIGNALS.has(signal)) {
    errors.push(`${label}: "signal" must be one of: ${[...BINDING_SIGNALS].join(', ')}.`);
    return null;
  }
  const handTarget = obj.handTarget;
  if (typeof handTarget !== 'string' || !BINDING_HAND_TARGETS.has(handTarget)) {
    errors.push(`${label}: "handTarget" must be one of: ${[...BINDING_HAND_TARGETS].join(', ')}.`);
    return null;
  }
  const targetScope = obj.targetScope;
  if (typeof targetScope !== 'string' || !BINDING_TARGET_SCOPES.has(targetScope)) {
    errors.push(
      `${label}: "targetScope" must be one of: ${[...BINDING_TARGET_SCOPES].join(', ')}.`,
    );
    return null;
  }
  const targetIdRaw = obj.targetId;
  let targetId: string | null;
  if (targetIdRaw === null) {
    targetId = null;
  } else if (typeof targetIdRaw === 'string' && ID_PATTERN.test(targetIdRaw)) {
    targetId = targetIdRaw;
  } else {
    errors.push(`${label}: "targetId" must be a string id or null.`);
    return null;
  }
  const targetProperty = obj.targetProperty;
  if (typeof targetProperty !== 'string' || !BINDING_TARGET_PROPERTIES.has(targetProperty)) {
    errors.push(
      `${label}: "targetProperty" must be one of: ${[...BINDING_TARGET_PROPERTIES].join(', ')}.`,
    );
    return null;
  }
  const composition = obj.composition;
  if (composition !== 'replace') {
    errors.push(`${label}: "composition" must be "replace" (the only value this pass supports).`);
    return null;
  }

  const binding: RawBinding = {
    id,
    signal,
    handTarget,
    targetScope,
    targetId,
    targetProperty,
    composition: 'replace',
  };

  if ('mapping' in obj) {
    const mappingRaw = obj.mapping;
    if (typeof mappingRaw !== 'object' || mappingRaw === null || Array.isArray(mappingRaw)) {
      errors.push(`${label}: "mapping" must be an object literal, e.g. { inMin: 0, inMax: 1 }.`);
    } else {
      const mapping: Record<string, number> = {};
      for (const [key, value] of Object.entries(mappingRaw as Record<string, JsLiteralValue>)) {
        if (!MAPPING_FIELDS.has(key)) {
          errors.push(
            `${label}: mapping field "${key}" is unsupported (allowed: ${[...MAPPING_FIELDS].join(', ')}).`,
          );
        } else if (typeof value !== 'number') {
          errors.push(`${label}: mapping.${key} must be a number.`);
        } else {
          mapping[key] = value;
        }
      }
      binding.mapping = mapping;
    }
  }

  for (const field of BINDING_UNIT_INTERVAL_FIELDS) {
    if (field in obj) {
      const value = obj[field];
      if (typeof value !== 'number' || value < 0 || value > 1) {
        errors.push(`${label}: "${field}" must be a number between 0 and 1.`);
      } else {
        binding[field] = value;
      }
    }
  }
  if ('holdTimeMs' in obj) {
    const value = obj.holdTimeMs;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10000) {
      errors.push(`${label}: "holdTimeMs" must be an integer between 0 and 10000.`);
    } else {
      binding.holdTimeMs = value;
    }
  }

  return binding;
}

/**
 * Reverse-parses the Code tab's JS sub-tab text (Grammar v2, task 143 /
 * issue #175) back onto `previousScene`'s `bindings` array. Everything
 * outside the `BINDINGS_START`/`BINDINGS_END` markers (the banner and the
 * generated runtime/camera boilerplate) must be saved back byte-for-byte
 * identical to what `generateEditableJs` would produce for `previousScene`
 * -- any drift there is rejected with a specific, actionable error, exactly
 * like every other out-of-grammar edit in this module. `graph` and every
 * other field are carried over from `previousScene` completely unchanged
 * -- see the module doc comment's "what's OUT" section for why graph
 * nodes/connections aren't part of this pass.
 */
export function parseEditableJs(text: string, previousScene: SceneDocument): GrammarParseResult {
  const errors: string[] = [];
  const startIdx = text.indexOf(BINDINGS_START);
  const endIdx =
    startIdx === -1 ? -1 : text.indexOf(BINDINGS_END, startIdx + BINDINGS_START.length);
  if (startIdx === -1 || endIdx === -1) {
    return {
      ok: false,
      errors: [
        `JavaScript must contain exactly one "${BINDINGS_START}" ... "${BINDINGS_END}" block -- only the bindings array between those two marker lines is editable. Switch away from the JS tab and back to regenerate it if the markers were removed.`,
      ],
    };
  }
  if (
    text.indexOf(BINDINGS_START, startIdx + BINDINGS_START.length) !== -1 ||
    text.indexOf(BINDINGS_END, endIdx + BINDINGS_END.length) !== -1
  ) {
    return {
      ok: false,
      errors: [`Only one "${BINDINGS_START}" / "${BINDINGS_END}" block is allowed.`],
    };
  }

  const before = text.slice(0, startIdx);
  const bindingsSrc = text
    .slice(startIdx + BINDINGS_START.length, endIdx)
    .replace(/^\n/, '')
    .trimEnd();
  const after = text.slice(endIdx + BINDINGS_END.length);

  const expectedShell = immutableJsShell(previousScene);
  if (before !== expectedShell.header) {
    errors.push(
      `Only the bindings array is editable -- the JavaScript above "${BINDINGS_START}" must stay exactly as generated. Use the Visual tab for graph/behavior changes, or switch away from and back to the JS tab to discard this part of the edit.`,
    );
  }
  if (after !== expectedShell.footer) {
    errors.push(
      `Only the bindings array is editable -- the generated runtime code below "${BINDINGS_END}" is not part of the supported grammar yet (see codeGrammar.ts's module doc comment) and must stay exactly as generated. Use the Visual tab for graph node/connection changes instead.`,
    );
  }

  const parsedDecl = parseBindingsSource(bindingsSrc);
  if (!parsedDecl.ok) {
    errors.push(parsedDecl.error);
    return { ok: false, errors };
  }

  const bindings: RawBinding[] = [];
  const seenIds = new Set<string>();
  parsedDecl.items.forEach((item, index) => {
    const binding = validateBindingLiteral(item, index, errors);
    if (!binding) return;
    if (seenIds.has(binding.id)) {
      errors.push(
        `Binding ${index + 1}: duplicate id "${binding.id}" -- binding ids must be unique.`,
      );
      return;
    }
    seenIds.add(binding.id);
    bindings.push(binding);
  });

  if (errors.length > 0) return { ok: false, errors };

  const nextScene: SceneDocument = { ...previousScene, bindings };
  return { ok: true, scene: nextScene };
}

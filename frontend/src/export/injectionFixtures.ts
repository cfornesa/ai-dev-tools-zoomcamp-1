/**
 * Task 74 (issue #74): a systematic, fixture-driven hostile-payload catalog
 * for the export HTML artifact (`generateHtmlExport.ts`), plus a scene
 * builder that places each payload in every context it can actually reach
 * in the generated document.
 *
 * ## Relationship to existing coverage
 *
 * Task 56's own QA (issue #57) already hand-verified a handful of hostile
 * payloads (`</script>` breakout, case variants, an HTML-comment trick, an
 * attribute breakout) against title/description/layer-name — see
 * `generateHtmlExport.test.ts`'s `HOSTILE_*` constants. Task 72 (issue #72)
 * built a parallel fixture-driven pattern for *scene/patch structural*
 * validity (`schema/fixtures/malicious/`), not injection safety.
 *
 * This module is new, broader coverage for the export-HTML injection
 * surface specifically: it names each of the 9 hostile-value categories
 * issue #74's acceptance criteria call out (title, description, labels,
 * colors, URLs, closing tags, quotes, Unicode controls, structured scene
 * strings), gives each a concrete adversarial payload carrying its own
 * unique "pwn marker" (`window.__pwn_<id>__`) so a real-browser execution
 * test can assert, precisely, that no payload ever ran as script — and adds
 * an "ordinary" control category (plain Unicode/punctuation prose) so a
 * test can also catch the opposite failure mode: over-escaping text that
 * was never dangerous in the first place.
 *
 * ## Contexts each category actually reaches
 *
 * Traced from `generateHtmlExport.ts` (see that module's own doc comment):
 *
 *  - `title`/`description`: HTML text content (`<title>`, `<h1>`, `<p>`)
 *    *and* a quoted HTML attribute value (`<meta content="...">`,
 *    `<meta property="og:...">`) — both escaped by `escapeHtml`.
 *  - `label` (a scene `layers[].name`/`groups[].name`) and
 *    `structuredSceneString` (a `graph.nodes[].params` string value, and a
 *    hostile params *key*): only the `<script type="application/json"
 *    id="scene-data">` JSON-data context — escaped by `safeJsonForScriptTag`.
 *    Traced (`grep`) across `standaloneRuntimeSource.ts`/
 *    `standaloneCameraSource.ts`: neither ever writes a layer/group name or
 *    a graph node's `params` value into the DOM as HTML (they're read back
 *    only via `JSON.parse(...).textContent` and used as opaque render/
 *    binding data) — so the JSON-script context is the *only* one these two
 *    categories can reach in the current runtime, confirmed rather than
 *    assumed.
 *  - `color`: constrained by `schema/scene.schema.json`'s
 *    `$defs.color` pattern (`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`),
 *    enforced by `validateScene` inside `buildScenePlan`'s backstop, which
 *    `checkExportBlockingReasons` always runs before any HTML is built. A
 *    non-conforming color string can never reach the export document at
 *    all — it blocks generation outright instead. This module's color
 *    fixtures exist to *prove* that block, not to exercise an embedding
 *    context that turns out to be unreachable.
 *  - `url`: the schema has no user-controlled URL-shaped field at all (the
 *    one `href` in the whole document, the attribution link, is a hardcoded
 *    constant — see `ATTRIBUTION_PRODUCT_URL`). URL-shaped hostile strings
 *    (`javascript:`, `data:text/html,...`) are therefore tested as *content*
 *    inside title/description/label, proving they render as inert text and
 *    never become a live `href`/`src` anywhere.
 *  - `closingTag`/`quote`/`unicodeControl`: cross-cutting techniques applied
 *    across whichever context each concrete payload is placed in (title,
 *    description, or label) — not a distinct embedding context of their
 *    own.
 */
import type { SceneDocument } from '../api/projects';

export type InjectionCategory =
  | 'title'
  | 'description'
  | 'label'
  | 'color'
  | 'url'
  | 'closingTag'
  | 'quote'
  | 'unicodeControl'
  | 'structuredSceneString'
  | 'ordinaryUnicode';

export type InjectionFixture = {
  /** Unique id, also embedded in the payload's pwn marker where relevant. */
  id: string;
  category: InjectionCategory;
  /** Human-readable note on what this payload attempts. */
  note: string;
  value: string;
  /** `window.__pwn_<pwnMarker>__` -- set to `true` only if the payload
   * genuinely executes as script. `undefined` for fixtures (e.g. color,
   * ordinaryUnicode) that carry no executable marker. */
  pwnMarker?: string;
};

function pwnScript(marker: string): string {
  return `<script>window.__pwn_${marker}__=true;</script>`;
}

export const TITLE_FIXTURES: InjectionFixture[] = [
  {
    id: 'title-script-breakout',
    category: 'title',
    note: 'closes </title> then injects a live <script>',
    value: `</title>${pwnScript('title_script')}`,
    pwnMarker: 'title_script',
  },
  {
    id: 'title-attr-breakout',
    category: 'title',
    note: 'attempts to break out of the sibling meta content="" attribute',
    value: `"><img src=x onerror="window.__pwn_title_attr__=true">`,
    pwnMarker: 'title_attr',
  },
  {
    id: 'title-body-onload',
    category: 'title',
    note: 'attempts to close head/title and inject a body onload handler',
    value: `</title></head><body onload="window.__pwn_title_body__=true">`,
    pwnMarker: 'title_body',
  },
  {
    id: 'title-case-variant',
    category: 'title',
    note: 'mixed-case tag names, defeating a naive case-sensitive filter',
    value: `</TiTlE><ScRiPt>window.__pwn_title_case__=true;</ScRiPt>`,
    pwnMarker: 'title_case',
  },
];

export const DESCRIPTION_FIXTURES: InjectionFixture[] = [
  {
    id: 'description-meta-refresh',
    category: 'description',
    note: 'attempts to close meta content="" and inject a refresh redirect',
    value: `" /><meta http-equiv="refresh" content="0;url=javascript:window.__pwn_desc_refresh__=true">`,
    pwnMarker: 'desc_refresh',
  },
  {
    id: 'description-script-breakout',
    category: 'description',
    note: 'closes the description <p> then injects a live <script>',
    value: `</p>${pwnScript('desc_script')}<p>`,
    pwnMarker: 'desc_script',
  },
  {
    id: 'description-comment-trick',
    category: 'description',
    note: 'wraps a breakout attempt in an HTML comment',
    value: `<!--</p><script>window.__pwn_desc_comment__=true;</script>-->`,
    pwnMarker: 'desc_comment',
  },
];

export const LABEL_FIXTURES: InjectionFixture[] = [
  {
    id: 'label-script-breakout',
    category: 'label',
    note: 'layer/group name attempting a </script> breakout of the JSON data block',
    value: `</script>${pwnScript('label_script')}`,
    pwnMarker: 'label_script',
  },
  {
    id: 'label-case-variant',
    category: 'label',
    note: 'mixed-case </SCRIPT> breakout attempt',
    value: `</SCRIPT><SCRIPT>window.__pwn_label_case__=true;</SCRIPT>`,
    pwnMarker: 'label_case',
  },
];

/** Hex-pattern-conforming colors (must remain accepted -- a functional,
 * non-regression control) plus hostile non-conforming strings that must be
 * *rejected at generation time*, never embedded. */
export const VALID_COLOR_FIXTURES: string[] = ['#fff', '#ABCDEF', '#12345678'];
export const COLOR_FIXTURES: InjectionFixture[] = [
  {
    id: 'color-attr-breakout',
    category: 'color',
    note: 'non-hex string attempting an attribute breakout if ever embedded raw',
    value: `red" onload="window.__pwn_color_attr__=true`,
  },
  {
    id: 'color-script-breakout',
    category: 'color',
    note: 'non-hex string attempting a script breakout if ever embedded raw',
    value: `#fff</script><script>window.__pwn_color_script__=true</script>`,
  },
];

export const URL_FIXTURES: InjectionFixture[] = [
  {
    id: 'url-javascript-scheme',
    category: 'url',
    note: 'a javascript: URL used as plain content -- must never become a live href/src',
    value: 'javascript:window.__pwn_url_js__=true',
    pwnMarker: 'url_js',
  },
  {
    id: 'url-data-html',
    category: 'url',
    note: 'a data:text/html URL carrying an embedded <script>, used as plain content',
    value: 'data:text/html,<script>window.__pwn_url_data__=true</script>',
    pwnMarker: 'url_data',
  },
];

export const CLOSING_TAG_FIXTURES: InjectionFixture[] = [
  {
    id: 'closing-style',
    category: 'closingTag',
    note: 'closes </style>',
    value: `</style>${pwnScript('close_style')}`,
    pwnMarker: 'close_style',
  },
  {
    id: 'closing-head',
    category: 'closingTag',
    note: 'closes </head>',
    value: `</head>${pwnScript('close_head')}`,
    pwnMarker: 'close_head',
  },
  {
    id: 'closing-html',
    category: 'closingTag',
    note: 'closes </html>',
    value: `</html>${pwnScript('close_html')}`,
    pwnMarker: 'close_html',
  },
  {
    id: 'closing-whitespace-variant',
    category: 'closingTag',
    note: 'closing tag with internal whitespace, defeating a naive exact-match filter',
    value: `</ScRiPt >${pwnScript('close_ws')}`,
    pwnMarker: 'close_ws',
  },
];

export const QUOTE_FIXTURES: InjectionFixture[] = [
  {
    id: 'quote-double-onmouseover',
    category: 'quote',
    note: 'double-quote attribute breakout with an inline event handler',
    value: `" onmouseover="window.__pwn_quote_double__=true" data-x="`,
    pwnMarker: 'quote_double',
  },
  {
    id: 'quote-single-onmouseover',
    category: 'quote',
    note: 'single-quote attribute breakout with an inline event handler',
    value: `' onmouseover='window.__pwn_quote_single__=true' data-x='`,
    pwnMarker: 'quote_single',
  },
  {
    id: 'quote-mixed-backtick',
    category: 'quote',
    note: 'mixed single/double/backtick quoting -- backticks are not HTML-significant, included for completeness',
    value: `"'\`"'\`SANITY`,
  },
];

/** Explicit `\u{XXXX}` escapes throughout (never literal invisible/control
 * characters in source) -- both to keep this file's diff/rendering
 * unambiguous and because these exact codepoints are the point of each
 * fixture, so naming them precisely matters. */
const RTL_OVERRIDE = '\u202E';
const POP_DIRECTIONAL_FORMATTING = '\u202C';
const ZERO_WIDTH_SPACE = '\u200B';
const NUL_BYTE = '\u0000';
const BOM = '\uFEFF';

export const UNICODE_CONTROL_FIXTURES: InjectionFixture[] = [
  {
    id: 'unicode-rtl-override',
    category: 'unicodeControl',
    note: 'U+202E right-to-left override wrapping a breakout attempt',
    value: `${RTL_OVERRIDE}</script>${pwnScript('unicode_rtl')}${POP_DIRECTIONAL_FORMATTING}`,
    pwnMarker: 'unicode_rtl',
  },
  {
    id: 'unicode-zero-width',
    category: 'unicodeControl',
    note: 'U+200B zero-width space split across a closing-tag sequence',
    value: `<${ZERO_WIDTH_SPACE}/script>${pwnScript('unicode_zw')}`,
    pwnMarker: 'unicode_zw',
  },
  {
    id: 'unicode-null-byte',
    category: 'unicodeControl',
    note: 'U+0000 NUL byte adjacent to a breakout attempt',
    value: `${NUL_BYTE}</script>${pwnScript('unicode_null')}${NUL_BYTE}`,
    pwnMarker: 'unicode_null',
  },
  {
    id: 'unicode-bom',
    category: 'unicodeControl',
    note: 'U+FEFF byte-order mark adjacent to a breakout attempt',
    value: `${BOM}</script>${pwnScript('unicode_bom')}`,
    pwnMarker: 'unicode_bom',
  },
];

export const STRUCTURED_SCENE_STRING_FIXTURES: InjectionFixture[] = [
  {
    id: 'params-value-breakout',
    category: 'structuredSceneString',
    note: 'a graph node params string value attempting a </script> breakout',
    value: `</script>${pwnScript('params_value')}`,
    pwnMarker: 'params_value',
  },
  {
    id: 'params-key-breakout',
    category: 'structuredSceneString',
    note: 'a graph node params *key* (JSON object key, not value) attempting a </script> breakout',
    value: `</script>${pwnScript('params_key')}`,
    pwnMarker: 'params_key',
  },
];

/** Ordinary, entirely non-hostile Unicode and punctuation prose -- the
 * over-escaping regression control. Every character here must survive
 * `escapeHtml`/`safeJsonForScriptTag` unchanged except the five literal
 * HTML-significant ASCII characters that `escapeHtml` always escapes
 * (there are none in these strings). */
export const ORDINARY_UNICODE_FIXTURES: string[] = [
  'Café — “fancy quotes” 日本語 🎉 emoji, naïve façade',
  'Plain ASCII punctuation: hello, world! (test) [ok] #1 - dash — em—dash … ellipsis',
  'Ampersand-adjacent but safe: rock & roll, salt & pepper (no entities needed beyond &)',
];

export const ALL_INJECTION_FIXTURES: InjectionFixture[] = [
  ...TITLE_FIXTURES,
  ...DESCRIPTION_FIXTURES,
  ...LABEL_FIXTURES,
  ...COLOR_FIXTURES,
  ...URL_FIXTURES,
  ...CLOSING_TAG_FIXTURES,
  ...QUOTE_FIXTURES,
  ...UNICODE_CONTROL_FIXTURES,
  ...STRUCTURED_SCENE_STRING_FIXTURES,
];

/** One payload combining several techniques at once (RTL override + zero
 * width + closing-tag + quote breakout + case variant), for a single
 * "worst case" scenario run across the full attribution/interaction-mode
 * matrix rather than every fixture individually (which the real-Chromium
 * e2e suite has to keep small to stay fast -- see `injectionArtifacts.spec.ts`). */
export const COMBINED_WORST_CASE_PAYLOAD =
  `${RTL_OVERRIDE}</ScRiPt><script>window.__pwn_combined__=true;</script>${ZERO_WIDTH_SPACE}` +
  `" onmouseover="window.__pwn_combined_attr__=true" data-x="'\`` +
  `<!--</style><body onload="window.__pwn_combined_body__=true">-->`;

/** Builds a minimal, schema-valid scene document embedding `label` into a
 * layer name and a group name, and `structured`/`structuredKey` into a
 * graph node's `params`. Everything else is a fixed, known-safe baseline
 * (mirrors `generateHtmlExport.test.ts`'s own `baseScene`). */
export function sceneWithHostileScopedStrings(options: {
  label?: string;
  color?: string;
  structuredValue?: string;
  structuredKey?: string;
}): SceneDocument {
  const label = options.label ?? 'Layer';
  const color = options.color ?? '#ff0000';
  const paramsKey = options.structuredKey ?? 'note';
  const params: Record<string, unknown> = {
    [paramsKey]: options.structuredValue ?? 'ordinary note',
  };

  return {
    schemaVersion: 1,
    id: 'scene-internal-id-injection-fixture',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: label, order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'shape-1',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: color, stroke: null, strokeWidth: 0 },
        radius: 40,
      },
    ],
    groups: [
      {
        id: 'group-1',
        name: label,
        layerId: 'layer-1',
        childIds: [],
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        visible: true,
        locked: true,
      },
    ],
    bindings: [],
    graph: {
      nodes: [
        {
          id: 'node-1',
          family: 'input',
          type: 'timer',
          params,
          position: { x: 0, y: 0 },
        },
      ],
      connections: [],
    },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
  };
}

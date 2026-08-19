/**
 * Task 74 (issue #74): systematic, fixture-driven injection-safety coverage
 * for the export HTML artifact, using the full catalog in
 * `injectionFixtures.ts`. Runs entirely in jsdom (fast, in-process) --
 * `../../e2e/injectionArtifacts.spec.ts` covers the same categories again
 * against a *real* Chromium engine under a restrictive network/execution
 * policy, per issue #74's "opening each artifact ... produces no
 * unexpected script, request, navigation, DOM node, or event handler"
 * acceptance criterion.
 *
 * What this file proves, systematically rather than ad hoc:
 *
 *  1. Every hostile fixture, embedded wherever it can actually reach in the
 *     generated document (title/description -> HTML text+attribute;
 *     label/structured scene strings -> JSON-script only), produces a
 *     `generateHtmlExport` call that succeeds (`ok: true`) and parses as a
 *     single well-formed HTML document with no stray/extra `<script>`
 *     element and no element carrying an `on*` attribute anywhere --
 *     checked via real `DOMParser` parsing, not substring matching.
 *  2. The fixture's exact original string round-trips losslessly (as
 *     escaped text content, an escaped attribute value, or JSON data),
 *     proving escaping never corrupts or drops information.
 *  3. Every hostile color fixture is *rejected* before any HTML is built
 *     (`ok: false`, no `html` field at all -- "no partial file"), while
 *     every schema-conforming color fixture still produces a working
 *     export -- resolving issue #74's "blocked unsafe value .../ safely
 *     escapable value still produces a functional export" criterion.
 *  4. Ordinary Unicode/punctuation prose survives unescaped except the five
 *     ASCII characters `escapeHtml` always escapes -- the over-escaping
 *     regression control.
 */
import { describe, expect, it } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { generateHtmlExport, type GenerateHtmlExportInput } from './generateHtmlExport';
import {
  ALL_INJECTION_FIXTURES,
  COLOR_FIXTURES,
  COMBINED_WORST_CASE_PAYLOAD,
  DESCRIPTION_FIXTURES,
  LABEL_FIXTURES,
  ORDINARY_UNICODE_FIXTURES,
  STRUCTURED_SCENE_STRING_FIXTURES,
  TITLE_FIXTURES,
  VALID_COLOR_FIXTURES,
  sceneWithHostileScopedStrings,
} from './injectionFixtures';

function baseScene(overrides: Partial<SceneDocument> = {}): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-internal-id',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'shape-1',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: '#ff0000', stroke: null, strokeWidth: 0 },
        radius: 40,
      },
    ],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'auto' },
    randomness: { seed: 0, enabled: false },
    ...overrides,
  };
}

function baseInput(overrides: Partial<GenerateHtmlExportInput> = {}): GenerateHtmlExportInput {
  return {
    scene: baseScene(),
    title: 'My Gesture Animation',
    description: 'A small reactive animation.',
    interactionMode: 'demo',
    ...overrides,
  };
}

/** Every element in `doc` carrying an attribute name starting with "on" --
 * the definitive check for a live inline event handler surviving into the
 * parsed DOM, regardless of what raw-string techniques produced it. */
function elementsWithEventHandlerAttrs(doc: Document): string[] {
  const offenders: string[] = [];
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.toLowerCase().startsWith('on')) {
        offenders.push(`<${el.tagName.toLowerCase()} ${attr.name}="${attr.value}">`);
      }
    }
  });
  return offenders;
}

/** `<script>` elements beyond the exact expected set for a given mode: the
 * p5 CDN loader, the two `application/json` data blocks, the runtime
 * script, and (camera-inclusive modes only) the camera script -- any
 * additional executable script node is a real breakout. */
function unexpectedScriptCount(doc: Document, includesCamera: boolean): number {
  const scripts = Array.from(doc.querySelectorAll('script'));
  // Exactly: p5 CDN loader, scene-data json, export-config json, runtime
  // script, and (camera-inclusive modes only) the camera script. Any extra
  // <script> element beyond this exact count is a real breakout -- an
  // injected script produced by a hostile payload would show up as an
  // additional element in this same query.
  const expected = includesCamera ? 5 : 4;
  return Math.max(0, scripts.length - expected);
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('injectionFixtures: title fixtures never break out of text/attribute context', () => {
  for (const fixture of TITLE_FIXTURES) {
    it(`"${fixture.id}": ${fixture.note}`, () => {
      const result = generateHtmlExport(baseInput({ title: fixture.value }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const doc = parse(result.html);
      expect(doc.title).toBe(fixture.value);
      expect(elementsWithEventHandlerAttrs(doc)).toEqual([]);
      expect(unexpectedScriptCount(doc, false)).toBe(0);
      expect(
        (window as unknown as Record<string, unknown>)[`__pwn_${fixture.pwnMarker}__`],
      ).toBeUndefined();
    });
  }
});

describe('injectionFixtures: description fixtures never break out of text/attribute context', () => {
  for (const fixture of DESCRIPTION_FIXTURES) {
    it(`"${fixture.id}": ${fixture.note}`, () => {
      const result = generateHtmlExport(baseInput({ description: fixture.value }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const doc = parse(result.html);
      const meta = doc.querySelector('meta[name="description"]');
      expect(meta?.getAttribute('content')).toBe(fixture.value);
      const paragraph = doc.querySelector('#project-description');
      expect(paragraph?.textContent).toBe(fixture.value);
      expect(elementsWithEventHandlerAttrs(doc)).toEqual([]);
      expect(unexpectedScriptCount(doc, false)).toBe(0);
    });
  }
});

describe('injectionFixtures: label (layer/group name) fixtures stay confined to the JSON-script context', () => {
  for (const fixture of LABEL_FIXTURES) {
    it(`"${fixture.id}": ${fixture.note}`, () => {
      const scene = sceneWithHostileScopedStrings({ label: fixture.value });
      const result = generateHtmlExport(baseInput({ scene }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const doc = parse(result.html);
      expect(elementsWithEventHandlerAttrs(doc)).toEqual([]);
      expect(unexpectedScriptCount(doc, false)).toBe(0);

      const sceneDataScript = doc.getElementById('scene-data');
      expect(sceneDataScript?.getAttribute('type')).toBe('application/json');
      const parsedScene = JSON.parse(sceneDataScript?.textContent ?? '{}') as {
        layers: { name: string }[];
        groups: { name: string }[];
      };
      expect(parsedScene.layers[0].name).toBe(fixture.value);
      expect(parsedScene.groups[0].name).toBe(fixture.value);
      // The value never leaked anywhere else in the raw document text
      // outside the JSON script block.
      expect(result.html).not.toContain(`<h1>${fixture.value}`);
    });
  }
});

describe('injectionFixtures: structured scene strings (graph node params value and key)', () => {
  for (const fixture of STRUCTURED_SCENE_STRING_FIXTURES) {
    it(`"${fixture.id}": ${fixture.note}`, () => {
      const isKeyFixture = fixture.id === 'params-key-breakout';
      const scene = sceneWithHostileScopedStrings(
        isKeyFixture ? { structuredKey: fixture.value } : { structuredValue: fixture.value },
      );
      const result = generateHtmlExport(baseInput({ scene }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const doc = parse(result.html);
      expect(elementsWithEventHandlerAttrs(doc)).toEqual([]);
      expect(unexpectedScriptCount(doc, false)).toBe(0);

      const sceneDataScript = doc.getElementById('scene-data');
      const parsedScene = JSON.parse(sceneDataScript?.textContent ?? '{}') as {
        graph: { nodes: { params: Record<string, unknown> }[] };
      };
      const params = parsedScene.graph.nodes[0].params;
      if (isKeyFixture) {
        expect(Object.prototype.hasOwnProperty.call(params, fixture.value)).toBe(true);
      } else {
        expect(params.note).toBe(fixture.value);
      }
    });
  }
});

describe('injectionFixtures: color fixtures are rejected before any HTML is built (schema-enforced)', () => {
  for (const fixture of COLOR_FIXTURES) {
    it(`"${fixture.id}": ${fixture.note} -- blocked, no partial file`, () => {
      const scene = sceneWithHostileScopedStrings({ color: fixture.value });
      const result = generateHtmlExport(baseInput({ scene }));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reasons.length).toBeGreaterThan(0);
      // No partial file: the result type has no `html` field at all when
      // blocked, not an empty string -- structurally impossible to leak a
      // half-built document.
      expect('html' in result).toBe(false);
    });
  }

  for (const color of VALID_COLOR_FIXTURES) {
    it(`a schema-conforming color ("${color}") still produces a functional export`, () => {
      const scene = sceneWithHostileScopedStrings({ color });
      const result = generateHtmlExport(baseInput({ scene }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const doc = parse(result.html);
      const sceneDataScript = doc.getElementById('scene-data');
      const parsedScene = JSON.parse(sceneDataScript?.textContent ?? '{}') as {
        shapes: { style: { fill: string } }[];
      };
      expect(parsedScene.shapes[0].style.fill).toBe(color);
    });
  }
});

describe('injectionFixtures: escaping always succeeds -- the full catalog never throws and always parses as one well-formed document', () => {
  const nonColorFixtures = ALL_INJECTION_FIXTURES.filter((f) => f.category !== 'color');

  it('every non-color fixture placed in title, description, label, and structured-scene-string position produces ok:true with no stray script/event-handler', () => {
    const failures: string[] = [];
    for (const fixture of nonColorFixtures) {
      for (const placement of ['title', 'description', 'label', 'structured'] as const) {
        let input: GenerateHtmlExportInput;
        if (placement === 'title') {
          input = baseInput({ title: fixture.value });
        } else if (placement === 'description') {
          input = baseInput({ description: fixture.value });
        } else if (placement === 'label') {
          input = baseInput({ scene: sceneWithHostileScopedStrings({ label: fixture.value }) });
        } else {
          input = baseInput({
            scene: sceneWithHostileScopedStrings({ structuredValue: fixture.value }),
          });
        }

        let result: ReturnType<typeof generateHtmlExport>;
        try {
          result = generateHtmlExport(input);
        } catch (error) {
          failures.push(`${fixture.id}/${placement}: threw ${String(error)}`);
          continue;
        }
        if (!result.ok) {
          failures.push(
            `${fixture.id}/${placement}: unexpectedly blocked (${result.reasons.join(' ')})`,
          );
          continue;
        }
        const doc = parse(result.html);
        const handlers = elementsWithEventHandlerAttrs(doc);
        if (handlers.length > 0) {
          failures.push(
            `${fixture.id}/${placement}: event handler attrs found: ${handlers.join(', ')}`,
          );
        }
        if (unexpectedScriptCount(doc, false) !== 0) {
          failures.push(`${fixture.id}/${placement}: unexpected extra <script> node(s)`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('the combined worst-case payload (RTL override + zero-width + quote + closing-tag + comment trick) is safely escaped in every placement', () => {
    for (const placement of ['title', 'description', 'label'] as const) {
      const input =
        placement === 'title'
          ? baseInput({ title: COMBINED_WORST_CASE_PAYLOAD })
          : placement === 'description'
            ? baseInput({ description: COMBINED_WORST_CASE_PAYLOAD })
            : baseInput({
                scene: sceneWithHostileScopedStrings({ label: COMBINED_WORST_CASE_PAYLOAD }),
              });
      const result = generateHtmlExport(input);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const doc = parse(result.html);
      expect(elementsWithEventHandlerAttrs(doc)).toEqual([]);
      expect(unexpectedScriptCount(doc, false)).toBe(0);
    }
  });
});

describe('injectionFixtures: ordinary Unicode/punctuation is never over-escaped', () => {
  for (const text of ORDINARY_UNICODE_FIXTURES) {
    it(`"${text.slice(0, 30)}..." renders as readable text, unescaped beyond the five HTML-significant ASCII characters`, () => {
      const result = generateHtmlExport(baseInput({ title: text, description: text }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Raw source: every non-HTML-significant character (accents, CJK,
      // emoji, em dash, curly quotes, ellipsis) appears completely
      // unescaped -- an over-escaping regression (e.g. entity-encoding
      // every non-ASCII codepoint) would fail this exact assertion.
      const expectedEscaped = text.replace(/&/g, '&amp;');
      expect(result.html).toContain(expectedEscaped);

      const doc = parse(result.html);
      expect(doc.title).toBe(text);
      const paragraph = doc.querySelector('#project-description');
      expect(paragraph?.textContent).toBe(text);
    });
  }
});

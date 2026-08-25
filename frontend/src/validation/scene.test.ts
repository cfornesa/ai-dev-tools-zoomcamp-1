/**
 * Validate scene.ts against the shared schema/fixtures/*.
 *
 * `schema/fixtures/expectations.json` is the single source of truth for
 * what each fixture should do; `tests/test_scene_validation.py` asserts
 * the same expectations against the Python validator. Neither suite runs
 * the other's validator — they're checked for agreement indirectly,
 * through this shared file (see schema/README.md).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ALLOWED_NODE_TYPES_BY_FAMILY, SUPPORTED_SCHEMA_VERSION, validateScene } from './scene';

const SCHEMA_DIR = path.resolve(__dirname, '../../../schema');
const FIXTURES_DIR = path.join(SCHEMA_DIR, 'fixtures');

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, relativePath), 'utf-8'));
}

const rawExpectations = readJson('expectations.json') as Record<
  string,
  { valid: boolean; rule?: string }
>;
const expectations = Object.fromEntries(
  Object.entries(rawExpectations).filter(([key]) => !key.startsWith('$')),
);

describe('validateScene against shared fixtures', () => {
  for (const [fixturePath, expectation] of Object.entries(expectations)) {
    it(`matches expectation for ${fixturePath}`, () => {
      const data = readJson(fixturePath);

      const result = validateScene(data);

      expect(result.valid).toBe(expectation.valid);
      if (!expectation.valid) {
        expect(result.errors.some((e) => e.rule === expectation.rule)).toBe(true);
      }
    });
  }
});

it('never leaks a stack trace or ajv internals in an error message', () => {
  const data = readJson('invalid/wrong_type.json');

  const result = validateScene(data);

  for (const error of result.errors) {
    expect(error.message).not.toContain('at Object.');
    expect(error.message.toLowerCase()).not.toContain('ajv');
  }
});

it('reports unsupported schema version before other errors', () => {
  const data = readJson('valid/blank.json') as Record<string, unknown>;
  data.schemaVersion = 999;
  delete data.canvas; // would also be a missingRequired error, but version wins

  const result = validateScene(data);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].rule).toBe('unsupportedSchemaVersion');
});

it('treats a missing schema version as unsupported', () => {
  const data = readJson('valid/blank.json') as Record<string, unknown>;
  delete data.schemaVersion;

  const result = validateScene(data);

  expect(result.valid).toBe(false);
  expect(result.errors[0].rule).toBe('unsupportedSchemaVersion');
});

it('keeps SUPPORTED_SCHEMA_VERSION in sync with the fixtures', () => {
  const blank = readJson('valid/blank.json') as { schemaVersion: number };
  expect(blank.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
});

// Task 138 (issue #170): canvas.opacity is optional (absent means "fully
// opaque," per this field's own schema description and
// schema/README.md's additive-field-doesn't-bump-schemaVersion policy),
// but when present must be a number in 0..1 like every other
// unitInterval-typed field. Mirrors tests/test_scene_validation.py's
// TestCanvasOpacity.
describe('canvas.opacity (Task 138, issue #170)', () => {
  function blankSceneWithoutOpacity(): Record<string, unknown> {
    const data = readJson('valid/blank.json') as Record<string, unknown>;
    const canvas = data.canvas as Record<string, unknown>;
    expect(canvas.opacity).toBeUndefined();
    return data;
  }

  it('is valid when absent -- every pre-Task-138 fixture already proves this', () => {
    const data = blankSceneWithoutOpacity();
    const result = validateScene(data);
    expect(result.valid).toBe(true);
  });

  it.each([0, 0.5, 1])('is valid at %s', (value) => {
    const data = blankSceneWithoutOpacity();
    (data.canvas as Record<string, unknown>).opacity = value;
    const result = validateScene(data);
    expect(result.valid).toBe(true);
  });

  it.each([-0.01, 1.01, 2, -1])('is rejected at %s', (value) => {
    const data = blankSceneWithoutOpacity();
    (data.canvas as Record<string, unknown>).opacity = value;
    const result = validateScene(data);
    expect(result.valid).toBe(false);
  });

  it('is rejected with the wrong type', () => {
    const data = blankSceneWithoutOpacity();
    (data.canvas as Record<string, unknown>).opacity = '0.5';
    const result = validateScene(data);
    expect(result.valid).toBe(false);
  });
});

// --- Task 72: NaN/Infinity fixtures excluded from the shared
// expectations.json loop (see its "$maliciousComment") because they're
// written with literal NaN/Infinity/-Infinity tokens -- valid for Python's
// permissive json.loads, but strict JSON that JS's own JSON.parse rejects
// outright. Tested directly here instead of through the generic loop:
// this *is* the browser-side rejection the shared contract promises, it
// just happens at the parse boundary rather than inside validateScene.

describe.each([
  'malicious/nan_opacity.json.txt',
  'malicious/infinity_unbounded_field.json.txt',
  'malicious/negative_infinity_rotation.json.txt',
])('%s', (fixturePath) => {
  it('cannot even be parsed by JSON.parse (NaN/Infinity are not valid JSON)', () => {
    const raw = readFileSync(path.join(FIXTURES_DIR, fixturePath), 'utf-8');
    expect(() => JSON.parse(raw)).toThrow();
  });
});

it('ajv already rejects NaN in a *bounded* numeric field via minimum/maximum', () => {
  // Unlike Python's jsonschema (see tests/test_scene_validation.py's
  // matching test: `nan < minimum`/`nan > maximum` are both False in
  // Python, so NaN silently bypasses bounded fields there), ajv's
  // generated minimum/maximum checks correctly reject NaN. This is why
  // checkNonFiniteNumbers only adds real coverage here for *unbounded*
  // numeric fields (next test) -- documented so the two languages'
  // otherwise-symmetric non-finite-number defenses aren't mistaken for
  // identical mechanisms.
  const blank = readJson('valid/blank.json') as Record<string, unknown>;
  const scene = {
    ...blank,
    shapes: [
      {
        id: 'shape-1',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: Number.NaN },
        style: { fill: '#112233', stroke: null, strokeWidth: 0 },
        radius: 5,
      },
    ],
  };

  const result = validateScene(scene);

  expect(result.valid).toBe(false);
  expect(result.errors.some((e) => e.path === '$.shapes[0].transform.opacity')).toBe(true);
});

it('validateScene rejects a non-finite number in an *unbounded* field even when constructed in memory (not via JSON.parse)', () => {
  // binding.mapping.inMax has no schema minimum/maximum at all, so ajv's
  // own keyword checks have nothing to catch NaN/Infinity with there --
  // this is the case checkNonFiniteNumbers exists for. Constructed in
  // memory (not via JSON.parse, which would throw on a literal NaN/
  // Infinity token before ever reaching validateScene) to prove this
  // check is real defense in depth, not simply unreachable dead code
  // shadowed by JSON.parse's own boundary rejection.
  const blank = readJson('valid/blank.json') as Record<string, unknown>;
  const scene = {
    ...blank,
    shapes: [
      {
        id: 'shape-1',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: '#112233', stroke: null, strokeWidth: 0 },
        radius: 5,
      },
    ],
    bindings: [
      {
        id: 'binding-1',
        signal: 'indexTipX',
        handTarget: 'primary',
        targetScope: 'shape',
        targetId: 'shape-1',
        targetProperty: 'positionX',
        composition: 'replace',
        mapping: { inMin: 0, inMax: Number.POSITIVE_INFINITY, outMin: 0, outMax: 1 },
      },
    ],
  };

  const result = validateScene(scene);

  expect(result.valid).toBe(false);
  expect(result.errors.some((e) => e.rule === 'nonFiniteNumber')).toBe(true);
});

it('forbidden_node_type fixture matches the shared node-types registry', () => {
  const data = readJson('malicious/forbidden_node_type.json') as {
    graph: { nodes: Array<{ family: string; type: string }> };
  };
  const node = data.graph.nodes[0];
  expect(ALLOWED_NODE_TYPES_BY_FAMILY[node.family]).toBeDefined();
  expect(ALLOWED_NODE_TYPES_BY_FAMILY[node.family]).not.toContain(node.type);
});

it('does not enforce output-family node types (forward-looking, unenforced by design)', () => {
  const featureRich = readJson('valid/feature_rich.json') as {
    graph: { nodes: Array<{ family: string }> };
  };
  const outputNodes = featureRich.graph.nodes.filter((n) => n.family === 'output');
  expect(outputNodes.length).toBeGreaterThan(0);
  expect(validateScene(featureRich).valid).toBe(true);
});

it('treats prototype-like param keys as ordinary schema-valid data, not a bypass', () => {
  // __proto__/constructor/prototype as graph node param keys: schema-legal
  // (params accepts any string key with a leaf value) and safe here --
  // JSON.parse and object-spread both use CreateDataProperty semantics
  // (an own-property write), never the Object.prototype.__proto__
  // accessor's setter, so this never actually pollutes anything. See
  // tests/test_scene_validation.py's matching test for the Python side.
  const data = readJson('malicious/prototype_like_keys.json') as {
    graph: { nodes: Array<{ params: Record<string, unknown> }> };
  };
  const result = validateScene(data);
  expect(result.valid).toBe(true);
  expect(data.graph.nodes[0].params.__proto__).toBe('polluted');
  expect(Object.getPrototypeOf({})).not.toHaveProperty('polluted');
});

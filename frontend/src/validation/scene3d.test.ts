/**
 * Validate scene3d.ts against the shared schema/fixtures3d/*.
 *
 * `schema/fixtures3d/expectations3d.json` is the single source of truth
 * for raw-schema-level expectations; `tests/test_scene3d_validation.py`
 * asserts the same validator-level expectations against the Python
 * validator. Neither suite runs the other's validator — they're checked
 * for agreement indirectly, through the shared fixtures (see
 * schema/README3d.md). Mirrors scene.test.ts's pattern for the 2D schema.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_DOCUMENT_TYPE, SUPPORTED_SCHEMA_VERSION, validateScene3D } from './scene3d';

const SCHEMA_DIR = path.resolve(__dirname, '../../../schema');
const FIXTURES_DIR = path.join(SCHEMA_DIR, 'fixtures3d');

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, relativePath), 'utf-8'));
}

const rawExpectations = readJson('expectations3d.json') as Record<
  string,
  { valid: boolean; rule?: string }
>;
const expectations = Object.fromEntries(
  Object.entries(rawExpectations).filter(([key]) => !key.startsWith('$')),
);

// The validator is stricter than the raw schema for these three: they are
// schema-valid (per expectations3d.json) but must be rejected once
// referential-integrity/complexity checks run. Mirrors
// tests/test_scene3d_validation.py's VALIDATOR_ONLY_REJECTIONS.
const VALIDATOR_ONLY_REJECTIONS: Record<string, string> = {
  'malicious/duplicate_ids.json': 'duplicateId',
  'malicious/dangling_group_reference.json': 'danglingReference',
  'malicious/oversized_document.json': 'limitExceeded',
};

describe('validateScene3D against shared fixtures', () => {
  for (const [fixturePath, expectation] of Object.entries(expectations)) {
    it(`matches expectation for ${fixturePath}`, () => {
      const data = readJson(fixturePath);

      const result = validateScene3D(data);

      if (fixturePath in VALIDATOR_ONLY_REJECTIONS) {
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.rule === VALIDATOR_ONLY_REJECTIONS[fixturePath])).toBe(
          true,
        );
        return;
      }

      expect(result.valid).toBe(expectation.valid);
      if (!expectation.valid && expectation.rule) {
        expect(result.errors.some((e) => e.rule === expectation.rule)).toBe(true);
      }
    });
  }
});

describe('validateScene3D edge cases', () => {
  it('rejects a non-object top level', () => {
    const result = validateScene3D('not an object');

    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe('wrongType');
  });

  it('short-circuits on an unsupported schema version', () => {
    const data = readJson('valid/minimal.json') as { schemaVersion: number };
    data.schemaVersion = 99;

    const result = validateScene3D(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe('unsupportedSchemaVersion');
  });

  it('rejects a 2D documentType', () => {
    const data = readJson('valid/minimal.json') as { documentType: string };
    data.documentType = 'scene';

    const result = validateScene3D(data);

    expect(result.valid).toBe(false);
    expect(result.errors[0].rule).toBe('invalidValue');
    expect(result.errors[0].path).toBe('$.documentType');
  });

  it('exposes the expected supported-version/document-type constants', () => {
    expect(SUPPORTED_SCHEMA_VERSION).toBe(1);
    expect(SUPPORTED_DOCUMENT_TYPE).toBe('scene3d');
  });

  it('rejects NaN in a bounded field (caught by ajv min/max, same as scene.ts)', () => {
    const data = readJson('valid/minimal.json') as { camera: { fov: number } };
    data.camera.fov = Number.NaN;

    const result = validateScene3D(data);

    expect(result.valid).toBe(false);
  });
});

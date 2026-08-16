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

import { SUPPORTED_SCHEMA_VERSION, validateScene } from './scene';

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

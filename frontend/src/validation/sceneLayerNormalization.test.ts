/**
 * Task 111 (issue #142): read-time normalization for legacy scenes that
 * predate the one-shape-per-layer invariant. Mirrors
 * `tests/test_scene_validation.py::TestNormalizeSceneLayers` -- see
 * `normalizeSceneLayers`'s own doc comment in `./scene.ts` for the full
 * rationale (why this exists as a caller-invoked step, and why
 * `SceneVersion.scene_json` immutability rules out a database backfill).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeSceneLayers, validateScene } from './scene';

const FIXTURES_DIR = path.resolve(__dirname, '../../../schema/fixtures');

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, relativePath), 'utf-8'));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Scene = any;

function legacyScene(): Scene {
  const data = readJson('invalid/duplicate_layer_assignment.json') as Scene;
  expect(validateScene(data).valid).toBe(false); // confirms the fixture is genuinely legacy
  return data;
}

describe('normalizeSceneLayers', () => {
  it('returns a conforming scene unchanged', () => {
    const data = readJson('valid/blank.json') as Scene;
    const { scene, changed } = normalizeSceneLayers(data);
    expect(changed).toBe(false);
    expect(scene).toBe(data);
  });

  it('gives each conflicting shape its own new layer', () => {
    const data = legacyScene();
    const { scene, changed } = normalizeSceneLayers(data);
    expect(changed).toBe(true);
    const layerIds = scene.shapes.map((s: { layerId: string }) => s.layerId);
    expect(new Set(layerIds).size).toBe(layerIds.length);
  });

  it('normalized scene passes validateScene', () => {
    const data = legacyScene();
    const { scene } = normalizeSceneLayers(data);
    const result = validateScene(scene);
    expect(result.valid).toBe(true);
  });

  it('preserves relative shape order', () => {
    const data = legacyScene();
    const originalIds = data.shapes.map((s: { id: string }) => s.id);
    const { scene } = normalizeSceneLayers(data);
    expect(scene.shapes.map((s: { id: string }) => s.id)).toEqual(originalIds);
  });

  it("synthesized layer carries the original layer's visible/locked state", () => {
    const data = legacyScene();
    data.layers[0].visible = false;
    data.layers[0].locked = true;
    const { scene } = normalizeSceneLayers(data);
    const originalLayerIds = new Set(data.layers.map((l: { id: string }) => l.id));
    const newLayers = scene.layers.filter((l: { id: string }) => !originalLayerIds.has(l.id));
    expect(newLayers).toHaveLength(1);
    expect(newLayers[0].visible).toBe(false);
    expect(newLayers[0].locked).toBe(true);
  });

  it('does not mutate the original document', () => {
    const data = legacyScene();
    const originalShapes = JSON.parse(JSON.stringify(data.shapes));
    const originalLayers = JSON.parse(JSON.stringify(data.layers));
    normalizeSceneLayers(data);
    expect(data.shapes).toEqual(originalShapes);
    expect(data.layers).toEqual(originalLayers);
  });
});

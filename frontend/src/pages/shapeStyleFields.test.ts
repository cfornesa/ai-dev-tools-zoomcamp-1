import { describe, expect, it } from 'vitest';

import type { CircleShape } from './sceneShapes';
import {
  applyColorFieldToShape,
  applyNumericFieldToShape,
  getColorFieldValue,
  getNumericFieldValue,
  NUMERIC_FIELD_SPECS,
  OPACITY_LIMIT,
  parseColorFieldEdit,
  parseNumericFieldEdit,
  SCALE_LIMIT,
  STROKE_WIDTH_LIMIT,
} from './shapeStyleFields';

/**
 * Task 60 (issue #58): pure-logic tests for the shape-styling Inspector
 * fields' validation/clamp/apply helpers, independent of any rendering.
 * See `EditorWorkspace.shapeInspector.test.tsx` for the rendered UI and
 * `useSceneEditor.shapeStyle.test.ts` for the commit/undo wiring.
 */

function circle(overrides: Partial<CircleShape> = {}): CircleShape {
  return {
    id: 'shape-1',
    type: 'circle',
    layerId: 'layer-1',
    groupId: null,
    transform: { x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    style: { fill: '#4f46e5', stroke: '#1e1b4b', strokeWidth: 2 },
    radius: 50,
    ...overrides,
  };
}

const specByField = Object.fromEntries(NUMERIC_FIELD_SPECS.map((s) => [s.field, s]));

describe('shapeStyleFields: numeric getters', () => {
  it('reads every numeric field from a shape', () => {
    const shape = circle();
    expect(getNumericFieldValue(shape, 'positionX')).toBe(10);
    expect(getNumericFieldValue(shape, 'positionY')).toBe(20);
    expect(getNumericFieldValue(shape, 'scaleX')).toBe(1);
    expect(getNumericFieldValue(shape, 'scaleY')).toBe(1);
    expect(getNumericFieldValue(shape, 'rotation')).toBe(0);
    expect(getNumericFieldValue(shape, 'opacity')).toBe(1);
    expect(getNumericFieldValue(shape, 'strokeWidth')).toBe(2);
  });

  it('reads fill/stroke, including null (schema-valid "none")', () => {
    const shape = circle({ style: { fill: null, stroke: null, strokeWidth: 0 } });
    expect(getColorFieldValue(shape, 'fill')).toBeNull();
    expect(getColorFieldValue(shape, 'stroke')).toBeNull();
  });
});

describe('shapeStyleFields: parseNumericFieldEdit — valid/clamp policy', () => {
  it('accepts an in-range value unchanged', () => {
    const outcome = parseNumericFieldEdit(specByField.rotation, '45');
    expect(outcome).toEqual({ ok: true, value: 45 });
  });

  it('clamps a value above the maximum to the maximum (documented policy)', () => {
    const outcome = parseNumericFieldEdit(specByField.opacity, '5');
    expect(outcome).toEqual({ ok: true, value: OPACITY_LIMIT.max });
  });

  it('clamps a value below the minimum to the minimum (documented policy)', () => {
    const outcome = parseNumericFieldEdit(specByField.scaleX, '-3');
    expect(outcome).toEqual({ ok: true, value: SCALE_LIMIT.min });
  });

  it('clamps exactly at the boundary without rejecting it', () => {
    expect(parseNumericFieldEdit(specByField.strokeWidth, String(STROKE_WIDTH_LIMIT.max))).toEqual({
      ok: true,
      value: STROKE_WIDTH_LIMIT.max,
    });
    expect(parseNumericFieldEdit(specByField.strokeWidth, '65')).toEqual({
      ok: true,
      value: STROKE_WIDTH_LIMIT.max,
    });
  });

  it('rejects non-numeric text with a specific, field-named error', () => {
    const outcome = parseNumericFieldEdit(specByField.positionX, 'abc');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain('Position X');
      expect(outcome.error).toContain('finite number');
    }
  });

  it('rejects an empty string rather than silently defaulting', () => {
    const outcome = parseNumericFieldEdit(specByField.rotation, '   ');
    expect(outcome.ok).toBe(false);
  });

  it('rejects Infinity and -Infinity (non-finite) rather than clamping', () => {
    expect(parseNumericFieldEdit(specByField.positionX, 'Infinity').ok).toBe(false);
    expect(parseNumericFieldEdit(specByField.positionX, '-Infinity').ok).toBe(false);
  });

  it('rejects a value that parses to NaN', () => {
    expect(parseNumericFieldEdit(specByField.opacity, 'NaN').ok).toBe(false);
  });
});

describe('shapeStyleFields: parseColorFieldEdit', () => {
  it('accepts an empty string as "none" (null)', () => {
    expect(parseColorFieldEdit('fill', '')).toEqual({ ok: true, value: null });
    expect(parseColorFieldEdit('fill', '   ')).toEqual({ ok: true, value: null });
  });

  it('accepts 3/6/8-digit hex colors', () => {
    expect(parseColorFieldEdit('fill', '#abc')).toEqual({ ok: true, value: '#abc' });
    expect(parseColorFieldEdit('fill', '#4f46e5')).toEqual({ ok: true, value: '#4f46e5' });
    expect(parseColorFieldEdit('stroke', '#4f46e5ff')).toEqual({ ok: true, value: '#4f46e5ff' });
  });

  it('rejects malformed color text with a specific, field-named error', () => {
    const outcome = parseColorFieldEdit('stroke', 'blue');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain('Stroke');
  });

  it('rejects a hex string of the wrong length', () => {
    expect(parseColorFieldEdit('fill', '#4f46e').ok).toBe(false);
  });
});

describe('shapeStyleFields: apply* never changes the shape id', () => {
  it('applyNumericFieldToShape preserves id and every other field', () => {
    const shape = circle();
    const updated = applyNumericFieldToShape(shape, 'rotation', 90);
    expect(updated.id).toBe(shape.id);
    expect(updated.transform.rotation).toBe(90);
    expect(updated.transform.x).toBe(shape.transform.x);
    expect(updated.style).toEqual(shape.style);
  });

  it('applyColorFieldToShape preserves id and the other color channel', () => {
    const shape = circle();
    const updated = applyColorFieldToShape(shape, 'fill', '#000000');
    expect(updated.id).toBe(shape.id);
    expect(updated.style.fill).toBe('#000000');
    expect(updated.style.stroke).toBe(shape.style.stroke);
  });

  it('applyColorFieldToShape can set a channel to null', () => {
    const shape = circle();
    const updated = applyColorFieldToShape(shape, 'stroke', null);
    expect(updated.style.stroke).toBeNull();
  });
});

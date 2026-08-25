import { describe, expect, it } from 'vitest';

import {
  CANVAS_OPACITY_LIMIT,
  getCanvasBackgroundColor,
  getCanvasOpacity,
  parseCanvasBackgroundColorEdit,
  parseCanvasOpacityEdit,
} from './canvasSettingsFields';

describe('canvasSettingsFields', () => {
  describe('getCanvasBackgroundColor', () => {
    it('reads the current value', () => {
      expect(getCanvasBackgroundColor({ canvas: { backgroundColor: '#123456' } })).toBe('#123456');
    });

    it('falls back to white for a missing/malformed value', () => {
      expect(getCanvasBackgroundColor({})).toBe('#ffffff');
      expect(getCanvasBackgroundColor({ canvas: {} })).toBe('#ffffff');
    });
  });

  describe('getCanvasOpacity', () => {
    it('reads the current value', () => {
      expect(getCanvasOpacity({ canvas: { opacity: 0.4 } })).toBe(0.4);
    });

    it('defaults to 1 (fully opaque) when absent -- Task 138/#170 additive-field policy', () => {
      expect(getCanvasOpacity({ canvas: {} })).toBe(1);
      expect(getCanvasOpacity({})).toBe(1);
    });
  });

  describe('parseCanvasBackgroundColorEdit', () => {
    it('accepts well-formed 3/6/8-digit hex colors', () => {
      expect(parseCanvasBackgroundColorEdit('#fff')).toEqual({ ok: true, value: '#fff' });
      expect(parseCanvasBackgroundColorEdit('#4f46e5')).toEqual({ ok: true, value: '#4f46e5' });
      expect(parseCanvasBackgroundColorEdit('#4f46e580')).toEqual({
        ok: true,
        value: '#4f46e580',
      });
    });

    it('rejects an empty value -- unlike a shape fill/stroke, background color is required', () => {
      const outcome = parseCanvasBackgroundColorEdit('');
      expect(outcome.ok).toBe(false);
    });

    it('rejects a malformed value', () => {
      const outcome = parseCanvasBackgroundColorEdit('not-a-color');
      expect(outcome.ok).toBe(false);
    });
  });

  describe('parseCanvasOpacityEdit', () => {
    it('accepts an in-range value', () => {
      expect(parseCanvasOpacityEdit('0.5')).toEqual({ ok: true, value: 0.5 });
    });

    it('clamps an out-of-range value into 0..1', () => {
      expect(parseCanvasOpacityEdit('5')).toEqual({ ok: true, value: CANVAS_OPACITY_LIMIT.max });
      expect(parseCanvasOpacityEdit('-2')).toEqual({ ok: true, value: CANVAS_OPACITY_LIMIT.min });
    });

    it('rejects invalid/non-finite text', () => {
      expect(parseCanvasOpacityEdit('abc').ok).toBe(false);
      expect(parseCanvasOpacityEdit('').ok).toBe(false);
      expect(parseCanvasOpacityEdit('Infinity').ok).toBe(false);
    });
  });
});

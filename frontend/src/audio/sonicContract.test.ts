import { describe, expect, it } from 'vitest';
import { normalizeSceneSonic, normalizeSonic } from './sonicContract';

describe('authored sonic contract', () => {
  it('applies defaults, clamps ranges, and removes unknown keys', () => {
    const value = normalizeSonic({
      tempo: 999,
      scale: 'major',
      unknown: true,
      extras: { default_volume: -2 },
    });
    expect(value?.tempo).toBe(220);
    expect(value?.extras.default_volume).toBe(0);
    expect(value).not.toHaveProperty('unknown');
    expect(value?.keyboard_scale).toBe('major');
  });

  it('drops malformed authored blocks and preserves legacy scenes', () => {
    expect(normalizeSceneSonic({ schemaVersion: 1 })).toEqual({ schemaVersion: 1 });
    expect(normalizeSceneSonic({ schemaVersion: 1, sonic: { root: 'H' } })).toEqual({
      schemaVersion: 1,
    });
  });
});

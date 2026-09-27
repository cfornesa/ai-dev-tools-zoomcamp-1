import { describe, expect, it } from 'vitest';

import { normalizeCapabilities } from './artPieceCapabilities';

describe('local generated capability normalization', () => {
  it('keeps allowlisted booleans, fills missing keys, and drops unknown values', () => {
    const normalized = normalizeCapabilities(
      { sound: true, download: 'yes', unknown: true },
      'svg',
    );

    expect(normalized.sound).toBe(true);
    expect(normalized.download).toBe(false);
    expect((normalized as Record<string, unknown>).unknown).toBeUndefined();
    expect(normalized).toHaveProperty('immersive', false);
  });
});

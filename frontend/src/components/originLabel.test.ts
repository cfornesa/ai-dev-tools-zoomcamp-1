import { describe, expect, it } from 'vitest';

import { originLabel } from './originLabel';

describe('originLabel', () => {
  it('buckets AI-produced origins as "AI"', () => {
    expect(originLabel('ai_create')).toBe('AI');
    expect(originLabel('ai_edit')).toBe('AI');
  });

  it('buckets everything else as "Manual"', () => {
    expect(originLabel('manual')).toBe('Manual');
    expect(originLabel('restore')).toBe('Manual');
    expect(originLabel('fork')).toBe('Manual');
  });

  it('returns null for a missing origin (no current version yet)', () => {
    expect(originLabel(null)).toBeNull();
    expect(originLabel(undefined)).toBeNull();
  });
});

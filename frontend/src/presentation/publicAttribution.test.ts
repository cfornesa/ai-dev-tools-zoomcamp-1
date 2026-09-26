import { describe, expect, it } from 'vitest';

import { formatPublicAttribution } from './publicAttribution';

describe('formatPublicAttribution', () => {
  it('renders the service handle convention exactly once', () => {
    expect(formatPublicAttribution('Christopher', 'cfornesa')).toBe('By Christopher (@cfornesa)');
    expect(formatPublicAttribution('Christopher', '@cfornesa')).toBe('By Christopher (@cfornesa)');
  });

  it('falls back without exposing an empty handle', () => {
    expect(formatPublicAttribution('', null)).toBe('By Public artist');
  });
});

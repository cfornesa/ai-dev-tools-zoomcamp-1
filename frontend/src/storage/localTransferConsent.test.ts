import { beforeEach, describe, expect, it } from 'vitest';

import { hasLocalTransferConsent, recordLocalTransferConsent } from './localTransferConsent';

describe('local transfer consent', () => {
  beforeEach(() => window.localStorage.clear());

  it('is scoped to the local piece version and fails closed before consent', () => {
    expect(hasLocalTransferConsent('owner', 'piece', 'v1')).toBe(false);
    recordLocalTransferConsent('owner', 'piece', 'v1');
    expect(hasLocalTransferConsent('owner', 'piece', 'v1')).toBe(true);
    expect(hasLocalTransferConsent('owner', 'piece', 'v2')).toBe(false);
    expect(hasLocalTransferConsent('other', 'piece', 'v1')).toBe(false);
  });
});

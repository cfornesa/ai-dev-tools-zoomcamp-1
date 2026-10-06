import { beforeEach, describe, expect, it } from 'vitest';

import {
  hasLocalTransferConsent,
  recordLocalTransferConsent,
  rekeyLocalTransferConsentOwner,
} from './localTransferConsent';

describe('local transfer consent', () => {
  beforeEach(() => window.localStorage.clear());

  it('is scoped to the local piece version and fails closed before consent', () => {
    expect(hasLocalTransferConsent('owner', 'piece', 'v1')).toBe(false);
    recordLocalTransferConsent('owner', 'piece', 'v1');
    expect(hasLocalTransferConsent('owner', 'piece', 'v1')).toBe(true);
    expect(hasLocalTransferConsent('owner', 'piece', 'v2')).toBe(false);
    expect(hasLocalTransferConsent('other', 'piece', 'v1')).toBe(false);
  });

  it('copies existing consent to the canonical username without deleting its legacy key', () => {
    recordLocalTransferConsent('old-handle', 'project-1', 'version-1');

    rekeyLocalTransferConsentOwner('old-handle', 'username', 'project-1');

    expect(hasLocalTransferConsent('username', 'project-1', 'version-1')).toBe(true);
    expect(hasLocalTransferConsent('old-handle', 'project-1', 'version-1')).toBe(true);
    rekeyLocalTransferConsentOwner('old-handle', 'username', 'project-1');
    expect(hasLocalTransferConsent('username', 'project-1', 'version-1')).toBe(true);
  });
});

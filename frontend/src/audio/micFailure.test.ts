import { describe, expect, it } from 'vitest';

import { categorizeMicError, isMicSupported, micRecoveryMessageFor } from './micFailure';

describe('categorizeMicError', () => {
  it('categorizes NotAllowedError/SecurityError as permission-denied', () => {
    expect(categorizeMicError(Object.assign(new Error(), { name: 'NotAllowedError' }))).toBe(
      'permission-denied',
    );
    expect(categorizeMicError(Object.assign(new Error(), { name: 'SecurityError' }))).toBe(
      'permission-denied',
    );
  });

  it('categorizes NotFoundError/OverconstrainedError as missing-device', () => {
    expect(categorizeMicError(Object.assign(new Error(), { name: 'NotFoundError' }))).toBe(
      'missing-device',
    );
    expect(categorizeMicError(Object.assign(new Error(), { name: 'OverconstrainedError' }))).toBe(
      'missing-device',
    );
  });

  it('falls back to unknown-failure for an unrecognized error', () => {
    expect(categorizeMicError(Object.assign(new Error(), { name: 'SomethingElse' }))).toBe(
      'unknown-failure',
    );
    expect(categorizeMicError(new Error('plain error, no name'))).toBe('unknown-failure');
  });
});

describe('isMicSupported', () => {
  it('returns a boolean without throwing', () => {
    expect(typeof isMicSupported()).toBe('boolean');
  });
});

describe('micRecoveryMessageFor', () => {
  it('returns a distinct, non-empty message for every category', () => {
    const categories = [
      'insecure-context',
      'unsupported-browser',
      'permission-denied',
      'missing-device',
      'unknown-failure',
    ] as const;
    const messages = categories.map((category) => micRecoveryMessageFor(category));
    expect(new Set(messages).size).toBe(categories.length);
    for (const message of messages) expect(message.length).toBeGreaterThan(0);
  });
});

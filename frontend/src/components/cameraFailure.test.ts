import { describe, expect, it } from 'vitest';

import { categorizeProviderError, recoveryMessageFor } from './cameraFailure';
import type { TrackingProviderError } from '../tracking/types';

function error(message: string, cause?: unknown): TrackingProviderError {
  return { message, timestamp: 0, cause };
}

describe('categorizeProviderError', () => {
  it('categorizes the unsupported-browser message mediapipeProvider.ts emits', () => {
    expect(
      categorizeProviderError(error('MediaPipe hand tracking is not supported in this browser.')),
    ).toBe('unsupported-browser');
  });

  it('categorizes a getUserMedia rejection with a NotAllowedError cause as permission-denied', () => {
    const cause = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    expect(
      categorizeProviderError(error('Camera access was denied or no camera is available.', cause)),
    ).toBe('permission-denied');
  });

  it('categorizes a getUserMedia rejection with a SecurityError cause as permission-denied', () => {
    const cause = Object.assign(new Error('blocked'), { name: 'SecurityError' });
    expect(
      categorizeProviderError(error('Camera access was denied or no camera is available.', cause)),
    ).toBe('permission-denied');
  });

  it('categorizes a getUserMedia rejection with a NotFoundError cause as missing-device', () => {
    const cause = Object.assign(new Error('no camera'), { name: 'NotFoundError' });
    expect(
      categorizeProviderError(error('Camera access was denied or no camera is available.', cause)),
    ).toBe('missing-device');
  });

  it('categorizes a getUserMedia rejection with an OverconstrainedError cause as missing-device', () => {
    const cause = Object.assign(new Error('no match'), { name: 'OverconstrainedError' });
    expect(
      categorizeProviderError(error('Camera access was denied or no camera is available.', cause)),
    ).toBe('missing-device');
  });

  it('falls back to permission-denied for a getUserMedia rejection with an unrecognized cause', () => {
    expect(
      categorizeProviderError(
        error('Camera access was denied or no camera is available.', new Error('unknown')),
      ),
    ).toBe('permission-denied');
  });

  it('categorizes a Tasks Vision module load failure as model-failure', () => {
    expect(
      categorizeProviderError(error('Failed to load the MediaPipe Tasks Vision module.')),
    ).toBe('model-failure');
  });

  it('categorizes a gesture recognizer model load failure as model-failure', () => {
    expect(categorizeProviderError(error('Failed to load the gesture recognizer model.'))).toBe(
      'model-failure',
    );
  });

  it('categorizes a per-frame inference failure as tracking-failure', () => {
    expect(categorizeProviderError(error('Gesture recognizer inference failed.'))).toBe(
      'tracking-failure',
    );
  });

  it('categorizes a video playback failure as tracking-failure', () => {
    expect(categorizeProviderError(error('Unable to start camera video playback.'))).toBe(
      'tracking-failure',
    );
  });

  it('categorizes an unrecognized message as unknown-failure', () => {
    expect(categorizeProviderError(error('Something totally unexpected happened.'))).toBe(
      'unknown-failure',
    );
  });
});

describe('recoveryMessageFor', () => {
  it('gives every category its own distinct, non-empty recovery message', () => {
    const categories = [
      'insecure-context',
      'unsupported-browser',
      'permission-denied',
      'missing-device',
      'model-failure',
      'tracking-failure',
      'unknown-failure',
    ] as const;
    const messages = categories.map((category) => recoveryMessageFor(category));
    for (const message of messages) expect(message.length).toBeGreaterThan(0);
    expect(new Set(messages).size).toBe(categories.length);
  });
});

/**
 * Shared fixtures for `frontend/src/tracking/*.test.ts`, following the
 * pattern of `frontend/src/render/testSceneFixtures.ts`.
 */
import { HAND_LANDMARK_COUNT, type Hand, type Landmark } from './types';

/** `HAND_LANDMARK_COUNT` (21) landmarks, all at the same point unless
 * `offset` is given (nudges every coordinate by `offset`, so two hands'
 * landmark sets can be told apart in assertions). */
export function landmarks(offset = 0): Landmark[] {
  return Array.from({ length: HAND_LANDMARK_COUNT }, (_, i) => ({
    x: 0.1 + i * 0.01 + offset,
    y: 0.2 + i * 0.01 + offset,
    z: offset,
  }));
}

export function hand(overrides: Partial<Hand> = {}): Hand {
  return {
    id: 'hand-1',
    handedness: 'right',
    landmarks: landmarks(),
    confidence: 0.9,
    ...overrides,
  };
}

import { describe, expect, it } from 'vitest';

import { sanitizeFrame } from './sanitizeFrame';
import { HAND_LANDMARK_COUNT, MAX_HANDS_PER_FRAME, type TrackingFrame } from './types';
import { hand, landmarks } from './testFixtures';

function frameWith(hands: TrackingFrame['hands']): TrackingFrame {
  return { timestamp: 1, hands, events: [] };
}

describe('constants', () => {
  it('caps a frame at two hands', () => {
    expect(MAX_HANDS_PER_FRAME).toBe(2);
  });

  it('uses the MediaPipe 21-point hand landmark count', () => {
    expect(HAND_LANDMARK_COUNT).toBe(21);
  });
});

describe('sanitizeFrame', () => {
  it('passes through a well-formed frame unchanged', () => {
    const input = frameWith([hand()]);
    expect(sanitizeFrame(input)).toEqual(input);
  });

  it('clamps an out-of-range confidence into [0, 1] rather than dropping the hand', () => {
    const tooHigh = sanitizeFrame(frameWith([hand({ confidence: 1.5 })]));
    expect(tooHigh.hands).toHaveLength(1);
    expect(tooHigh.hands[0].confidence).toBe(1);

    const tooLow = sanitizeFrame(frameWith([hand({ confidence: -0.3 })]));
    expect(tooLow.hands).toHaveLength(1);
    expect(tooLow.hands[0].confidence).toBe(0);
  });

  it('drops a hand with a non-finite confidence', () => {
    const result = sanitizeFrame(frameWith([hand({ confidence: NaN })]));
    expect(result.hands).toEqual([]);
  });

  it('drops a hand with a non-finite landmark coordinate', () => {
    const badLandmarks = landmarks();
    badLandmarks[5] = { ...badLandmarks[5], x: Infinity };
    const result = sanitizeFrame(frameWith([hand({ landmarks: badLandmarks })]));
    expect(result.hands).toEqual([]);
  });

  it('drops a hand with an unrecognized handedness value', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = sanitizeFrame(frameWith([hand({ handedness: 'both' as any })]));
    expect(result.hands).toEqual([]);
  });

  it('drops a hand whose landmark count is not exactly HAND_LANDMARK_COUNT', () => {
    const result = sanitizeFrame(frameWith([hand({ landmarks: landmarks().slice(0, 20) })]));
    expect(result.hands).toEqual([]);
  });

  it('drops the lowest-confidence extra hands beyond MAX_HANDS_PER_FRAME', () => {
    const low = hand({ id: 'low', confidence: 0.2 });
    const mid = hand({ id: 'mid', confidence: 0.5 });
    const high = hand({ id: 'high', confidence: 0.9 });
    const result = sanitizeFrame(frameWith([low, high, mid]));
    expect(result.hands.map((h) => h.id)).toEqual(['high', 'mid']);
  });

  it('leaves a good hand alone even when a different hand in the same frame is malformed', () => {
    const good = hand({ id: 'good' });
    const bad = hand({ id: 'bad', confidence: NaN });
    const result = sanitizeFrame(frameWith([good, bad]));
    expect(result.hands.map((h) => h.id)).toEqual(['good']);
  });

  it('passes timestamp and events through unchanged', () => {
    const input: TrackingFrame = {
      timestamp: 42,
      hands: [],
      events: [{ type: 'handAppear', handId: 'hand-1', timestamp: 42 }],
    };
    const result = sanitizeFrame(input);
    expect(result.timestamp).toBe(42);
    expect(result.events).toEqual(input.events);
  });
});

import { describe, expect, it } from 'vitest';

import {
  classifyGestureFromLandmarks,
  createHandSignalExtractor,
  DEFAULT_HAND_SIGNAL_OPTIONS,
} from './handSignals';
import type { HandSignalExtractor } from './handSignals';
import { hand, landmarks } from './testFixtures';
import type { GestureEvent, Landmark, TrackingFrame } from './types';

type ProcessFrameResult = ReturnType<HandSignalExtractor['processFrame']>;

const WRIST: Landmark = { x: 0.5, y: 0.5, z: 0 };

function radial(distance: number, angle: number): Landmark {
  return { x: WRIST.x + Math.cos(angle) * distance, y: WRIST.y + Math.sin(angle) * distance, z: 0 };
}

type FingerFlags = {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
};

/** Builds a 21-landmark hand whose fingers are geometrically extended or
 * curled per `flags`, exercising `classifyGestureFromLandmarks`'s
 * distance-from-wrist heuristic directly (see that function's doc
 * comment in `handSignals.ts`). Landmark indices follow MediaPipe's
 * standard 21-point hand model. */
function gestureLandmarks(flags: FingerFlags): Landmark[] {
  const arr: Landmark[] = new Array(21);
  arr[0] = WRIST;

  const finger = (
    angle: number,
    mcpIdx: number,
    pipIdx: number,
    dipIdx: number,
    tipIdx: number,
    extended: boolean,
    tipDistExtended: number,
  ): void => {
    arr[mcpIdx] = radial(0.05, angle);
    arr[pipIdx] = radial(0.09, angle);
    arr[dipIdx] = radial(0.09, angle);
    arr[tipIdx] = radial(extended ? tipDistExtended : 0.02, angle);
  };

  // Thumb: CMC(1)/MCP(2)/IP(3)/TIP(4), pointing left (away from the other
  // fingers, which point up) so it doesn't overlap them.
  finger(Math.PI, 1, 2, 3, 4, flags.thumb, 0.18);
  finger(-Math.PI / 2 + 0.3, 5, 6, 7, 8, flags.index, 0.15);
  finger(-Math.PI / 2, 9, 10, 11, 12, flags.middle, 0.16);
  finger(-Math.PI / 2 - 0.3, 13, 14, 15, 16, flags.ring, 0.15);
  finger(-Math.PI / 2 - 0.6, 17, 18, 19, 20, flags.pinky, 0.14);

  return arr;
}

function frame(overrides: Partial<TrackingFrame> = {}): TrackingFrame {
  return { timestamp: 0, hands: [], events: [], ...overrides };
}

describe('classifyGestureFromLandmarks', () => {
  it('recognizes open palm (all five fingers extended)', () => {
    const l = gestureLandmarks({ thumb: true, index: true, middle: true, ring: true, pinky: true });
    expect(classifyGestureFromLandmarks(l)).toBe('openPalm');
  });

  it('recognizes closed fist (no fingers extended)', () => {
    const l = gestureLandmarks({
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    });
    expect(classifyGestureFromLandmarks(l)).toBe('closedFist');
  });

  it('recognizes pointing up (only index extended)', () => {
    const l = gestureLandmarks({
      thumb: false,
      index: true,
      middle: false,
      ring: false,
      pinky: false,
    });
    expect(classifyGestureFromLandmarks(l)).toBe('pointingUp');
  });

  it('recognizes victory (index and middle extended)', () => {
    const l = gestureLandmarks({
      thumb: false,
      index: true,
      middle: true,
      ring: false,
      pinky: false,
    });
    expect(classifyGestureFromLandmarks(l)).toBe('victory');
  });

  it('recognizes thumbs up (only thumb extended)', () => {
    const l = gestureLandmarks({
      thumb: true,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    });
    expect(classifyGestureFromLandmarks(l)).toBe('thumbsUp');
  });
});

describe('createHandSignalExtractor: continuous signals and smoothing', () => {
  it('exposes indexTip/palm/depth/confidence/presence in their documented ranges while a hand is present', () => {
    const extractor = createHandSignalExtractor();
    const { signals } = extractor.processFrame(
      frame({ timestamp: 0, hands: [hand({ confidence: 0.9 })] }),
    );

    expect(signals.handPresence).toBe(true);
    expect(signals.indexTipX).not.toBeNull();
    expect(signals.indexTipY).not.toBeNull();
    expect(signals.palmX).not.toBeNull();
    expect(signals.palmY).not.toBeNull();
    expect(signals.handDepth).not.toBeNull();
    for (const v of [signals.indexTipX, signals.indexTipY, signals.palmX, signals.palmY]) {
      expect(v as number).toBeGreaterThanOrEqual(0);
      expect(v as number).toBeLessThanOrEqual(1);
    }
    expect(signals.handDepth as number).toBeGreaterThanOrEqual(-1);
    expect(signals.handDepth as number).toBeLessThanOrEqual(1);
    expect(signals.gestureConfidence).toBeGreaterThanOrEqual(0);
    expect(signals.gestureConfidence).toBeLessThanOrEqual(1);
    expect(signals.pinchStrength).not.toBeNull();
    expect(signals.pinchDistance).not.toBeNull();
    expect(signals.handSpeed).toBeGreaterThanOrEqual(0);
    expect(signals.handSpeed).toBeLessThanOrEqual(1);
  });

  it('smooths noisy index-tip input: the smoothed signal swings far less than the raw jitter amplitude', () => {
    const extractor = createHandSignalExtractor();
    const smoothedXs: number[] = [];
    // Raw input alternates hard between 0.2 and 0.8 every frame (0.6
    // swing). A real signal wouldn't teleport like this; smoothing
    // should keep the exposed value from tracking it 1:1.
    for (let i = 0; i < 20; i += 1) {
      const x = i % 2 === 0 ? 0.2 : 0.8;
      const l = landmarks();
      l[8] = { x, y: 0.5, z: 0 };
      l[4] = { x: 0.5, y: 0.9, z: 0 }; // keep thumb far from index: no pinch noise
      const { signals } = extractor.processFrame(
        frame({ timestamp: i * 33, hands: [hand({ landmarks: l })] }),
      );
      smoothedXs.push(signals.indexTipX as number);
    }
    const settledSwing = Math.max(...smoothedXs.slice(-6)) - Math.min(...smoothedXs.slice(-6));
    expect(settledSwing).toBeLessThan(0.6 * 0.6); // well under the raw 0.6 swing
  });

  it('does not hold stale continuous values after the hand is lost, and reports presence-exit exactly once', () => {
    const extractor = createHandSignalExtractor();
    extractor.processFrame(frame({ timestamp: 0, hands: [hand()] }));

    const lostFrame1 = extractor.processFrame(frame({ timestamp: 33, hands: [] }));
    const lostFrame2 = extractor.processFrame(frame({ timestamp: 66, hands: [] }));
    const lostFrame3 = extractor.processFrame(frame({ timestamp: 99, hands: [] }));

    for (const result of [lostFrame1, lostFrame2, lostFrame3]) {
      expect(result.signals.handPresence).toBe(false);
      expect(result.signals.indexTipX).toBeNull();
      expect(result.signals.indexTipY).toBeNull();
      expect(result.signals.palmX).toBeNull();
      expect(result.signals.handDepth).toBeNull();
      expect(result.signals.pinchStrength).toBeNull();
      expect(result.signals.handSpeed).toBe(0);
      expect(result.signals.gestureConfidence).toBe(0);
    }

    const disappearEvents = [lostFrame1, lostFrame2, lostFrame3]
      .flatMap((r) => r.events)
      .filter(
        (e): e is Extract<GestureEvent, { type: 'handDisappear' }> => e.type === 'handDisappear',
      );
    expect(disappearEvents).toHaveLength(1);
    expect(disappearEvents[0].timestamp).toBe(33);
  });

  it('reports presence-enter exactly once on reappearance, seeded at the raw value (no stale blend)', () => {
    const extractor = createHandSignalExtractor();

    const first = extractor.processFrame(
      frame({ timestamp: 0, hands: [hand({ id: 'hand-1', landmarks: landmarks(0) })] }),
    );
    expect(first.events.filter((e) => e.type === 'handAppear')).toHaveLength(1);

    extractor.processFrame(frame({ timestamp: 33, hands: [] }));
    extractor.processFrame(frame({ timestamp: 66, hands: [] }));

    // Reappears with a *different* hand id (Task 27's rule: a retired id
    // is never reused) and a landmark set far from where it left off.
    const reappearLandmarks = landmarks(0);
    reappearLandmarks[8] = { x: 0.9, y: 0.9, z: 0 };
    const reappeared = extractor.processFrame(
      frame({ timestamp: 99, hands: [hand({ id: 'hand-2', landmarks: reappearLandmarks })] }),
    );

    const appearEvents = reappeared.events.filter((e) => e.type === 'handAppear');
    expect(appearEvents).toHaveLength(1);
    expect(reappeared.signals.handPresence).toBe(true);
    // Seeded straight from the raw value, not blended toward the old
    // (now cleared) smoothed position.
    expect(reappeared.signals.indexTipX).toBeCloseTo(0.9, 5);
    expect(reappeared.signals.indexTipY).toBeCloseTo(0.9, 5);

    const nextFrame = extractor.processFrame(
      frame({ timestamp: 132, hands: [hand({ id: 'hand-2', landmarks: reappearLandmarks })] }),
    );
    // Only one handAppear total across the whole reappearance sequence.
    expect(nextFrame.events.filter((e) => e.type === 'handAppear')).toHaveLength(0);
  });
});

describe('createHandSignalExtractor: pinch events', () => {
  function landmarksWithPinchDistance(distance: number): Landmark[] {
    const l = landmarks();
    l[4] = { x: 0.5, y: 0.5, z: 0 }; // thumb tip
    l[8] = { x: 0.5 + distance, y: 0.5, z: 0 }; // index tip
    return l;
  }

  it('fires pinchStart exactly once when engaging, and pinchEnd exactly once when releasing', () => {
    const extractor = createHandSignalExtractor();
    const allEvents: GestureEvent[] = [];

    // Ramp thumb/index together (pinchStrength -> 1) for several frames:
    // EMA needs a few frames to cross the engage threshold.
    for (let i = 0; i < 8; i += 1) {
      const { events } = extractor.processFrame(
        frame({
          timestamp: i * 33,
          hands: [hand({ landmarks: landmarksWithPinchDistance(0) })],
        }),
      );
      allEvents.push(...events);
    }
    const startsSoFar = allEvents.filter((e) => e.type === 'pinchStart');
    expect(startsSoFar).toHaveLength(1);

    // Hold the pinch: must not refire pinchStart.
    for (let i = 8; i < 12; i += 1) {
      const { events } = extractor.processFrame(
        frame({
          timestamp: i * 33,
          hands: [hand({ landmarks: landmarksWithPinchDistance(0) })],
        }),
      );
      allEvents.push(...events);
    }
    expect(allEvents.filter((e) => e.type === 'pinchStart')).toHaveLength(1);
    expect(allEvents.filter((e) => e.type === 'pinchEnd')).toHaveLength(0);

    // Ramp thumb/index apart (pinchStrength -> 0) for several frames.
    for (let i = 12; i < 24; i += 1) {
      const { events } = extractor.processFrame(
        frame({
          timestamp: i * 33,
          hands: [
            hand({
              landmarks: landmarksWithPinchDistance(DEFAULT_HAND_SIGNAL_OPTIONS.maxPinchDistance),
            }),
          ],
        }),
      );
      allEvents.push(...events);
    }

    expect(allEvents.filter((e) => e.type === 'pinchStart')).toHaveLength(1);
    expect(allEvents.filter((e) => e.type === 'pinchEnd')).toHaveLength(1);
  });
});

/** `hand()`'s default landmarks (from `testFixtures.ts`) place the thumb
 * and index tips close enough together to read as an immediate pinch on
 * the very first frame, which would add unrelated `pinchStart`/`pinchEnd`
 * events to gesture-only test assertions below. This spreads them apart
 * so gesture tests exercise gesture events in isolation. */
function handWithNoPinch(overrides: Parameters<typeof hand>[0] = {}): ReturnType<typeof hand> {
  const l = landmarks();
  l[4] = { x: 0.1, y: 0.9, z: 0 };
  l[8] = { x: 0.9, y: 0.1, z: 0 };
  return hand({ landmarks: l, ...overrides });
}

describe('createHandSignalExtractor: gesture events', () => {
  it('prefers provider-supplied gesture events, firing gestureEnter/gestureExit exactly once per transition (both directions)', () => {
    const extractor = createHandSignalExtractor();
    const handId = 'hand-1';

    const enter = extractor.processFrame(
      frame({
        timestamp: 0,
        hands: [handWithNoPinch({ id: handId })],
        events: [{ type: 'gestureEnter', handId, gesture: 'openPalm', timestamp: 0 }],
      }),
    );
    expect(enter.events).toEqual([
      { type: 'handAppear', handId, timestamp: 0 },
      { type: 'gestureEnter', handId, gesture: 'openPalm', timestamp: 0 },
    ]);
    expect(enter.signals.gestureState).toBe('openPalm');

    // Steady state: no new gesture event, must not refire enter.
    const steady = extractor.processFrame(
      frame({ timestamp: 33, hands: [handWithNoPinch({ id: handId })] }),
    );
    expect(
      steady.events.filter((e) => e.type === 'gestureEnter' || e.type === 'gestureExit'),
    ).toHaveLength(0);
    expect(steady.signals.gestureState).toBe('openPalm');

    // A redundant re-enter of the same gesture (a hypothetical noisy
    // provider) must also not refire.
    const redundant = extractor.processFrame(
      frame({
        timestamp: 66,
        hands: [handWithNoPinch({ id: handId })],
        events: [{ type: 'gestureEnter', handId, gesture: 'openPalm', timestamp: 66 }],
      }),
    );
    expect(redundant.events).toHaveLength(0);

    const exit = extractor.processFrame(
      frame({
        timestamp: 99,
        hands: [handWithNoPinch({ id: handId })],
        events: [{ type: 'gestureExit', handId, gesture: 'openPalm', timestamp: 99 }],
      }),
    );
    expect(exit.events).toEqual([
      { type: 'gestureExit', handId, gesture: 'openPalm', timestamp: 99 },
    ]);
    expect(exit.signals.gestureState).toBe('none');
  });

  it('falls back to landmark-derived classification when a hand never carries a provider gesture event', () => {
    const extractor = createHandSignalExtractor();
    const openPalm = gestureLandmarks({
      thumb: true,
      index: true,
      middle: true,
      ring: true,
      pinky: true,
    });
    const closedFist = gestureLandmarks({
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
    });

    const first = extractor.processFrame(
      frame({ timestamp: 0, hands: [hand({ landmarks: openPalm })] }),
    );
    expect(first.signals.gestureState).toBe('openPalm');
    expect(first.events.filter((e) => e.type === 'gestureEnter')).toHaveLength(1);

    const second = extractor.processFrame(
      frame({ timestamp: 33, hands: [hand({ landmarks: closedFist })] }),
    );
    expect(second.signals.gestureState).toBe('closedFist');
    expect(second.events.filter((e) => e.type === 'gestureExit')).toHaveLength(1);
    expect(second.events.filter((e) => e.type === 'gestureEnter')).toHaveLength(1);
  });

  it('exits the active gesture when the hand disappears', () => {
    const extractor = createHandSignalExtractor();
    const handId = 'hand-1';
    extractor.processFrame(
      frame({
        timestamp: 0,
        hands: [handWithNoPinch({ id: handId })],
        events: [{ type: 'gestureEnter', handId, gesture: 'victory', timestamp: 0 }],
      }),
    );
    const lost = extractor.processFrame(frame({ timestamp: 33, hands: [] }));
    expect(lost.events).toEqual([
      { type: 'gestureExit', handId, gesture: 'victory', timestamp: 33 },
      { type: 'handDisappear', handId, timestamp: 33 },
    ]);
    expect(lost.signals.gestureState).toBe('none');
  });
});

describe('createHandSignalExtractor: fallback policy for low confidence / malformed frames', () => {
  it('treats a low-confidence hand as absent without throwing, and fires presence-exit once', () => {
    const extractor = createHandSignalExtractor();
    extractor.processFrame(frame({ timestamp: 0, hands: [hand({ confidence: 0.9 })] }));

    let result: ProcessFrameResult | undefined;
    expect(() => {
      result = extractor.processFrame(frame({ timestamp: 33, hands: [hand({ confidence: 0.1 })] }));
    }).not.toThrow();

    expect(result!.signals.handPresence).toBe(false);
    expect(result!.events.filter((e) => e.type === 'handDisappear')).toHaveLength(1);
  });

  it('drops a structurally malformed hand (wrong landmark count) without throwing', () => {
    const extractor = createHandSignalExtractor();
    const malformed = hand({ landmarks: landmarks().slice(0, 5) });
    let result: ProcessFrameResult | undefined;
    expect(() => {
      result = extractor.processFrame(frame({ timestamp: 0, hands: [malformed] }));
    }).not.toThrow();
    expect(result!.signals.handPresence).toBe(false);
  });

  it('drops a hand with a non-finite landmark coordinate without throwing', () => {
    const extractor = createHandSignalExtractor();
    const l = landmarks();
    l[8] = { x: Number.NaN, y: 0.5, z: 0 };
    let result: ProcessFrameResult | undefined;
    expect(() => {
      result = extractor.processFrame(frame({ timestamp: 0, hands: [hand({ landmarks: l })] }));
    }).not.toThrow();
    expect(result!.signals.handPresence).toBe(false);
  });

  it('never throws on a value that does not even look like a TrackingFrame', () => {
    const extractor = createHandSignalExtractor();
    const garbage = { not: 'a frame' } as unknown as TrackingFrame;
    let result: ProcessFrameResult | undefined;
    expect(() => {
      result = extractor.processFrame(garbage);
    }).not.toThrow();
    expect(result!.signals.handPresence).toBe(false);

    let result2: ProcessFrameResult | undefined;
    expect(() => {
      result2 = extractor.processFrame(null as unknown as TrackingFrame);
    }).not.toThrow();
    expect(result2!.signals.handPresence).toBe(false);
  });
});

describe('createHandSignalExtractor: reset', () => {
  it('reset() clears tracked state without emitting any event', () => {
    const extractor = createHandSignalExtractor();
    extractor.processFrame(frame({ timestamp: 0, hands: [hand({ id: 'hand-1' })] }));
    extractor.reset();

    // After reset, a hand with a previously-seen id is treated as a
    // brand-new presence segment (fresh handAppear, fresh EMA seed).
    const result = extractor.processFrame(
      frame({ timestamp: 33, hands: [hand({ id: 'hand-1' })] }),
    );
    expect(result.events.filter((e) => e.type === 'handAppear')).toHaveLength(1);
  });
});

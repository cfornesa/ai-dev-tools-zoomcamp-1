import { describe, expect, it } from 'vitest';

import {
  createTwoHandSignalExtractor,
  DEFAULT_TWO_HAND_SIGNAL_OPTIONS,
  type TwoHandSignalExtractor,
} from './twoHandSignals';
import type { Hand, Landmark, TrackingFrame } from './types';
import { HAND_LANDMARK_COUNT } from './types';

type ProcessFrameResult = ReturnType<TwoHandSignalExtractor['processFrame']>;

/** A 21-landmark hand whose every landmark sits at `(x, y, 0)` — makes the
 * palm-center average (this module's distance basis) land exactly on
 * `(x, y)`, so tests can dial in an exact palm-to-palm distance instead of
 * reverse-engineering the MCP/wrist average. */
function landmarksAt(x: number, y: number): Landmark[] {
  return Array.from({ length: HAND_LANDMARK_COUNT }, () => ({ x, y, z: 0 }));
}

function handAt(
  id: string,
  handedness: 'left' | 'right',
  x: number,
  y = 0.5,
  overrides: Partial<Hand> = {},
): Hand {
  return { id, handedness, landmarks: landmarksAt(x, y), confidence: 0.9, ...overrides };
}

function frame(overrides: Partial<TrackingFrame> = {}): TrackingFrame {
  return { timestamp: 0, hands: [], events: [], ...overrides };
}

/** Builds a frame with a left hand and a right hand `distance` apart
 * (same y, so distance = |leftX - rightX| with the default
 * `maxHandDistance` of `1.0`), at `timestamp`. */
function twoHandFrame(
  timestamp: number,
  distance: number,
  opts: { leftId?: string; rightId?: string; centeredAt?: number } = {},
): TrackingFrame {
  const center = opts.centeredAt ?? 0.5;
  const leftX = center - distance / 2;
  const rightX = center + distance / 2;
  return frame({
    timestamp,
    hands: [
      handAt(opts.rightId ?? 'r', 'right', rightX),
      handAt(opts.leftId ?? 'l', 'left', leftX),
    ],
  });
}

const HOLD = DEFAULT_TWO_HAND_SIGNAL_OPTIONS.holdTimeMs;
const CLOSE_ENTER = DEFAULT_TWO_HAND_SIGNAL_OPTIONS.closeEnterThreshold;
const CLOSE_RELEASE = DEFAULT_TWO_HAND_SIGNAL_OPTIONS.closeReleaseThreshold;
const FAR_ENTER = DEFAULT_TWO_HAND_SIGNAL_OPTIONS.farEnterThreshold;
const FAR_RELEASE = DEFAULT_TWO_HAND_SIGNAL_OPTIONS.farReleaseThreshold;

describe('createTwoHandSignalExtractor', () => {
  describe('distance and left/right assignment', () => {
    it('computes normalized palm-to-palm distance regardless of hands[] order', () => {
      const extractor = createTwoHandSignalExtractor();
      const result = extractor.processFrame(twoHandFrame(0, 0.4));
      expect(result.signals.twoHandPresence).toBe(true);
      expect(result.signals.handDistance).toBeCloseTo(0.4, 5);
    });

    it('assigns roles from handedness, not array position', () => {
      const extractor = createTwoHandSignalExtractor();
      // Right hand listed first, left hand second — distance must still
      // be computed correctly (order-independent by construction, but
      // this pins the contract explicitly).
      const f = frame({
        timestamp: 0,
        hands: [handAt('a', 'right', 0.9), handAt('b', 'left', 0.1)],
      });
      const result = extractor.processFrame(f);
      expect(result.signals.handDistance).toBeCloseTo(0.8, 5);
    });

    it('reports no presence and null distance with only one hand', () => {
      const extractor = createTwoHandSignalExtractor();
      const result = extractor.processFrame(frame({ hands: [handAt('l', 'left', 0.3)] }));
      expect(result.signals.twoHandPresence).toBe(false);
      expect(result.signals.handDistance).toBeNull();
      expect(result.signals.twoHandState).toBe('neutral');
      expect(result.events).toEqual([]);
    });

    it('reports no presence with zero hands', () => {
      const extractor = createTwoHandSignalExtractor();
      const result = extractor.processFrame(frame());
      expect(result.signals.twoHandPresence).toBe(false);
      expect(result.signals.handDistance).toBeNull();
    });

    it('drops duplicated handedness, keeping only the higher-confidence hand of that side', () => {
      const extractor = createTwoHandSignalExtractor();
      const f = frame({
        hands: [
          handAt('a', 'left', 0.2, 0.5, { confidence: 0.6 }),
          handAt('b', 'left', 0.8, 0.5, { confidence: 0.95 }),
        ],
      });
      const result = extractor.processFrame(f);
      // No right hand at all -> no two-hand presence regardless of which
      // 'left' won.
      expect(result.signals.twoHandPresence).toBe(false);
    });

    it('treats sub-confidence-threshold hands as absent', () => {
      const extractor = createTwoHandSignalExtractor();
      const f = frame({
        hands: [
          handAt('l', 'left', 0.3, 0.5, { confidence: 0.1 }),
          handAt('r', 'right', 0.7, 0.5, { confidence: 0.9 }),
        ],
      });
      const result = extractor.processFrame(f);
      expect(result.signals.twoHandPresence).toBe(false);
    });
  });

  describe('threshold equality', () => {
    it('qualifies close when smoothed distance equals closeEnterThreshold exactly, after hold time', () => {
      const extractor = createTwoHandSignalExtractor();
      let result: ProcessFrameResult | undefined;
      // Same distance every frame so EMA smoothing converges immediately
      // to exactly the threshold value; step timestamps past holdTimeMs.
      for (let t = 0; t <= HOLD + 10; t += 10) {
        result = extractor.processFrame(twoHandFrame(t, CLOSE_ENTER));
      }
      expect(result!.signals.twoHandState).toBe('close');
    });

    it('qualifies far when smoothed distance equals farEnterThreshold exactly, after hold time', () => {
      const extractor = createTwoHandSignalExtractor();
      let result: ProcessFrameResult | undefined;
      for (let t = 0; t <= HOLD + 10; t += 10) {
        result = extractor.processFrame(twoHandFrame(t, FAR_ENTER));
      }
      expect(result!.signals.twoHandState).toBe('far');
    });

    it('does not qualify close at a distance just above closeEnterThreshold', () => {
      const extractor = createTwoHandSignalExtractor();
      let result: ProcessFrameResult | undefined;
      for (let t = 0; t <= HOLD + 10; t += 10) {
        result = extractor.processFrame(twoHandFrame(t, CLOSE_ENTER + 0.001));
      }
      expect(result!.signals.twoHandState).toBe('neutral');
    });
  });

  describe('hold-time gating', () => {
    it('does not fire a transition that reverts before hold time elapses', () => {
      const extractor = createTwoHandSignalExtractor();
      const allEvents: unknown[] = [];
      // Establish neutral baseline first.
      extractor.processFrame(twoHandFrame(0, 0.4));
      // Dip into close territory for less than holdTimeMs, then bounce
      // back out to neutral before it qualifies.
      let r = extractor.processFrame(twoHandFrame(10, CLOSE_ENTER));
      allEvents.push(...r.events);
      r = extractor.processFrame(twoHandFrame(10 + HOLD / 2, CLOSE_ENTER));
      allEvents.push(...r.events);
      // Revert to neutral before HOLD has elapsed since the dip started.
      r = extractor.processFrame(twoHandFrame(10 + HOLD - 5, 0.4));
      allEvents.push(...r.events);
      expect(allEvents).toEqual([]);
      expect(r.signals.twoHandState).toBe('neutral');
    });

    it('fires handsBecameClose exactly once once hold time is satisfied', () => {
      const extractor = createTwoHandSignalExtractor();
      const allEvents: unknown[] = [];
      let r: ProcessFrameResult | undefined;
      for (let t = 0; t <= HOLD + 50; t += 10) {
        r = extractor.processFrame(twoHandFrame(t, 0.05));
        allEvents.push(...r.events);
      }
      expect(allEvents).toEqual([{ type: 'handsBecameClose', timestamp: expect.any(Number) }]);
      expect(r!.signals.twoHandState).toBe('close');
    });

    it('fires handsBecameFar exactly once once hold time is satisfied', () => {
      const extractor = createTwoHandSignalExtractor();
      const allEvents: unknown[] = [];
      let r: ProcessFrameResult | undefined;
      for (let t = 0; t <= HOLD + 50; t += 10) {
        r = extractor.processFrame(twoHandFrame(t, 0.95));
        allEvents.push(...r.events);
      }
      expect(allEvents).toEqual([{ type: 'handsBecameFar', timestamp: expect.any(Number) }]);
      expect(r!.signals.twoHandState).toBe('far');
    });
  });

  describe('hysteresis / rapid crossing', () => {
    it('does not flicker when distance oscillates rapidly near closeEnterThreshold', () => {
      const extractor = createTwoHandSignalExtractor();
      const allEvents: unknown[] = [];
      // Alternate 1ms apart, each frame's target reverting before the
      // previous one's hold timer could ever complete (HOLD default is
      // 150ms) -- state must never qualify as 'close'.
      let r: ProcessFrameResult | undefined;
      for (let t = 0; t < 60; t += 1) {
        const distance = t % 2 === 0 ? CLOSE_ENTER - 0.01 : CLOSE_ENTER + 0.01;
        r = extractor.processFrame(twoHandFrame(t, distance));
        allEvents.push(...r.events);
      }
      expect(allEvents).toEqual([]);
      expect(r!.signals.twoHandState).toBe('neutral');
    });

    it('stays close through minor noise inside the release band once qualified', () => {
      const extractor = createTwoHandSignalExtractor();
      let r: ProcessFrameResult | undefined;
      for (let t = 0; t <= HOLD + 50; t += 10) {
        r = extractor.processFrame(twoHandFrame(t, 0.05));
      }
      expect(r!.signals.twoHandState).toBe('close');

      // Distance rises to just inside the hysteresis gap (between
      // closeEnterThreshold and closeReleaseThreshold) -- must not leave
      // 'close', even sustained well past hold time.
      const midGap = (CLOSE_ENTER + CLOSE_RELEASE) / 2;
      let t2 = HOLD + 60;
      for (; t2 <= HOLD + 60 + HOLD + 50; t2 += 10) {
        r = extractor.processFrame(twoHandFrame(t2, midGap));
      }
      expect(r!.signals.twoHandState).toBe('close');
    });

    it('releases from close only once distance sustains above closeReleaseThreshold', () => {
      const extractor = createTwoHandSignalExtractor();
      let r: ProcessFrameResult | undefined;
      let t = 0;
      for (; t <= HOLD + 50; t += 10) {
        r = extractor.processFrame(twoHandFrame(t, 0.05));
      }
      expect(r!.signals.twoHandState).toBe('close');

      const allEvents: unknown[] = [];
      t += 10;
      for (let held = 0; held <= HOLD + 50; held += 10, t += 10) {
        r = extractor.processFrame(twoHandFrame(t, CLOSE_RELEASE + 0.05));
        allEvents.push(...r.events);
      }
      expect(r!.signals.twoHandState).toBe('neutral');
      // Leaving close for neutral is not itself an event.
      expect(allEvents).toEqual([]);
    });

    it('releases from far only once distance sustains below farReleaseThreshold', () => {
      const extractor = createTwoHandSignalExtractor();
      let r: ProcessFrameResult | undefined;
      let t = 0;
      for (; t <= HOLD + 50; t += 10) {
        r = extractor.processFrame(twoHandFrame(t, 0.95));
      }
      expect(r!.signals.twoHandState).toBe('far');

      const allEvents: unknown[] = [];
      t += 10;
      for (let held = 0; held <= HOLD + 50; held += 10, t += 10) {
        r = extractor.processFrame(twoHandFrame(t, FAR_RELEASE - 0.05));
        allEvents.push(...r.events);
      }
      expect(r!.signals.twoHandState).toBe('neutral');
      expect(allEvents).toEqual([]);
    });
  });

  describe('hand swapping', () => {
    it('computes the same distance/state whichever physical hand is labeled left vs right', () => {
      const extractor = createTwoHandSignalExtractor();
      // Frame 1: hand A is left (x=0.2), hand B is right (x=0.6) -> distance 0.4.
      let r = extractor.processFrame(
        frame({
          timestamp: 0,
          hands: [handAt('A', 'left', 0.2), handAt('B', 'right', 0.6)],
        }),
      );
      expect(r.signals.handDistance).toBeCloseTo(0.4, 5);

      // Frame 2: labels swap (A is now right, B is now left), same
      // physical positions -> distance must remain 0.4, not become
      // something else because roles flipped.
      r = extractor.processFrame(
        frame({
          timestamp: 10,
          hands: [handAt('A', 'right', 0.2), handAt('B', 'left', 0.6)],
        }),
      );
      expect(r.signals.handDistance).toBeCloseTo(0.4, 5);
      expect(r.signals.twoHandPresence).toBe(true);
    });
  });

  describe('missing frames and recovery', () => {
    it('clears two-hand state when either hand disappears, without repeated events', () => {
      const extractor = createTwoHandSignalExtractor();
      let r: ProcessFrameResult | undefined;
      for (let t = 0; t <= HOLD + 50; t += 10) {
        r = extractor.processFrame(twoHandFrame(t, 0.05));
      }
      expect(r!.signals.twoHandState).toBe('close');

      const lostEvents: unknown[] = [];
      // Right hand vanishes.
      r = extractor.processFrame(frame({ timestamp: 1000, hands: [handAt('l', 'left', 0.475)] }));
      lostEvents.push(...r.events);
      expect(r.signals.twoHandPresence).toBe(false);
      expect(r.signals.twoHandState).toBe('neutral');

      // Stays missing across further frames -- no repeated loss events
      // (there is no loss event in this module's vocabulary at all, but
      // pin down that nothing spurious fires either).
      for (let t = 1010; t <= 1050; t += 10) {
        r = extractor.processFrame(frame({ timestamp: t, hands: [handAt('l', 'left', 0.475)] }));
        lostEvents.push(...r.events);
      }
      expect(lostEvents).toEqual([]);
    });

    it('clears state when both hands disappear simultaneously', () => {
      const extractor = createTwoHandSignalExtractor();
      for (let t = 0; t <= HOLD + 50; t += 10) {
        extractor.processFrame(twoHandFrame(t, 0.05));
      }
      const r = extractor.processFrame(frame({ timestamp: 1000 }));
      expect(r.signals.twoHandPresence).toBe(false);
      expect(r.signals.twoHandState).toBe('neutral');
    });

    it('starts a fresh segment on recovery, requiring hold time again before re-qualifying', () => {
      const extractor = createTwoHandSignalExtractor();
      let t = 0;
      for (; t <= HOLD + 50; t += 10) {
        extractor.processFrame(twoHandFrame(t, 0.05));
      }
      // Lose a hand.
      t += 10;
      extractor.processFrame(frame({ timestamp: t }));

      // Recover both hands, immediately close again -- must not
      // instantly re-report 'close' on the very first recovered frame;
      // hold time must elapse again.
      t += 10;
      const recoverFrameTime = t;
      const r1 = extractor.processFrame(twoHandFrame(t, 0.05));
      expect(r1.signals.twoHandPresence).toBe(true);
      expect(r1.signals.twoHandState).toBe('neutral');
      expect(r1.events).toEqual([]);

      // After hold time elapses again post-recovery, it re-qualifies
      // exactly once.
      const allEvents: unknown[] = [];
      let rLast: ProcessFrameResult | undefined;
      for (t = recoverFrameTime + 10; t <= recoverFrameTime + HOLD + 50; t += 10) {
        rLast = extractor.processFrame(twoHandFrame(t, 0.05));
        allEvents.push(...rLast.events);
      }
      expect(rLast!.signals.twoHandState).toBe('close');
      expect(allEvents).toEqual([{ type: 'handsBecameClose', timestamp: expect.any(Number) }]);
    });

    it('treats a malformed/unusable frame as absence without throwing', () => {
      const extractor = createTwoHandSignalExtractor();
      for (let t = 0; t <= HOLD + 50; t += 10) {
        extractor.processFrame(twoHandFrame(t, 0.05));
      }
      expect(() => extractor.processFrame(null as unknown as TrackingFrame)).not.toThrow();
      const r = extractor.processFrame(null as unknown as TrackingFrame);
      expect(r.signals.twoHandPresence).toBe(false);
      expect(r.signals.twoHandState).toBe('neutral');
    });
  });

  describe('reset', () => {
    it('clears state without emitting an event', () => {
      const extractor = createTwoHandSignalExtractor();
      for (let t = 0; t <= HOLD + 50; t += 10) {
        extractor.processFrame(twoHandFrame(t, 0.05));
      }
      extractor.reset();
      const r = extractor.processFrame(twoHandFrame(0, 0.05));
      // Fresh cold start after reset -- state is 'neutral' on the very
      // first frame, same as any new segment.
      expect(r.signals.twoHandState).toBe('neutral');
      expect(r.events).toEqual([]);
    });
  });
});

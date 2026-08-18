/**
 * Task 28: the deterministic, repeatable synthetic playback sequence
 * (acceptance criterion: "Synthetic playback produces a repeatable
 * timestamped signal sequence"). A pure function — no `Math.random`, no
 * `Date.now`, no wall-clock dependency — so calling it twice always
 * produces two structurally identical scripts, and playing the same
 * script back always emits the same frames in the same order with the
 * same timestamps.
 *
 * The script is played back through `createMockTrackingProvider`
 * (`mockProvider.ts`, Task 27), the same deterministic, manually-advanced
 * `TrackingProvider` implementation used by that module's own tests — so
 * playback flows through the identical tracking-provider contract manual
 * input and live input both use (Task 28 acceptance criterion).
 */
import { HAND_LANDMARK_COUNT } from './types';
import type { Hand, Landmark, TrackingFrame } from './types';
import type { MockScriptEntry } from './mockProvider';

const DEMO_HAND_ID = 'playback-hand';

function landmarksAt(x: number, y: number, z: number): Landmark[] {
  return Array.from({ length: HAND_LANDMARK_COUNT }, () => ({ x, y, z }));
}

function handAt(x: number, y: number, z = 0, confidence = 0.95): Hand {
  return { id: DEMO_HAND_ID, handedness: 'right', landmarks: landmarksAt(x, y, z), confidence };
}

function frame(
  entry: Omit<TrackingFrame, 'hands' | 'events'> & Partial<Pick<TrackingFrame, 'hands' | 'events'>>,
): MockScriptEntry {
  return { kind: 'frame', frame: { hands: [], events: [], ...entry } };
}

/**
 * Builds the demo playback script: a hand appears, moves across a few
 * positions, pinches, enters and exits an `openPalm` gesture, then
 * disappears. Timestamps are fixed, evenly-spaced milliseconds (0, 100,
 * 200, ...) — a `DemoControlsPanel` playback driver advances through them
 * one at a time (see `demoController.ts`), so real playback cadence is a
 * UI concern, never baked into the script itself.
 */
export function createDemoPlaybackScript(): MockScriptEntry[] {
  return [
    frame({
      timestamp: 0,
      hands: [handAt(0.5, 0.5)],
      events: [{ type: 'handAppear', handId: DEMO_HAND_ID, timestamp: 0 }],
    }),
    frame({ timestamp: 100, hands: [handAt(0.25, 0.4)] }),
    frame({ timestamp: 200, hands: [handAt(0.75, 0.35)] }),
    frame({ timestamp: 300, hands: [handAt(0.75, 0.35, 0.2)] }),
    frame({
      timestamp: 400,
      hands: [handAt(0.75, 0.35, 0.2)],
      events: [{ type: 'pinchStart', handId: DEMO_HAND_ID, timestamp: 400 }],
    }),
    frame({
      timestamp: 500,
      hands: [handAt(0.75, 0.35, 0.2)],
      events: [{ type: 'pinchEnd', handId: DEMO_HAND_ID, timestamp: 500 }],
    }),
    frame({
      timestamp: 600,
      hands: [handAt(0.5, 0.5)],
      events: [{ type: 'gestureEnter', handId: DEMO_HAND_ID, gesture: 'openPalm', timestamp: 600 }],
    }),
    frame({
      timestamp: 700,
      hands: [handAt(0.5, 0.5)],
      events: [{ type: 'gestureExit', handId: DEMO_HAND_ID, gesture: 'openPalm', timestamp: 700 }],
    }),
    frame({
      timestamp: 800,
      hands: [],
      events: [{ type: 'handDisappear', handId: DEMO_HAND_ID, timestamp: 800 }],
    }),
  ];
}

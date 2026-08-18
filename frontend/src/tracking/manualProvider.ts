/**
 * Task 28: a `TrackingProvider` driven by explicit manual control calls
 * (sliders/toggles/buttons in `DemoControlsPanel`) instead of a camera or a
 * scripted sequence. No camera API, no MediaPipe, and no wall-clock
 * timer — every frame it emits is the direct, synchronous result of a
 * caller calling one of its setter methods, so it works identically
 * whether or not camera APIs/MediaPipe are available in the browser (Task
 * 28 acceptance criterion) and is exercised the same way `mockProvider.ts`
 * is: by calling methods, not waiting on time.
 *
 * Only one hand is ever reported (manual controls drive a single "primary
 * hand"; two-hand demo input is out of scope for this task per the issue's
 * "Out of scope" — live camera/two-hand work belongs to later tasks). Every
 * frame it emits still satisfies the full `TrackingProvider`/`TrackingFrame`
 * contract from `types.ts`, so downstream consumers (future binding
 * execution, and this module's own tests) cannot tell a manual frame from
 * a live or scripted one.
 */
import { HAND_LANDMARK_COUNT } from './types';
import type {
  GestureEvent,
  GestureName,
  Hand,
  Landmark,
  TrackingFrame,
  TrackingProvider,
  TrackingProviderError,
  Unsubscribe,
} from './types';

/** The landmark index MediaPipe's 21-point hand model uses for the index
 * fingertip — the only landmark the manual controls move independently.
 * Every other landmark is held at a fixed neutral point (nudged by the
 * shared `handDepth` control) so `landmarks.length` always satisfies
 * `HAND_LANDMARK_COUNT`. */
const INDEX_TIP_LANDMARK = 8;

/** The continuous signals exposed as sliders. Documented ranges (used both
 * for `sanitizeFrame`-free validity and for each slider's `min`/`max` in
 * `DemoControlsPanel`):
 * - `indexTipX`/`indexTipY`: `[0, 1]`, matching `Landmark.x`/`y`'s
 *   normalized-to-frame convention (see `types.ts`).
 * - `handDepth`: `[-0.5, 0.5]`, applied to every landmark's `z`.
 * - `confidence`: `[0, 1]`, matching `Hand.confidence`'s documented range.
 */
export type ManualSignalName = 'indexTipX' | 'indexTipY' | 'handDepth' | 'confidence';

export const MANUAL_SIGNAL_RANGES: Record<
  ManualSignalName,
  { min: number; max: number; step: number; label: string }
> = {
  indexTipX: { min: 0, max: 1, step: 0.01, label: 'Index fingertip X' },
  indexTipY: { min: 0, max: 1, step: 0.01, label: 'Index fingertip Y' },
  handDepth: { min: -0.5, max: 0.5, step: 0.01, label: 'Hand depth (Z)' },
  confidence: { min: 0, max: 1, step: 0.01, label: 'Gesture confidence' },
};

export type ManualControlState = {
  present: boolean;
  gesture: GestureName | null;
  indexTipX: number;
  indexTipY: number;
  handDepth: number;
  confidence: number;
};

export function defaultManualControlState(): ManualControlState {
  return {
    present: false,
    gesture: null,
    indexTipX: 0.5,
    indexTipY: 0.5,
    handDepth: 0,
    confidence: 0.9,
  };
}

export interface ManualTrackingProvider extends TrackingProvider {
  /** Sets a continuous signal (clamped to its documented range) and, when
   * a hand is currently present, immediately emits a frame reflecting it.
   * A no-op emission (state still updates) while no hand is present, since
   * there is no hand for the change to be observable on. */
  setSignal(name: ManualSignalName, value: number): void;
  /** Toggles hand presence. Turning it on assigns a fresh hand id (a
   * reacquired hand never reuses a retired id — see `Hand.id`'s doc
   * comment) and emits a `handAppear` event; turning it off emits a
   * `gestureExit` (if a gesture was active) followed by a `handDisappear`
   * event, then retires the id. A no-op if already in the requested
   * state. */
  setPresent(present: boolean): void;
  /** Changes the active gesture state. Disabled (a no-op) while no hand is
   * present. Emits `gestureExit` for the previous gesture (if any) and
   * `gestureEnter` for the new one (if not `null`) in the same frame. */
  setGesture(gesture: GestureName | null): void;
  /** Emits a one-shot `pinchStart` event. A no-op while no hand is
   * present. */
  emitPinchStart(): void;
  /** Emits a one-shot `pinchEnd` event. A no-op while no hand is
   * present. */
  emitPinchEnd(): void;
  /** The current control state, for the panel to render visible
   * value/state for every control. */
  getState(): ManualControlState;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildLandmarks(state: ManualControlState): Landmark[] {
  return Array.from({ length: HAND_LANDMARK_COUNT }, (_, index) =>
    index === INDEX_TIP_LANDMARK
      ? { x: state.indexTipX, y: state.indexTipY, z: state.handDepth }
      : { x: 0.5, y: 0.5, z: state.handDepth },
  );
}

function buildHand(state: ManualControlState, handId: string): Hand {
  return {
    id: handId,
    handedness: 'right',
    landmarks: buildLandmarks(state),
    confidence: state.confidence,
  };
}

/** Creates a manual `TrackingProvider`. See the interface doc comments
 * above for what each control does; see the module doc comment for why
 * this needs no camera or MediaPipe dependency. */
export function createManualTrackingProvider(): ManualTrackingProvider {
  let started = false;
  let handCounter = 0;
  let currentHandId: string | null = null;
  let timestamp = 0;
  const state = defaultManualControlState();
  const frameListeners = new Set<(frame: TrackingFrame) => void>();
  const errorListeners = new Set<(error: TrackingProviderError) => void>();

  function tick(): number {
    timestamp += 1;
    return timestamp;
  }

  function emit(events: GestureEvent[], ts: number): void {
    if (!started) return;
    const hands = state.present && currentHandId ? [buildHand(state, currentHandId)] : [];
    const frame: TrackingFrame = { timestamp: ts, hands, events };
    for (const listener of frameListeners) listener(frame);
  }

  function start(): void {
    // Idempotent, matching the `TrackingProvider` lifecycle rule.
    if (started) return;
    started = true;
  }

  function stop(): void {
    // Never throws; safe at any time. Clean slate: no hand or event from
    // before this call carries into frames emitted after the next
    // start() — matching the `TrackingProvider` lifecycle rule.
    started = false;
    currentHandId = null;
    state.present = false;
    state.gesture = null;
  }

  function onFrame(listener: (frame: TrackingFrame) => void): Unsubscribe {
    frameListeners.add(listener);
    return () => frameListeners.delete(listener);
  }

  function onError(listener: (error: TrackingProviderError) => void): Unsubscribe {
    errorListeners.add(listener);
    return () => errorListeners.delete(listener);
  }

  function setSignal(name: ManualSignalName, value: number): void {
    const range = MANUAL_SIGNAL_RANGES[name];
    state[name] = clamp(value, range.min, range.max);
    if (!state.present) return;
    emit([], tick());
  }

  function setPresent(present: boolean): void {
    if (present === state.present) return;
    const ts = tick();
    if (present) {
      handCounter += 1;
      currentHandId = `manual-hand-${handCounter}`;
      state.present = true;
      emit([{ type: 'handAppear', handId: currentHandId, timestamp: ts }], ts);
      return;
    }
    const handId = currentHandId;
    const events: GestureEvent[] = [];
    if (handId) {
      if (state.gesture) {
        events.push({ type: 'gestureExit', handId, gesture: state.gesture, timestamp: ts });
      }
      events.push({ type: 'handDisappear', handId, timestamp: ts });
    }
    state.present = false;
    state.gesture = null;
    currentHandId = null;
    emit(events, ts);
  }

  function setGesture(gesture: GestureName | null): void {
    if (!state.present || !currentHandId) return;
    if (gesture === state.gesture) return;
    const ts = tick();
    const handId = currentHandId;
    const events: GestureEvent[] = [];
    if (state.gesture)
      events.push({ type: 'gestureExit', handId, gesture: state.gesture, timestamp: ts });
    if (gesture) events.push({ type: 'gestureEnter', handId, gesture, timestamp: ts });
    state.gesture = gesture;
    emit(events, ts);
  }

  function emitPinchStart(): void {
    if (!state.present || !currentHandId) return;
    const ts = tick();
    emit([{ type: 'pinchStart', handId: currentHandId, timestamp: ts }], ts);
  }

  function emitPinchEnd(): void {
    if (!state.present || !currentHandId) return;
    const ts = tick();
    emit([{ type: 'pinchEnd', handId: currentHandId, timestamp: ts }], ts);
  }

  function getState(): ManualControlState {
    return { ...state };
  }

  return {
    start,
    stop,
    onFrame,
    onError,
    setSignal,
    setPresent,
    setGesture,
    emitPinchStart,
    emitPinchEnd,
    getState,
  };
}

/**
 * Task 27: the normalized, renderer- and hardware-independent tracking
 * provider contract. `TrackingFrame`/`Hand`/`GestureEvent` are the shapes
 * every provider (the mock here, the real MediaPipe adapter in Task 30)
 * must emit; `TrackingProvider` is the lifecycle every provider must
 * implement. Signal-derivation code (Task 32 one-hand signals, Task 33
 * two-hand signals) and its tests consume only this contract, never
 * MediaPipe or a physical camera directly — see `_docs/plan.md`'s
 * "Tracking abstraction" section, which this module implements.
 *
 * No file in this directory imports `@mediapipe/*` or any MediaPipe type.
 */

/** The maximum number of hands a `TrackingFrame` may contain, matching
 * `_docs/plan.md`'s one-hand/two-hand interaction modes. Conformant
 * providers never emit more than this many entries in `hands`; downstream
 * consumers (Task 32/33) do not need to handle an unbounded hand list. */
export const MAX_HANDS_PER_FRAME = 2;

/** The number of landmarks a conformant provider emits per tracked hand —
 * MediaPipe's 21-point hand model (wrist, four joints per finger x five
 * fingers). This module has no MediaPipe dependency; it only borrows the
 * point count as the shape every provider (mock or real) must match. */
export const HAND_LANDMARK_COUNT = 21;

/** A single hand landmark, normalized to the tracking source's coordinate
 * space (MediaPipe convention: x/y in [0, 1] relative to frame width/
 * height, z roughly relative to wrist depth — this module does not
 * enforce those ranges, it only carries the three numbers through). */
export type Landmark = {
  x: number;
  y: number;
  z: number;
};

/**
 * One tracked hand within a `TrackingFrame`.
 *
 * - `id` stays the same across consecutive frames for as long as the same
 *   physical hand continues to be tracked. Once a hand is lost (it stops
 *   appearing in `hands`, or a `handDisappear` event is emitted for it),
 *   its id is retired: a provider must never reuse a retired id. If the
 *   same physical hand is reacquired later, the provider assigns it a
 *   *new* id — downstream code may safely assume that a given id always
 *   refers to one continuous tracking segment, never two separate periods
 *   of tracking stitched together.
 * - `landmarks` has exactly `HAND_LANDMARK_COUNT` (21) entries for a
 *   conformant provider.
 * - `confidence` is a number in the closed range [0, 1].
 */
export type Hand = {
  id: string;
  handedness: 'left' | 'right';
  landmarks: Landmark[];
  confidence: number;
};

/** The gesture-event variants every provider must be able to emit,
 * mirroring the `event:*` signal names already used in
 * `schema/scene.schema.json` (`event:pinchStart`, `event:pinchEnd`,
 * `event:gestureEnter`, `event:gestureExit`, `event:handAppear`,
 * `event:handDisappear`) without the `event:` binding-signal prefix,
 * which is `schema/scene.schema.json`'s own namespacing convention rather
 * than part of this type's vocabulary. */
export type GestureEventType =
  'pinchStart' | 'pinchEnd' | 'gestureEnter' | 'gestureExit' | 'handAppear' | 'handDisappear';

/** The named gesture states a `gestureEnter`/`gestureExit` event may
 * reference, mirroring `schema/scene.schema.json`'s `gestureState:*`
 * signal names (minus the `none` state, which is the absence of a
 * gesture rather than a state to enter/exit). */
export type GestureName = 'openPalm' | 'closedFist' | 'pointingUp' | 'thumbsUp' | 'victory';

type GestureEventBase = {
  /** The id of the `Hand` (see `Hand.id`) this event concerns. */
  handId: string;
  /** Same clock as the `TrackingFrame.timestamp` this event was emitted
   * alongside — see that field's doc comment for the monotonicity rule. */
  timestamp: number;
};

/** A gesture-event variant. Every variant carries at least `handId` and
 * `timestamp` (acceptance criterion); `pinchStart`/`pinchEnd` need no
 * further detail (`pinchStrength`/`pinchDistance` are derived signals,
 * out of scope for this raw contract — see Task 32), while
 * `gestureEnter`/`gestureExit` also carry which named gesture state was
 * entered or exited. */
export type GestureEvent =
  | (GestureEventBase & { type: 'pinchStart' })
  | (GestureEventBase & { type: 'pinchEnd' })
  | (GestureEventBase & { type: 'gestureEnter'; gesture: GestureName })
  | (GestureEventBase & { type: 'gestureExit'; gesture: GestureName })
  | (GestureEventBase & { type: 'handAppear' })
  | (GestureEventBase & { type: 'handDisappear' });

/**
 * One frame of normalized tracking data.
 *
 * - `timestamp` values within a single provider's frame stream are
 *   monotonically non-decreasing (never go backwards), since downstream
 *   cooldown/debounce/smoothing logic (Task 32/33) depends on ordered
 *   time. A provider may emit two frames with an equal timestamp, but
 *   never a timestamp lower than one it already emitted since the last
 *   `start()`.
 * - `hands` never has more than `MAX_HANDS_PER_FRAME` entries.
 * - `events` are the gesture events associated with this frame; a frame
 *   with no events emits an empty array, never `null`/`undefined`.
 */
export type TrackingFrame = {
  timestamp: number;
  hands: Hand[];
  events: GestureEvent[];
};

/** An error surfaced by a `TrackingProvider` on its dedicated error
 * channel (`TrackingProvider.onError`) — never folded into a
 * `TrackingFrame`, since a frame represents a successful sample and an
 * error is a distinct, separately-handleable occurrence (e.g. camera
 * permission revoked, decode failure, device disconnected). */
export type TrackingProviderError = {
  message: string;
  /** Same clock as `TrackingFrame.timestamp`. */
  timestamp: number;
  /** The underlying cause, if any (e.g. a caught exception or DOMException
   * from a real provider's camera/model call). Opaque to this contract. */
  cause?: unknown;
};

/** Unsubscribes a listener registered via `onFrame`/`onError`. Safe to
 * call more than once; the second and later calls are no-ops. */
export type Unsubscribe = () => void;

/**
 * The renderer- and hardware-independent contract a tracking provider
 * (the mock in `mockProvider.ts`, or the real MediaPipe adapter in
 * Task 30) must implement.
 *
 * Lifecycle rules every implementation must follow:
 * - `start()` is idempotent: calling it while already started must not
 *   register a second internal subscription to the underlying frame
 *   source, and must not cause any frame to be emitted twice.
 * - `stop()` is safe to call at any time, including before `start()` was
 *   ever called or when the provider is already stopped — it never
 *   throws.
 * - Calling `stop()` and then `start()` again resumes frame emission
 *   from a clean slate: no hand or event from before the `stop()` is
 *   carried into frames emitted after the following `start()`.
 */
export interface TrackingProvider {
  /** Begins producing frames (and, when applicable, errors). Idempotent —
   * see the interface doc comment. */
  start(): void;
  /** Stops producing frames. Idempotent and never throws — see the
   * interface doc comment. */
  stop(): void;
  /** Registers `listener` to be called with every `TrackingFrame` this
   * provider emits from now on. Returns an `Unsubscribe` function. */
  onFrame(listener: (frame: TrackingFrame) => void): Unsubscribe;
  /** Registers `listener` to be called with every `TrackingProviderError`
   * this provider emits from now on. A separate channel from `onFrame` —
   * errors are never delivered as, or folded into, frames. Returns an
   * `Unsubscribe` function. */
  onError(listener: (error: TrackingProviderError) => void): Unsubscribe;
  /** Task 110 (issue #141): registers `listener` to be called with the
   * raw camera `MediaStream` this provider acquires internally for
   * tracking, or `null` once that stream is released (on `stop()`, a
   * mid-`start()` failure, or a superseded `start()` call) — so a caller
   * (`CameraControl`'s Preview overlay) can display the same live camera
   * feed the tracking pipeline already has open, without requesting a
   * second `getUserMedia` stream. Optional: a provider with no camera of
   * its own (e.g. a mock or demo provider) simply never calls `listener`.
   * Never emits a frame's pixel data or any derived image — only the
   * `MediaStream` handle itself, consistent with this contract's
   * hardware-independence (a provider without a camera has nothing to
   * emit here). Returns an `Unsubscribe` function, mirroring
   * `onFrame`/`onError`. */
  onStream?(listener: (stream: MediaStream | null) => void): Unsubscribe;
}

/**
 * Task 32: derives normalized, smoothed, single-hand signals and
 * transition events from raw `TrackingFrame`s (Task 27's contract,
 * `types.ts`). Works identically no matter which `TrackingProvider`
 * produced the frame — the mock (`mockProvider.ts`), the manual/demo
 * provider (`manualProvider.ts`), or the real MediaPipe adapter
 * (`mediapipeProvider.ts`) — since it only ever reads `TrackingFrame`
 * fields, never a provider-specific type.
 *
 * Two-hand distance/closeness signals are out of scope (Task 33, issue
 * #33); behavior-binding UI is out of scope (Task 34, issue #34). This
 * module only derives signals — it does not bind them to anything.
 *
 * ## Signals exposed (`HandSignals`), matching `schema/scene.schema.json`'s
 * `signal` enum naming (`indexTipX`, `palmX`, `handDepth`, ... below):
 *
 * | Signal              | Range when present   | Value when absent |
 * |----------------------|----------------------|--------------------|
 * | `indexTipX`/`Y`      | `[0, 1]`              | `null`             |
 * | `palmX`/`Y`           | `[0, 1]`              | `null`             |
 * | `handDepth`           | `[-1, 1]` (clamped)   | `null`             |
 * | `handSpeed`           | `[0, 1]` (clamped)    | `0`                |
 * | `pinchDistance`       | `[0, 1]` (clamped)    | `null`             |
 * | `pinchStrength`       | `[0, 1]` (clamped)    | `null`             |
 * | `gestureConfidence`   | `[0, 1]`              | `0`                |
 * | `handPresence`        | `boolean`             | `false`            |
 * | `gestureState`        | `GestureName \| 'none'` | `'none'`         |
 *
 * ## Events emitted
 *
 * Reuses `types.ts`'s `GestureEvent` union so the vocabulary matches the
 * raw tracking contract and `schema/scene.schema.json`'s `event:*` signal
 * names: `handAppear`/`handDisappear` (presence), `gestureEnter`/
 * `gestureExit` (gesture state), `pinchStart`/`pinchEnd` (pinch). Every
 * event is emitted by *this* module's own state diffing — never
 * forwarded verbatim from `frame.events` — so "fires exactly once per
 * qualified transition" holds regardless of what (if anything) the
 * upstream provider already deduplicated.
 *
 * ## Primary-hand selection
 *
 * This is a *one*-hand extractor (Task 33 handles two hands). When a
 * frame carries more than one hand, the currently-tracked hand id is
 * kept as long as it is still present and meets the confidence
 * threshold (sticky selection, so two simultaneously visible hands don't
 * cause presence to flap frame to frame); otherwise the
 * highest-confidence qualifying hand is adopted as primary.
 *
 * ## Gesture classification source
 *
 * `mediapipeProvider.ts` already runs MediaPipe's canned gesture
 * classifier and reports transitions as `gestureEnter`/`gestureExit`
 * events on the frame; `manualProvider.ts` and hand-authored mock
 * scripts do the same by construction. This module *prefers* that
 * provider-supplied classification (replaying `frame.events` for the
 * tracked hand to maintain a `currentGesture` value) the first time it
 * ever sees a gesture event for the tracked hand's tracking segment. If
 * a hand's whole tracked segment never carries a single gesture event
 * (a provider that only emits raw landmarks), this module falls back to
 * classifying the gesture itself from landmark geometry
 * (`classifyGestureFromLandmarks`), using MediaPipe's standard 21-point
 * hand landmark indices (see the constants below). Either way, this
 * module's own before/after diff of `currentGesture` is what actually
 * drives `gestureEnter`/`gestureExit` emission.
 *
 * ## Pinch
 *
 * Pinch strength/distance is always self-derived from landmark geometry
 * (the distance between the thumb tip and index fingertip), regardless
 * of provider — `mediapipeProvider.ts` deliberately does not emit
 * `pinchStart`/`pinchEnd` itself, documenting that this derivation
 * belongs to Task 32.
 *
 * ## Smoothing
 *
 * Continuous signals (`indexTipX/Y`, `palmX/Y`, `handDepth`,
 * `pinchDistance`/`Strength`, `gestureConfidence`) are smoothed with an
 * exponential moving average (EMA): `smoothed += alpha * (raw -
 * smoothed)`, `alpha` = `smoothingAlpha` (default `0.35`, documented on
 * `DEFAULT_HAND_SIGNAL_OPTIONS`). `handSpeed` is derived from
 * consecutive *smoothed* palm-center positions, so it inherits the same
 * jitter reduction. Smoothing state is scoped to one continuous presence
 * segment: the instant `handPresence` becomes `false`, all smoothing
 * state is discarded (not decayed) and every continuous signal reports
 * its documented absent value immediately — no stale hold-over. The
 * first frame of a new presence segment seeds the EMA at the raw value
 * (no blending with a previous, now-stale segment's smoothed value).
 *
 * ## Fallback policy for low confidence / malformed frames
 *
 * - `processFrame` never throws. A frame that fails `sanitizeFrame`'s
 *   structural checks, or any hand within it, is treated the same as no
 *   hand for that frame (see `sanitizeFrame.ts` for the exact malformed
 *   -hand rule this module also applies defensively).
 * - A hand whose (sanitized, clamped) `confidence` is below
 *   `confidenceThreshold` (default `0.5`) is treated as absent for that
 *   frame, even though the provider still reported landmarks for it —
 *   low-confidence tracking data is discarded rather than surfaced.
 * - A `TrackingFrame`-shaped value that is missing entirely, `null`, or
 *   otherwise not usable (e.g. `hands` is not an array) is treated as an
 *   empty frame (no hands, no events) at the frame's best-effort
 *   timestamp.
 */
import { sanitizeFrame } from './sanitizeFrame';
import type { GestureEvent, GestureName, Hand, Landmark, TrackingFrame } from './types';

// --- MediaPipe's standard 21-point hand landmark indices -------------------
const WRIST = 0;
const THUMB_MCP = 2;
const THUMB_IP = 3;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

/** Landmarks averaged to approximate the palm center: the wrist plus the
 * four non-thumb finger MCP joints — a standard, orientation-tolerant
 * approximation used across MediaPipe-based hand UIs. */
const PALM_CENTER_LANDMARKS = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP];

export type HandSignalExtractorOptions = {
  /** Confidence below which a hand is treated as absent for that frame.
   * `[0, 1]`. Default `0.5` — the midpoint of the documented `[0, 1]`
   * confidence range; `_docs/plan.md` does not specify an exact value,
   * so this is this module's own documented choice. */
  confidenceThreshold: number;
  /** EMA smoothing factor applied to continuous signals, `(0, 1]`.
   * Higher = less smoothing / faster response. Default `0.35`: strong
   * enough to visibly damp single-frame jitter while still tracking a
   * deliberate hand move within a handful of frames. Own documented
   * choice; not specified by `_docs/plan.md`. */
  smoothingAlpha: number;
  /** Smoothed `pinchStrength` at/above which a `pinchStart` fires.
   * `[0, 1]`. Default `0.75`. */
  pinchEngageThreshold: number;
  /** Smoothed `pinchStrength` at/below which a `pinchEnd` fires.
   * `[0, 1]`, must be `< pinchEngageThreshold` — the gap between the two
   * is the hysteresis band that keeps a pinch hovering near one
   * threshold from flickering start/end events every frame (same
   * hysteresis principle `_docs/plan.md` documents for two-hand
   * close/far thresholds). Default `0.55`. */
  pinchReleaseThreshold: number;
  /** Normalized thumb-tip-to-index-tip landmark distance (2D, x/y only)
   * that maps to `pinchStrength = 0` (fingers fully apart);
   * `pinchStrength = 1 - clamp(distance / maxPinchDistance, 0, 1)`.
   * Default `0.35`, an own documented choice approximating a relaxed
   * open hand's thumb/index spread in normalized frame coordinates. */
  maxPinchDistance: number;
  /** Smoothed palm-center movement, in normalized frame-widths per
   * second, that maps to `handSpeed = 1`. Default `2.0` (own documented
   * choice: crossing the frame twice per second reads as "fast"). */
  maxSpeed: number;
};

export const DEFAULT_HAND_SIGNAL_OPTIONS: HandSignalExtractorOptions = {
  confidenceThreshold: 0.5,
  smoothingAlpha: 0.35,
  pinchEngageThreshold: 0.75,
  pinchReleaseThreshold: 0.55,
  maxPinchDistance: 0.35,
  maxSpeed: 2.0,
};

export type HandSignals = {
  timestamp: number;
  handPresence: boolean;
  indexTipX: number | null;
  indexTipY: number | null;
  palmX: number | null;
  palmY: number | null;
  handDepth: number | null;
  handSpeed: number;
  pinchDistance: number | null;
  pinchStrength: number | null;
  gestureConfidence: number;
  gestureState: GestureName | 'none';
};

function absentSignals(timestamp: number): HandSignals {
  return {
    timestamp,
    handPresence: false,
    indexTipX: null,
    indexTipY: null,
    palmX: null,
    palmY: null,
    handDepth: null,
    handSpeed: 0,
    pinchDistance: null,
    pinchStrength: null,
    gestureConfidence: 0,
    gestureState: 'none',
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function landmarkAverage(landmarks: Landmark[], indices: number[]): Landmark {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const i of indices) {
    x += landmarks[i].x;
    y += landmarks[i].y;
    z += landmarks[i].z;
  }
  return { x: x / indices.length, y: y / indices.length, z: z / indices.length };
}

function dist2D(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** A finger is "extended" when its tip sits farther from the wrist than
 * its PIP (middle) joint does, by a margin — an orientation-tolerant
 * heuristic (works whichever way the hand is rotated in-frame, unlike
 * comparing raw y coordinates) standing in for a real classifier. */
function isFingerExtended(
  landmarks: Landmark[],
  wrist: Landmark,
  tip: number,
  pip: number,
): boolean {
  const EXTENSION_RATIO = 1.15;
  return dist2D(landmarks[tip], wrist) > dist2D(landmarks[pip], wrist) * EXTENSION_RATIO;
}

/** Landmark-only fallback gesture classifier, used only when a tracked
 * hand's whole presence segment has produced no provider-supplied
 * gesture event (see module doc comment). Recognizes the same five named
 * gestures `mediapipeProvider.ts` maps from MediaPipe's canned
 * classifier, using MediaPipe's standard 21-point landmark indices. */
export function classifyGestureFromLandmarks(landmarks: Landmark[]): GestureName | 'none' {
  const wrist = landmarks[WRIST];
  const thumb =
    isFingerExtended(landmarks, wrist, THUMB_TIP, THUMB_IP) ||
    dist2D(landmarks[THUMB_TIP], landmarks[INDEX_MCP]) >
      dist2D(landmarks[THUMB_MCP], landmarks[INDEX_MCP]);
  const index = isFingerExtended(landmarks, wrist, INDEX_TIP, INDEX_PIP);
  const middle = isFingerExtended(landmarks, wrist, MIDDLE_TIP, MIDDLE_PIP);
  const ring = isFingerExtended(landmarks, wrist, RING_TIP, RING_PIP);
  const pinky = isFingerExtended(landmarks, wrist, PINKY_TIP, PINKY_PIP);

  const extendedCount = [thumb, index, middle, ring, pinky].filter(Boolean).length;

  if (extendedCount === 5) return 'openPalm';
  if (extendedCount === 0) return 'closedFist';
  if (index && !middle && !ring && !pinky && !thumb) return 'pointingUp';
  if (index && middle && !ring && !pinky) return 'victory';
  if (thumb && !index && !middle && !ring && !pinky) return 'thumbsUp';
  return 'none';
}

/** True if `value` looks like a usable `TrackingFrame` — used to satisfy
 * the "malformed frames follow an explicit fallback policy" acceptance
 * criterion for input that doesn't even match the `TrackingFrame` shape
 * (e.g. `null`/`undefined`, or `hands` not an array). Callers with
 * correct TypeScript types can never construct such a value, but
 * `processFrame` still guards against it defensively at runtime. */
function looksLikeTrackingFrame(value: unknown): value is TrackingFrame {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { timestamp?: unknown; hands?: unknown; events?: unknown };
  return (
    typeof candidate.timestamp === 'number' &&
    Array.isArray(candidate.hands) &&
    Array.isArray(candidate.events)
  );
}

export interface HandSignalExtractor {
  /** Consumes one `TrackingFrame` and returns the derived signals for
   * this frame plus any transition events this frame crossed. Never
   * throws — see the module doc comment's fallback policy. */
  processFrame(frame: TrackingFrame): { signals: HandSignals; events: GestureEvent[] };
  /** Resets all internal state (tracked hand id, smoothing, gesture/pinch
   * state) to a clean slate, as if the extractor were freshly created.
   * Does not itself emit any event. */
  reset(): void;
}

type EmaState = {
  indexTipX: number;
  indexTipY: number;
  palmX: number;
  palmY: number;
  palmZ: number;
  pinchStrength: number;
  confidence: number;
  lastTimestamp: number;
  speed: number;
};

/** Creates a fresh `HandSignalExtractor`. Each instance tracks its own
 * primary hand id and smoothing/gesture/pinch state, independent of any
 * other instance — safe to create one per editor/preview surface. */
export function createHandSignalExtractor(
  options: Partial<HandSignalExtractorOptions> = {},
): HandSignalExtractor {
  const opts: HandSignalExtractorOptions = { ...DEFAULT_HAND_SIGNAL_OPTIONS, ...options };

  let trackedHandId: string | null = null;
  let ema: EmaState | null = null;
  let currentGesture: GestureName | 'none' = 'none';
  let hasSeenProviderGestureEvent = false;
  let pinching = false;

  function reset(): void {
    trackedHandId = null;
    ema = null;
    currentGesture = 'none';
    hasSeenProviderGestureEvent = false;
    pinching = false;
  }

  /** Ends the current presence segment: emits `gestureExit` (if a
   * gesture was active), `pinchEnd` (if pinching), then `handDisappear`,
   * and clears all segment-scoped state. */
  function endPresence(handId: string, timestamp: number, events: GestureEvent[]): void {
    if (currentGesture !== 'none') {
      events.push({ type: 'gestureExit', handId, gesture: currentGesture, timestamp });
    }
    if (pinching) {
      events.push({ type: 'pinchEnd', handId, timestamp });
    }
    events.push({ type: 'handDisappear', handId, timestamp });
    trackedHandId = null;
    ema = null;
    currentGesture = 'none';
    hasSeenProviderGestureEvent = false;
    pinching = false;
  }

  function selectPrimaryHand(hands: Hand[]): Hand | null {
    const qualifying = hands.filter((h) => h.confidence >= opts.confidenceThreshold);
    if (qualifying.length === 0) return null;
    if (trackedHandId) {
      const sticky = qualifying.find((h) => h.id === trackedHandId);
      if (sticky) return sticky;
    }
    return qualifying.reduce((best, h) => (h.confidence > best.confidence ? h : best));
  }

  function processFrame(rawFrame: TrackingFrame): { signals: HandSignals; events: GestureEvent[] } {
    try {
      if (!looksLikeTrackingFrame(rawFrame)) {
        const timestamp = Date.now();
        const events: GestureEvent[] = [];
        if (trackedHandId) endPresence(trackedHandId, timestamp, events);
        return { signals: absentSignals(timestamp), events };
      }

      const frame = sanitizeFrame(rawFrame);
      const timestamp = frame.timestamp;
      const events: GestureEvent[] = [];

      const primary = selectPrimaryHand(frame.hands);

      if (!primary) {
        if (trackedHandId) endPresence(trackedHandId, timestamp, events);
        return { signals: absentSignals(timestamp), events };
      }

      const isNewSegment = primary.id !== trackedHandId;
      if (isNewSegment) {
        // A different hand becoming primary implicitly ends any previous
        // segment first (defensive; selectPrimaryHand's stickiness makes
        // this rare in practice, but two simultaneous hands could still
        // cause a switch).
        if (trackedHandId) endPresence(trackedHandId, timestamp, events);
        trackedHandId = primary.id;
        events.push({ type: 'handAppear', handId: primary.id, timestamp });
      }

      const palm = landmarkAverage(primary.landmarks, PALM_CENTER_LANDMARKS);
      const rawIndexX = primary.landmarks[INDEX_TIP].x;
      const rawIndexY = primary.landmarks[INDEX_TIP].y;
      const rawPinchDistance = clamp(
        dist2D(primary.landmarks[THUMB_TIP], primary.landmarks[INDEX_TIP]) / opts.maxPinchDistance,
        0,
        1,
      );
      const rawPinchStrength = 1 - rawPinchDistance;

      if (isNewSegment || !ema) {
        // Cold start: seed smoothing at the raw value so a reappearing
        // hand is never blended with a stale previous segment's value.
        // Speed is 0 on the first frame of a segment — there is no prior
        // position to measure a displacement from.
        ema = {
          indexTipX: rawIndexX,
          indexTipY: rawIndexY,
          palmX: palm.x,
          palmY: palm.y,
          palmZ: palm.z,
          pinchStrength: rawPinchStrength,
          confidence: primary.confidence,
          lastTimestamp: timestamp,
          speed: 0,
        };
      } else {
        const a = opts.smoothingAlpha;
        const prevPalmX = ema.palmX;
        const prevPalmY = ema.palmY;
        ema.indexTipX += a * (rawIndexX - ema.indexTipX);
        ema.indexTipY += a * (rawIndexY - ema.indexTipY);
        ema.palmX += a * (palm.x - ema.palmX);
        ema.palmY += a * (palm.y - ema.palmY);
        ema.palmZ += a * (palm.z - ema.palmZ);
        ema.pinchStrength += a * (rawPinchStrength - ema.pinchStrength);
        ema.confidence += a * (primary.confidence - ema.confidence);

        const dtSeconds = Math.max(0, timestamp - ema.lastTimestamp) / 1000;
        const displacement = Math.hypot(ema.palmX - prevPalmX, ema.palmY - prevPalmY);
        // Normalized frame-widths per second; dtSeconds === 0 (two frames
        // sharing a timestamp, allowed by TrackingFrame's monotonicity
        // rule) reports 0 rather than dividing by zero.
        ema.speed = dtSeconds > 0 ? displacement / dtSeconds : 0;
        ema.lastTimestamp = timestamp;
      }

      const handSpeed = ema.speed / opts.maxSpeed;

      // --- gesture classification ---------------------------------------
      // Replay this frame's gesture events (in order) for the primary
      // hand to compute what the provider says the gesture is *now*.
      // `null` means "this frame carried no gesture event" (distinct
      // from `'none'`, which means an event explicitly ended a gesture).
      let providerGestureThisFrame: GestureName | 'none' | null = null;
      for (const evt of frame.events) {
        if (evt.handId !== primary.id) continue;
        if (evt.type === 'gestureExit') {
          hasSeenProviderGestureEvent = true;
          providerGestureThisFrame = 'none';
        } else if (evt.type === 'gestureEnter') {
          hasSeenProviderGestureEvent = true;
          providerGestureThisFrame = evt.gesture;
        }
      }

      const nextGesture: GestureName | 'none' = hasSeenProviderGestureEvent
        ? (providerGestureThisFrame ?? currentGesture)
        : classifyGestureFromLandmarks(primary.landmarks);

      if (nextGesture !== currentGesture) {
        if (currentGesture !== 'none') {
          events.push({
            type: 'gestureExit',
            handId: primary.id,
            gesture: currentGesture,
            timestamp,
          });
        }
        if (nextGesture !== 'none') {
          events.push({
            type: 'gestureEnter',
            handId: primary.id,
            gesture: nextGesture,
            timestamp,
          });
        }
        currentGesture = nextGesture;
      }

      // --- pinch hysteresis -----------------------------------------------
      const smoothedPinchStrength = ema.pinchStrength;
      if (!pinching && smoothedPinchStrength >= opts.pinchEngageThreshold) {
        pinching = true;
        events.push({ type: 'pinchStart', handId: primary.id, timestamp });
      } else if (pinching && smoothedPinchStrength <= opts.pinchReleaseThreshold) {
        pinching = false;
        events.push({ type: 'pinchEnd', handId: primary.id, timestamp });
      }

      const signals: HandSignals = {
        timestamp,
        handPresence: true,
        indexTipX: clamp(ema.indexTipX, 0, 1),
        indexTipY: clamp(ema.indexTipY, 0, 1),
        palmX: clamp(ema.palmX, 0, 1),
        palmY: clamp(ema.palmY, 0, 1),
        handDepth: clamp(ema.palmZ, -1, 1),
        handSpeed: clamp(handSpeed, 0, 1),
        pinchDistance: clamp(1 - ema.pinchStrength, 0, 1),
        pinchStrength: clamp(ema.pinchStrength, 0, 1),
        gestureConfidence: clamp(ema.confidence, 0, 1),
        gestureState: currentGesture,
      };

      return { signals, events };
    } catch {
      // Belt-and-suspenders: processFrame must never throw (fallback
      // policy). Any unexpected error is treated as an absent hand for
      // this call.
      const timestamp = Date.now();
      const events: GestureEvent[] = [];
      if (trackedHandId) endPresence(trackedHandId, timestamp, events);
      return { signals: absentSignals(timestamp), events };
    }
  }

  return { processFrame, reset };
}

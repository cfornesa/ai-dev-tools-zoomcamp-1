/**
 * Task 33: derives normalized, smoothed, two-hand distance signals and
 * close/far transition events from raw `TrackingFrame`s (Task 27's
 * contract, `types.ts`). This is the two-hand analog of `handSignals.ts`
 * (Task 32) — same pure-extractor shape (`processFrame` consuming a
 * `TrackingFrame`, EMA smoothing, exactly-once event emission, explicit
 * fallback policy for malformed/low-confidence input) applied to the
 * left/right hand pair instead of a single primary hand.
 *
 * V1 boundary (`_docs/plan.md`'s "Two-hand signals" list, issue #33's
 * Constraints): two-hand midpoint and same-gesture checks are later
 * extensions within the same provider model and are deliberately NOT
 * implemented here.
 *
 * ## Left/right assignment
 *
 * Roles are assigned from each `Hand.handedness` field (Task 27's
 * contract), never from array index or discovery order — a frame's
 * `hands` array may list the right hand before the left hand, or the
 * order may change frame to frame, and this module must not care.
 *
 * `sanitizeFrame` already guarantees every hand in a frame has
 * `handedness` of exactly `'left'` or `'right'` and never more than
 * `MAX_HANDS_PER_FRAME` (2) hands total, but it does not guarantee the
 * two hands report *different* handedness (a provider could — through a
 * classifier error — report two simultaneous hands as both `'left'`).
 * This module's documented fallback for that case: keep only the
 * higher-confidence hand of the duplicated handedness (ties keep neither,
 * since there is no principled way to break the tie) and treat the frame
 * as having at most one usable hand for two-hand purposes — i.e. the
 * same as if only one hand were visible (see "Loss of either hand"
 * below).
 *
 * ## Distance normalization
 *
 * Distance is the 2D (x/y only, ignoring depth) Euclidean distance
 * between the left and right hand's *palm centers* — the same
 * wrist-plus-four-MCP-joints average `handSignals.ts` uses for `palmX`/
 * `palmY`, chosen for consistency with that sibling module and because
 * `_docs/plan.md`'s "Two-hand distance" section explicitly allows "palm
 * centers or wrists" and palm center is the more stable of the two
 * (wrist alone is more sensitive to wrist rotation/flex).
 *
 * Raw palm-to-palm distance is normalized to `[0, 1]` by dividing by
 * `maxHandDistance` (own documented choice, default `1.0`) and clamping:
 * `normalized = clamp(rawDistance / maxHandDistance, 0, 1)`. Landmark
 * coordinates are normalized to `[0, 1]` per frame width/height (Task 27
 * contract), so a `maxHandDistance` of `1.0` means "one full frame-width
 * apart" reads as maximally far — a raw diagonal separation (corner to
 * corner) can slightly exceed this and is clamped to `1`, which is the
 * intended behavior (hands spread further than a frame-width apart are
 * all "maximally far" for interaction purposes).
 *
 * Distance is smoothed with the same EMA approach as `handSignals.ts`:
 * `smoothed += alpha * (raw - smoothed)`, `alpha` = `smoothingAlpha`
 * (default `0.35`, matching `handSignals.ts`'s default for consistency).
 * Smoothing state is scoped to one continuous two-hand presence segment
 * (see below) — seeded at the raw value on the first frame of a segment,
 * discarded (not decayed) the instant two-hand presence ends.
 *
 * ## Close/far hysteresis and hold time
 *
 * `_docs/plan.md`'s "Two-hand distance" section documents four
 * configuration controls — close threshold, far threshold, hold time,
 * release threshold — and "use hysteresis for threshold events so values
 * near a threshold do not flicker." Issue #33's acceptance criteria
 * additionally requires *separately* configurable entry and release
 * thresholds for *both* close and far, so this module exposes four
 * threshold options: `closeEnterThreshold`/`closeReleaseThreshold` and
 * `farEnterThreshold`/`farReleaseThreshold`.
 *
 * The qualified state is one of `'close' | 'far' | 'neutral'`:
 * - `'close'`: smoothed distance at or below `closeEnterThreshold`.
 * - `'far'`: smoothed distance at or above `farEnterThreshold`.
 * - `'neutral'`: anywhere else, including the entire hysteresis gap
 *   between a release threshold and the opposite entry threshold.
 *
 * Which threshold governs a given frame depends on the *current
 * qualified state* (standard hysteresis band, same principle as
 * `handSignals.ts`'s pinch engage/release pair):
 * - From `'close'`, distance must rise strictly above
 *   `closeReleaseThreshold` (which must be `> closeEnterThreshold`)
 *   before `'close'` is left.
 * - From `'far'`, distance must fall strictly below
 *   `farReleaseThreshold` (which must be `< farEnterThreshold`) before
 *   `'far'` is left.
 * - From `'neutral'`, entering `'close'` requires distance at or below
 *   `closeEnterThreshold`; entering `'far'` requires distance at or
 *   above `farEnterThreshold`. Threshold *equality* qualifies as entry
 *   (`<=`/`>=`), matching `handSignals.ts`'s pinch hysteresis convention.
 *
 * This per-frame "instantaneous target state" is then gated by
 * `holdTimeMs` (default `150`, own documented choice — long enough to
 * absorb a few frames of tracking jitter at a typical ~30fps camera feed
 * without feeling laggy to a deliberate hand movement): the target state
 * must be the *same* target on every consecutive frame for at least
 * `holdTimeMs` before it becomes the new qualified state. Any frame whose
 * target reverts to the current qualified state, or changes to a
 * *different* target than the one being timed, resets the hold timer.
 * `holdTimeMs` of `0` qualifies immediately (no gating).
 *
 * `handsBecameClose`/`handsBecameFar` fire exactly once, at the moment a
 * hold-time-qualified crossing lands on `'close'`/`'far'` respectively —
 * never repeatedly while held, never before the hold time elapses, and
 * never for a qualified transition into `'neutral'` (the vocabulary
 * `_docs/plan.md` documents has no "became neutral" event; leaving
 * close/far is observable only via `twoHandState` no longer reading
 * `'close'`/`'far'` on subsequent frames, not via an event).
 *
 * ## Loss-of-hand policy
 *
 * Two-hand state requires *both* a left and a right hand qualifying by
 * `confidenceThreshold` (default `0.5`, matching `handSignals.ts`) in the
 * same frame. The instant that condition stops holding (either hand
 * disappears, drops below the confidence threshold, or the frame is
 * malformed/unusable):
 * - The qualified state reverts to `'neutral'` and all smoothing/hold
 *   state is discarded (not decayed) — the next two-hand segment starts
 *   cold, exactly like `handSignals.ts` treats a lost primary hand.
 * - This reversion happens at most once per loss: if the frame that
 *   dropped below two hands already produced the `'neutral'` reversion,
 *   subsequent frames that remain below two hands report the same
 *   already-neutral state and emit nothing further — no repeated events,
 *   satisfying the "without emitting repeated events" acceptance
 *   criterion. Reverting to `'neutral'` itself never emits an event (see
 *   above): only `handsBecameClose`/`handsBecameFar` are ever emitted,
 *   and losing a hand cannot qualify as either.
 * - Recovery (both hands present and confident again) starts a brand new
 *   segment: smoothing reseeds at the raw value, and reaching `'close'`/
 *   `'far'` again requires the same hold-time-gated crossing as any other
 *   transition.
 *
 * ## Fallback policy for malformed input
 *
 * Mirrors `handSignals.ts`: `processFrame` never throws. A frame that
 * fails `sanitizeFrame`'s structural checks, is missing/`null`, or is
 * otherwise not usable is treated as "no two-hand state" for that frame
 * (i.e. the loss-of-hand policy above applies).
 */
import { sanitizeFrame } from './sanitizeFrame';
import type { Hand, Landmark, TrackingFrame } from './types';

// --- MediaPipe's standard 21-point hand landmark indices -------------------
const WRIST = 0;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const RING_MCP = 13;
const PINKY_MCP = 17;

/** Same palm-center approximation `handSignals.ts` uses: wrist plus the
 * four non-thumb finger MCP joints, averaged. */
const PALM_CENTER_LANDMARKS = [WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP];

export type TwoHandState = 'close' | 'far' | 'neutral';

export type TwoHandTransitionEvent = {
  type: 'handsBecameClose' | 'handsBecameFar';
  timestamp: number;
};

export type TwoHandSignalExtractorOptions = {
  /** Confidence below which a hand is treated as absent for two-hand
   * purposes. `[0, 1]`. Default `0.5`, matching `handSignals.ts`. */
  confidenceThreshold: number;
  /** EMA smoothing factor applied to normalized distance, `(0, 1]`.
   * Default `0.35`, matching `handSignals.ts`. */
  smoothingAlpha: number;
  /** Raw palm-to-palm distance (normalized frame units) that maps to
   * `distance = 1`. Default `1.0` — see module doc comment. */
  maxHandDistance: number;
  /** Smoothed distance at/below which `'close'` is entered from
   * `'neutral'`. `[0, 1]`. Default `0.2`, an own documented choice: hands
   * within a fifth of a frame-width of each other read as deliberately
   * brought close together. */
  closeEnterThreshold: number;
  /** Smoothed distance strictly above which `'close'` is left. Must be
   * `> closeEnterThreshold` — the gap is the hysteresis band. Default
   * `0.3`. */
  closeReleaseThreshold: number;
  /** Smoothed distance at/above which `'far'` is entered from
   * `'neutral'`. `[0, 1]`. Default `0.6`, an own documented choice:
   * hands spread more than 60% of a frame-width apart read as
   * deliberately spread far apart. */
  farEnterThreshold: number;
  /** Smoothed distance strictly below which `'far'` is left. Must be
   * `< farEnterThreshold` — the gap is the hysteresis band. Default
   * `0.5`. */
  farReleaseThreshold: number;
  /** Milliseconds a target state (`'close'`/`'far'`/`'neutral'`) must
   * persist, unbroken, before it qualifies as the new state. Default
   * `150` — see module doc comment. `0` disables gating. */
  holdTimeMs: number;
};

export const DEFAULT_TWO_HAND_SIGNAL_OPTIONS: TwoHandSignalExtractorOptions = {
  confidenceThreshold: 0.5,
  smoothingAlpha: 0.35,
  maxHandDistance: 1.0,
  closeEnterThreshold: 0.2,
  closeReleaseThreshold: 0.3,
  farEnterThreshold: 0.6,
  farReleaseThreshold: 0.5,
  holdTimeMs: 150,
};

export type TwoHandSignals = {
  timestamp: number;
  /** True only when both a left and a right hand qualify (by
   * `confidenceThreshold`) in this frame. */
  twoHandPresence: boolean;
  /** Smoothed, normalized `[0, 1]` palm-to-palm distance, or `null` when
   * `twoHandPresence` is `false`. */
  handDistance: number | null;
  /** The current qualified state — see module doc comment. Always
   * `'neutral'` when `twoHandPresence` is `false`. */
  twoHandState: TwoHandState;
};

function absentSignals(timestamp: number): TwoHandSignals {
  return { timestamp, twoHandPresence: false, handDistance: null, twoHandState: 'neutral' };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function landmarkAverage(landmarks: Landmark[], indices: number[]): Landmark {
  let x = 0;
  let y = 0;
  for (const i of indices) {
    x += landmarks[i].x;
    y += landmarks[i].y;
  }
  return { x: x / indices.length, y: y / indices.length, z: 0 };
}

function dist2D(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** True if `value` looks like a usable `TrackingFrame` — mirrors
 * `handSignals.ts`'s runtime guard for the same acceptance criterion. */
function looksLikeTrackingFrame(value: unknown): value is TrackingFrame {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { timestamp?: unknown; hands?: unknown; events?: unknown };
  return (
    typeof candidate.timestamp === 'number' &&
    Array.isArray(candidate.hands) &&
    Array.isArray(candidate.events)
  );
}

/** Picks at most one hand per handedness value, resolving a malformed
 * frame that reports two hands with the *same* handedness by keeping
 * only the higher-confidence one of that duplicated pair (a tie keeps
 * neither — see module doc comment's "Left/right assignment" section). */
function assignLeftRight(hands: Hand[]): { left: Hand | null; right: Hand | null } {
  const lefts = hands.filter((h) => h.handedness === 'left');
  const rights = hands.filter((h) => h.handedness === 'right');

  const resolve = (candidates: Hand[]): Hand | null => {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const [a, b] = [...candidates].sort((x, y) => y.confidence - x.confidence);
    return a.confidence === b.confidence ? null : a;
  };

  return { left: resolve(lefts), right: resolve(rights) };
}

export interface TwoHandSignalExtractor {
  /** Consumes one `TrackingFrame` and returns the derived two-hand
   * signals for this frame plus any transition events this frame
   * crossed. Never throws — see the module doc comment's fallback
   * policy. */
  processFrame(frame: TrackingFrame): { signals: TwoHandSignals; events: TwoHandTransitionEvent[] };
  /** Resets all internal state (smoothing, qualified state, hold timer)
   * to a clean slate, as if the extractor were freshly created. Does not
   * itself emit any event. */
  reset(): void;
}

/** Creates a fresh `TwoHandSignalExtractor`. Each instance tracks its own
 * smoothing/state/hold-timer state, independent of any other instance. */
export function createTwoHandSignalExtractor(
  options: Partial<TwoHandSignalExtractorOptions> = {},
): TwoHandSignalExtractor {
  const opts: TwoHandSignalExtractorOptions = { ...DEFAULT_TWO_HAND_SIGNAL_OPTIONS, ...options };

  let smoothedDistance: number | null = null;
  let qualifiedState: TwoHandState = 'neutral';
  let pendingTarget: TwoHandState | null = null;
  let pendingSince: number | null = null;
  let hadTwoHands = false;

  function reset(): void {
    smoothedDistance = null;
    qualifiedState = 'neutral';
    pendingTarget = null;
    pendingSince = null;
    hadTwoHands = false;
  }

  /** Ends the current two-hand presence segment: clears smoothing/hold
   * state and reverts the qualified state to `'neutral'`. Emits nothing
   * (see module doc comment's loss-of-hand policy) — safe to call
   * whether or not a segment was actually active. */
  function endTwoHandPresence(): void {
    smoothedDistance = null;
    qualifiedState = 'neutral';
    pendingTarget = null;
    pendingSince = null;
    hadTwoHands = false;
  }

  /** The hysteresis-banded target state for `distance` given the current
   * qualified state — see module doc comment's "Close/far hysteresis"
   * section. */
  function targetState(distance: number): TwoHandState {
    if (qualifiedState === 'close') {
      if (distance > opts.closeReleaseThreshold) {
        return distance >= opts.farEnterThreshold ? 'far' : 'neutral';
      }
      return 'close';
    }
    if (qualifiedState === 'far') {
      if (distance < opts.farReleaseThreshold) {
        return distance <= opts.closeEnterThreshold ? 'close' : 'neutral';
      }
      return 'far';
    }
    if (distance <= opts.closeEnterThreshold) return 'close';
    if (distance >= opts.farEnterThreshold) return 'far';
    return 'neutral';
  }

  function processFrame(rawFrame: TrackingFrame): {
    signals: TwoHandSignals;
    events: TwoHandTransitionEvent[];
  } {
    try {
      if (!looksLikeTrackingFrame(rawFrame)) {
        const timestamp = Date.now();
        if (hadTwoHands) endTwoHandPresence();
        return { signals: absentSignals(timestamp), events: [] };
      }

      const frame = sanitizeFrame(rawFrame);
      const timestamp = frame.timestamp;

      const qualifyingHands = frame.hands.filter((h) => h.confidence >= opts.confidenceThreshold);
      const { left, right } = assignLeftRight(qualifyingHands);

      if (!left || !right) {
        if (hadTwoHands) endTwoHandPresence();
        return { signals: absentSignals(timestamp), events: [] };
      }

      const isNewSegment = !hadTwoHands;
      hadTwoHands = true;

      const leftPalm = landmarkAverage(left.landmarks, PALM_CENTER_LANDMARKS);
      const rightPalm = landmarkAverage(right.landmarks, PALM_CENTER_LANDMARKS);
      const rawDistance = clamp(dist2D(leftPalm, rightPalm) / opts.maxHandDistance, 0, 1);

      if (isNewSegment || smoothedDistance === null) {
        // Cold start: seed smoothing at the raw value, and reset the hold
        // timer, so a fresh two-hand segment never inherits a stale
        // previous segment's smoothing or pending crossing.
        smoothedDistance = rawDistance;
        qualifiedState = 'neutral';
        pendingTarget = null;
        pendingSince = null;
      } else {
        smoothedDistance += opts.smoothingAlpha * (rawDistance - smoothedDistance);
      }

      const events: TwoHandTransitionEvent[] = [];
      const target = targetState(smoothedDistance);

      if (target === qualifiedState) {
        pendingTarget = null;
        pendingSince = null;
      } else {
        if (pendingTarget !== target) {
          pendingTarget = target;
          pendingSince = timestamp;
        }
        const elapsed = timestamp - (pendingSince ?? timestamp);
        if (elapsed >= opts.holdTimeMs) {
          qualifiedState = target;
          pendingTarget = null;
          pendingSince = null;
          if (target === 'close') {
            events.push({ type: 'handsBecameClose', timestamp });
          } else if (target === 'far') {
            events.push({ type: 'handsBecameFar', timestamp });
          }
        }
      }

      const signals: TwoHandSignals = {
        timestamp,
        twoHandPresence: true,
        handDistance: clamp(smoothedDistance, 0, 1),
        twoHandState: qualifiedState,
      };

      return { signals, events };
    } catch {
      // Belt-and-suspenders: processFrame must never throw (fallback
      // policy). Any unexpected error is treated as a loss of two-hand
      // presence for this call.
      const timestamp = Date.now();
      if (hadTwoHands) endTwoHandPresence();
      return { signals: absentSignals(timestamp), events: [] };
    }
  }

  return { processFrame, reset };
}

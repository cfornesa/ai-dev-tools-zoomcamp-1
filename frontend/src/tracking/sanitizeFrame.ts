/**
 * Task 27: the documented rule for malformed tracking data.
 *
 * A provider's underlying source (a real model's output, or a hand-
 * authored mock script) can hand back data this contract doesn't allow:
 * a confidence outside [0, 1], a non-finite landmark coordinate, or an
 * unrecognized `handedness` value. `sanitizeFrame` is the single place
 * that rule is enforced, so every provider (mock today, MediaPipe in
 * Task 30) can share it instead of re-deriving the policy:
 *
 * - Non-finite `confidence` (`NaN`/`Infinity`/`-Infinity`), a `landmarks`
 *   array whose length isn't exactly `HAND_LANDMARK_COUNT`, a non-finite
 *   landmark coordinate, or an unrecognized `handedness` (anything other
 *   than the literal `"left"`/`"right"`) is unrecoverable for that hand:
 *   the whole hand is dropped from the frame.
 * - An in-range-but-out-of-bounds `confidence` (finite, but < 0 or > 1)
 *   is recoverable: it is clamped into [0, 1] rather than dropping the
 *   hand.
 * - If, after per-hand validation, more than `MAX_HANDS_PER_FRAME` hands
 *   remain, the extras are dropped (lowest-confidence hands first) so
 *   downstream consumers never see an unbounded hand list.
 *
 * The frame itself is never rejected outright — `timestamp` and `events`
 * pass through unchanged, and `hands` is replaced with the sanitized
 * list. This keeps a single malformed hand from discarding an otherwise
 * good frame's events (e.g. a `handAppear` for a different, valid hand).
 */
import { HAND_LANDMARK_COUNT, MAX_HANDS_PER_FRAME, type Hand, type TrackingFrame } from './types';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidHand(hand: Hand): boolean {
  if (hand.handedness !== 'left' && hand.handedness !== 'right') return false;
  if (!isFiniteNumber(hand.confidence)) return false;
  if (hand.landmarks.length !== HAND_LANDMARK_COUNT) return false;
  return hand.landmarks.every(
    (landmark) =>
      isFiniteNumber(landmark.x) && isFiniteNumber(landmark.y) && isFiniteNumber(landmark.z),
  );
}

function clampConfidence(hand: Hand): Hand {
  const clamped = Math.min(1, Math.max(0, hand.confidence));
  return clamped === hand.confidence ? hand : { ...hand, confidence: clamped };
}

/** Applies the malformed-data rule documented above to `frame.hands`,
 * returning a new `TrackingFrame`. `frame.timestamp` and `frame.events`
 * are passed through unchanged. */
export function sanitizeFrame(frame: TrackingFrame): TrackingFrame {
  const validHands = frame.hands.filter(isValidHand).map(clampConfidence);

  const hands =
    validHands.length > MAX_HANDS_PER_FRAME
      ? [...validHands].sort((a, b) => b.confidence - a.confidence).slice(0, MAX_HANDS_PER_FRAME)
      : validHands;

  return { timestamp: frame.timestamp, hands, events: frame.events };
}

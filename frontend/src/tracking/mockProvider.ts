/**
 * Task 27: a deterministic `TrackingProvider` implementation with no
 * camera, no MediaPipe dependency, and no wall-clock timer. It plays back
 * a scripted, caller-supplied sequence of frames and errors one entry at
 * a time, advanced explicitly by calling `advance()` — never on an
 * interval/`setTimeout`/`requestAnimationFrame` — so tests (in this
 * module, and in Task 30/32/33) get fully deterministic, synchronous
 * control over what the provider emits and when.
 *
 * Every emitted frame is passed through `sanitizeFrame` first, exactly
 * as a real provider is expected to, so a script can also be used to
 * exercise the malformed-data rule end-to-end.
 */
import { sanitizeFrame } from './sanitizeFrame';
import type { TrackingFrame, TrackingProvider, TrackingProviderError, Unsubscribe } from './types';

/** One entry in a mock provider's script: either a frame or an error to
 * emit, in order, one per `advance()` call. */
export type MockScriptEntry =
  { kind: 'frame'; frame: TrackingFrame } | { kind: 'error'; error: TrackingProviderError };

export interface MockTrackingProvider extends TrackingProvider {
  /** Emits the next scripted entry (a frame to `onFrame` listeners, or an
   * error to `onError` listeners) and advances the internal cursor.
   * A no-op — returns `false`, emits nothing — when the provider isn't
   * currently started, or the script is exhausted. Returns `true` when
   * an entry was emitted. */
  advance(): boolean;
  /** The number of scripted entries not yet emitted. */
  remaining(): number;
}

/**
 * Creates a mock `TrackingProvider` that plays back `script` in order.
 * The cursor (how much of `script` has been played back) resets to the
 * start whenever `stop()` is called, so a `stop()` followed by `start()`
 * always resumes playback from `script[0]` — matching the "no carryover
 * across a stop/start" lifecycle rule documented on `TrackingProvider`.
 */
export function createMockTrackingProvider(script: MockScriptEntry[]): MockTrackingProvider {
  let started = false;
  let cursor = 0;
  const frameListeners = new Set<(frame: TrackingFrame) => void>();
  const errorListeners = new Set<(error: TrackingProviderError) => void>();

  function start(): void {
    // Idempotent: a second start() while already started must not
    // register anything twice or reset/advance the script.
    if (started) return;
    started = true;
  }

  function stop(): void {
    // Safe (never throws) whether or not the provider was ever started,
    // and idempotent when already stopped.
    started = false;
    cursor = 0;
  }

  function onFrame(listener: (frame: TrackingFrame) => void): Unsubscribe {
    frameListeners.add(listener);
    return () => frameListeners.delete(listener);
  }

  function onError(listener: (error: TrackingProviderError) => void): Unsubscribe {
    errorListeners.add(listener);
    return () => errorListeners.delete(listener);
  }

  function advance(): boolean {
    if (!started) return false;
    if (cursor >= script.length) return false;
    const entry = script[cursor];
    cursor += 1;
    if (entry.kind === 'frame') {
      const sanitized = sanitizeFrame(entry.frame);
      for (const listener of frameListeners) listener(sanitized);
    } else {
      for (const listener of errorListeners) listener(entry.error);
    }
    return true;
  }

  function remaining(): number {
    return Math.max(0, script.length - cursor);
  }

  return { start, stop, onFrame, onError, advance, remaining };
}

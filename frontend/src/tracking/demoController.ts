/**
 * Task 28: combines the manual provider (`manualProvider.ts`) and the
 * scripted playback provider (`demoPlaybackScript.ts` played back through
 * `mockProvider.ts`) into one `TrackingProvider`-shaped controller that a
 * `DemoControlsPanel` can drive. Exactly one of "manual" or "playback" is
 * active at a time; switching modes only calls `start()`/`stop()` on the
 * two underlying providers (never a frame-emitting setter or `advance()`),
 * so switching modes — or starting/stopping the controller itself — never
 * emits a frame or event by itself (Task 28 acceptance criterion:
 * "Starting playback, stopping playback, and switching back to manual
 * controls do not emit unintended events"). A frame only ever goes out
 * because a caller explicitly set a manual control or advanced playback.
 *
 * No camera API and no MediaPipe import anywhere in this module or the two
 * providers it composes, so it works identically when both are
 * unavailable (Task 28 acceptance criterion).
 */
import { createDemoPlaybackScript } from './demoPlaybackScript';
import { createManualTrackingProvider } from './manualProvider';
import type {
  ManualControlState,
  ManualSignalName,
  ManualTrackingProvider,
} from './manualProvider';
import { createMockTrackingProvider } from './mockProvider';
import type { MockTrackingProvider } from './mockProvider';
import type {
  GestureName,
  TrackingFrame,
  TrackingProvider,
  TrackingProviderError,
  Unsubscribe,
} from './types';

export type DemoMode = 'manual' | 'playback';

export interface DemoTrackingController extends TrackingProvider {
  getMode(): DemoMode;
  /** Switches which underlying provider is active. A no-op if `mode` is
   * already current. Never emits a frame or event (see module doc
   * comment). */
  setMode(mode: DemoMode): void;
  setSignal(name: ManualSignalName, value: number): void;
  setPresent(present: boolean): void;
  setGesture(gesture: GestureName | null): void;
  emitPinchStart(): void;
  emitPinchEnd(): void;
  getManualState(): ManualControlState;
  /** Plays back the next scripted entry. A no-op (returns `false`) unless
   * the controller is started and in `'playback'` mode. */
  advancePlayback(): boolean;
  /** The number of scripted playback entries not yet emitted. */
  remainingPlayback(): number;
  /** Total number of entries in the playback script, for progress
   * display. */
  totalPlaybackEntries(): number;
  /** Rewinds playback to the start of the script without emitting
   * anything, so a caller (e.g. a "Reset" button) can restart the
   * sequence from a clean, deterministic beginning. */
  resetPlayback(): void;
}

/** Creates a fresh `DemoTrackingController`. Each call builds its own
 * manual provider and its own playback provider (running its own copy of
 * `createDemoPlaybackScript()`), so multiple controllers never share
 * state. */
export function createDemoTrackingController(): DemoTrackingController {
  let mode: DemoMode = 'manual';
  let started = false;

  const manual: ManualTrackingProvider = createManualTrackingProvider();
  let playback: MockTrackingProvider = createMockTrackingProvider(createDemoPlaybackScript());

  const frameListeners = new Set<(frame: TrackingFrame) => void>();
  const errorListeners = new Set<(error: TrackingProviderError) => void>();

  manual.onFrame((frame) => {
    for (const listener of frameListeners) listener(frame);
  });
  manual.onError((error) => {
    for (const listener of errorListeners) listener(error);
  });
  playback.onFrame((frame) => {
    for (const listener of frameListeners) listener(frame);
  });
  playback.onError((error) => {
    for (const listener of errorListeners) listener(error);
  });

  // Starts/stops each underlying provider to match `started`/`mode`. Only
  // ever calls the two providers' own idempotent, non-emitting
  // start()/stop() — see the module doc comment for why that matters.
  function syncProviders(): void {
    if (started && mode === 'manual') {
      manual.start();
      playback.stop();
    } else if (started && mode === 'playback') {
      playback.start();
      manual.stop();
    } else {
      manual.stop();
      playback.stop();
    }
  }

  function start(): void {
    if (started) return;
    started = true;
    syncProviders();
  }

  function stop(): void {
    started = false;
    syncProviders();
  }

  function onFrame(listener: (frame: TrackingFrame) => void): Unsubscribe {
    frameListeners.add(listener);
    return () => frameListeners.delete(listener);
  }

  function onError(listener: (error: TrackingProviderError) => void): Unsubscribe {
    errorListeners.add(listener);
    return () => errorListeners.delete(listener);
  }

  function getMode(): DemoMode {
    return mode;
  }

  function setMode(next: DemoMode): void {
    if (next === mode) return;
    mode = next;
    syncProviders();
  }

  function setSignal(name: ManualSignalName, value: number): void {
    manual.setSignal(name, value);
  }

  function setPresent(present: boolean): void {
    manual.setPresent(present);
  }

  function setGesture(gesture: GestureName | null): void {
    manual.setGesture(gesture);
  }

  function emitPinchStart(): void {
    manual.emitPinchStart();
  }

  function emitPinchEnd(): void {
    manual.emitPinchEnd();
  }

  function getManualState(): ManualControlState {
    return manual.getState();
  }

  function advancePlayback(): boolean {
    if (mode !== 'playback') return false;
    return playback.advance();
  }

  function remainingPlayback(): number {
    return playback.remaining();
  }

  function totalPlaybackEntries(): number {
    return createDemoPlaybackScript().length;
  }

  function resetPlayback(): void {
    // Rebuild a fresh playback provider (own cursor reset to 0) rather
    // than relying on stop()/start() timing, and re-wire its listeners to
    // the same forwarding functions so no frame is ever lost or
    // duplicated across the swap. Never emits anything itself.
    const wasActive = started && mode === 'playback';
    playback.stop();
    playback = createMockTrackingProvider(createDemoPlaybackScript());
    playback.onFrame((frame) => {
      for (const listener of frameListeners) listener(frame);
    });
    playback.onError((error) => {
      for (const listener of errorListeners) listener(error);
    });
    if (wasActive) playback.start();
  }

  return {
    start,
    stop,
    onFrame,
    onError,
    getMode,
    setMode,
    setSignal,
    setPresent,
    setGesture,
    emitPinchStart,
    emitPinchEnd,
    getManualState,
    advancePlayback,
    remainingPlayback,
    totalPlaybackEntries,
    resetPlayback,
  };
}

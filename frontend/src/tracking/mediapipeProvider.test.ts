/**
 * Task 30 tests. Every MediaPipe/camera boundary is mocked — no real
 * camera, no real `@mediapipe/tasks-vision` download, and no real
 * `requestAnimationFrame`/wall clock — so this suite runs fully offline
 * and deterministically, driven by manually invoking the captured
 * `requestFrame` callback and advancing a fake clock.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  createMediaPipeTrackingProvider,
  GESTURE_RECOGNIZER_MODEL_URL,
  MEDIAPIPE_WASM_BASE_URL,
  type MediaPipeTrackingProviderDeps,
} from './mediapipeProvider';
import { MAX_HANDS_PER_FRAME, type TrackingFrame, type TrackingProviderError } from './types';

type FakeTrack = { stop: ReturnType<typeof vi.fn> };
type FakeStream = { getTracks: () => FakeTrack[] };

function createFakeStream(trackCount = 1): { stream: FakeStream; tracks: FakeTrack[] } {
  const tracks = Array.from({ length: trackCount }, () => ({ stop: vi.fn() }));
  return { stream: { getTracks: () => tracks }, tracks };
}

function createFakeVideo(): HTMLVideoElement {
  const video = {
    muted: false,
    playsInline: false,
    srcObject: null as MediaStream | null,
    readyState: 2, // HAVE_CURRENT_DATA, so the throttle loop treats it as ready
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  };
  return video as unknown as HTMLVideoElement;
}

type RecognizeResult = {
  landmarks: { x: number; y: number; z: number }[][];
  handedness: { categoryName: string; score: number }[][];
  gestures: { categoryName: string }[][];
};

function emptyResult(): RecognizeResult {
  return { landmarks: [], handedness: [], gestures: [] };
}

function oneHandResult(
  overrides: {
    handedness?: 'Left' | 'Right';
    score?: number;
    gesture?: string;
  } = {},
): RecognizeResult {
  const landmarkPoint = { x: 0.5, y: 0.5, z: 0 };
  return {
    landmarks: [Array.from({ length: 21 }, () => ({ ...landmarkPoint }))],
    handedness: [
      [{ categoryName: overrides.handedness ?? 'Right', score: overrides.score ?? 0.95 }],
    ],
    gestures: [[{ categoryName: overrides.gesture ?? 'None' }]],
  };
}

/** Builds a full dependency set with sensible defaults and captures the
 * bits tests need direct control over: the `requestFrame` callback (so a
 * test can invoke it manually as a "tick"), a mutable fake clock, and the
 * mocked recognizer/module functions. */
function createHarness(
  overrides: {
    getUserMedia?: MediaPipeTrackingProviderDeps['getUserMedia'];
    isSupported?: MediaPipeTrackingProviderDeps['isSupported'];
    loadVisionTasksModule?: MediaPipeTrackingProviderDeps['loadVisionTasksModule'];
  } = {},
) {
  const { stream, tracks } = createFakeStream();
  const video = createFakeVideo();
  const getUserMedia = overrides.getUserMedia ?? vi.fn().mockResolvedValue(stream);

  let clock = 0;
  const now = vi.fn(() => clock);

  let capturedTick: (() => void) | null = null;
  let nextHandle = 1;
  const requestFrame = vi.fn((callback: () => void) => {
    capturedTick = callback;
    return nextHandle++;
  });
  const cancelFrame = vi.fn();

  const recognizeForVideo = vi.fn().mockReturnValue(emptyResult());
  const close = vi.fn();
  const recognizer = { recognizeForVideo, close };

  const createFromOptions = vi.fn().mockResolvedValue(recognizer);
  const forVisionTasks = vi.fn().mockResolvedValue({ fake: 'fileset' });

  const loadVisionTasksModule =
    overrides.loadVisionTasksModule ??
    vi.fn().mockResolvedValue({
      FilesetResolver: { forVisionTasks },
      GestureRecognizer: { createFromOptions },
    });

  const deps: MediaPipeTrackingProviderDeps = {
    getUserMedia: getUserMedia as MediaPipeTrackingProviderDeps['getUserMedia'],
    createVideoElement: () => video,
    now,
    requestFrame,
    cancelFrame,
    isSupported: overrides.isSupported ?? (() => true),
    loadVisionTasksModule,
  };

  const provider = createMediaPipeTrackingProvider(deps);
  const frames: TrackingFrame[] = [];
  const errors: TrackingProviderError[] = [];
  provider.onFrame((frame) => frames.push(frame));
  provider.onError((error) => errors.push(error));

  async function flushMicrotasks(): Promise<void> {
    // Several `await`s deep in the async start pipeline; a handful of
    // microtask turns reliably drains them all.
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  }

  function tick(): void {
    capturedTick?.();
  }

  function advanceClock(ms: number): void {
    clock += ms;
  }

  return {
    provider,
    frames,
    errors,
    tracks,
    video,
    getUserMedia,
    loadVisionTasksModule,
    forVisionTasks,
    createFromOptions,
    recognizeForVideo,
    close,
    requestFrame,
    cancelFrame,
    flushMicrotasks,
    tick,
    advanceClock,
  };
}

describe('createMediaPipeTrackingProvider lazy loading', () => {
  it('does not call loadVisionTasksModule before start()', () => {
    const { loadVisionTasksModule } = createHarness();
    expect(loadVisionTasksModule).not.toHaveBeenCalled();
  });

  it('loads the vision module, requests the camera, and creates the recognizer with the pinned model/wasm URLs only after start()', async () => {
    const {
      provider,
      getUserMedia,
      loadVisionTasksModule,
      forVisionTasks,
      createFromOptions,
      flushMicrotasks,
    } = createHarness();

    expect(getUserMedia).not.toHaveBeenCalled();
    provider.start();
    await flushMicrotasks();

    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user' }, audio: false });
    expect(loadVisionTasksModule).toHaveBeenCalledTimes(1);
    expect(forVisionTasks).toHaveBeenCalledWith(MEDIAPIPE_WASM_BASE_URL);
    expect(createFromOptions).toHaveBeenCalledWith(
      { fake: 'fileset' },
      expect.objectContaining({
        baseOptions: expect.objectContaining({ modelAssetPath: GESTURE_RECOGNIZER_MODEL_URL }),
        runningMode: 'VIDEO',
        numHands: MAX_HANDS_PER_FRAME,
      }),
    );
  });

  it('start() is idempotent: a second call while starting/running does not re-request the camera', async () => {
    const { provider, getUserMedia, flushMicrotasks } = createHarness();
    provider.start();
    provider.start();
    await flushMicrotasks();
    provider.start();
    await flushMicrotasks();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});

describe('createMediaPipeTrackingProvider contract conversion', () => {
  it('converts a recognizer result into a TrackingFrame without exposing MediaPipe types, including a handAppear event on first sight', async () => {
    const harness = createHarness();
    harness.recognizeForVideo.mockReturnValue(
      oneHandResult({ handedness: 'Right', score: 0.87, gesture: 'None' }),
    );
    harness.provider.start();
    await harness.flushMicrotasks();

    harness.tick();

    expect(harness.frames).toHaveLength(1);
    const frame = harness.frames[0];
    expect(frame.hands).toHaveLength(1);
    expect(frame.hands[0].handedness).toBe('right');
    expect(frame.hands[0].confidence).toBe(0.87);
    expect(frame.hands[0].landmarks).toHaveLength(21);
    expect(frame.events).toEqual([
      { type: 'handAppear', handId: frame.hands[0].id, timestamp: frame.timestamp },
    ]);
  });

  it('emits gestureEnter/gestureExit when the recognized gesture category changes', async () => {
    const harness = createHarness();
    harness.recognizeForVideo.mockReturnValue(oneHandResult({ gesture: 'None' }));
    harness.provider.start();
    await harness.flushMicrotasks();
    harness.tick(); // handAppear frame, no gesture

    harness.advanceClock(100);
    harness.recognizeForVideo.mockReturnValue(oneHandResult({ gesture: 'Open_Palm' }));
    harness.tick();
    const secondFrame = harness.frames[1];
    expect(secondFrame.events).toEqual([
      {
        type: 'gestureEnter',
        handId: secondFrame.hands[0].id,
        gesture: 'openPalm',
        timestamp: secondFrame.timestamp,
      },
    ]);

    harness.advanceClock(100);
    harness.recognizeForVideo.mockReturnValue(oneHandResult({ gesture: 'Victory' }));
    harness.tick();
    const thirdFrame = harness.frames[2];
    expect(thirdFrame.events).toEqual([
      {
        type: 'gestureExit',
        handId: thirdFrame.hands[0].id,
        gesture: 'openPalm',
        timestamp: thirdFrame.timestamp,
      },
      {
        type: 'gestureEnter',
        handId: thirdFrame.hands[0].id,
        gesture: 'victory',
        timestamp: thirdFrame.timestamp,
      },
    ]);
  });

  it('emits handDisappear (and gestureExit for an active gesture) once a hand is no longer reported, and never reuses its id', async () => {
    const harness = createHarness();
    harness.recognizeForVideo.mockReturnValue(oneHandResult({ gesture: 'Closed_Fist' }));
    harness.provider.start();
    await harness.flushMicrotasks();
    harness.tick();
    const firstHandId = harness.frames[0].hands[0].id;

    harness.advanceClock(100);
    harness.recognizeForVideo.mockReturnValue(emptyResult());
    harness.tick();
    const disappearFrame = harness.frames[1];
    expect(disappearFrame.hands).toHaveLength(0);
    expect(disappearFrame.events).toEqual([
      {
        type: 'gestureExit',
        handId: firstHandId,
        gesture: 'closedFist',
        timestamp: disappearFrame.timestamp,
      },
      { type: 'handDisappear', handId: firstHandId, timestamp: disappearFrame.timestamp },
    ]);

    harness.advanceClock(100);
    harness.recognizeForVideo.mockReturnValue(oneHandResult({ gesture: 'None' }));
    harness.tick();
    const reappearFrame = harness.frames[2];
    expect(reappearFrame.hands[0].id).not.toBe(firstHandId);
    expect(reappearFrame.events).toEqual([
      { type: 'handAppear', handId: reappearFrame.hands[0].id, timestamp: reappearFrame.timestamp },
    ]);
  });
});

describe('createMediaPipeTrackingProvider throttling', () => {
  it('does not call recognizeForVideo more than once per documented minimum interval', async () => {
    const harness = createHarness();
    harness.provider.start();
    await harness.flushMicrotasks();

    harness.tick();
    expect(harness.recognizeForVideo).toHaveBeenCalledTimes(1);

    // Well under the 1000/30ms throttle interval: should be skipped.
    harness.advanceClock(5);
    harness.tick();
    expect(harness.recognizeForVideo).toHaveBeenCalledTimes(1);

    // Past the throttle interval: should run again.
    harness.advanceClock(40);
    harness.tick();
    expect(harness.recognizeForVideo).toHaveBeenCalledTimes(2);
  });

  it('never overlaps inference calls, even if a listener re-enters the tick synchronously', async () => {
    const harness = createHarness();
    let reentered = false;
    harness.recognizeForVideo.mockImplementation(() => {
      if (!reentered) {
        reentered = true;
        harness.tick(); // simulate an overlapping tick while inference is "in flight"
      }
      return emptyResult();
    });

    harness.provider.start();
    await harness.flushMicrotasks();
    harness.tick();

    expect(harness.recognizeForVideo).toHaveBeenCalledTimes(1);
  });

  it('keeps scheduling ticks after start', async () => {
    const harness = createHarness();
    harness.provider.start();
    await harness.flushMicrotasks();
    const callsAfterStart = harness.requestFrame.mock.calls.length;
    harness.tick();
    expect(harness.requestFrame.mock.calls.length).toBe(callsAfterStart + 1);
  });
});

describe('createMediaPipeTrackingProvider cleanup', () => {
  it('stop() releases camera tracks, cancels the pending animation frame, and closes the recognizer', async () => {
    const harness = createHarness();
    harness.provider.start();
    await harness.flushMicrotasks();
    harness.tick();

    harness.provider.stop();

    for (const track of harness.tracks) expect(track.stop).toHaveBeenCalled();
    expect(harness.video.pause).toHaveBeenCalled();
    expect(harness.video.srcObject).toBeNull();
    expect(harness.close).toHaveBeenCalled();
    expect(harness.cancelFrame).toHaveBeenCalled();
  });

  it('stop() before start() and a repeated stop() never throw', () => {
    const harness = createHarness();
    expect(() => harness.provider.stop()).not.toThrow();
    expect(() => harness.provider.stop()).not.toThrow();
  });

  it('stop() called while the async start pipeline is still pending releases whatever was already acquired', async () => {
    const harness = createHarness();
    harness.provider.start();
    // Stop before getUserMedia's promise has resolved.
    harness.provider.stop();
    await harness.flushMicrotasks();

    for (const track of harness.tracks) expect(track.stop).toHaveBeenCalled();
    expect(harness.close).not.toHaveBeenCalled(); // recognizer was never reached/created
  });

  it('stop() then start() again resumes from a clean slate: no stale hand id carries over', async () => {
    const harness = createHarness();
    harness.recognizeForVideo.mockReturnValue(oneHandResult());
    harness.provider.start();
    await harness.flushMicrotasks();
    harness.tick();
    const firstHandId = harness.frames[0].hands[0].id;

    harness.provider.stop();
    harness.provider.start();
    await harness.flushMicrotasks();
    harness.tick();

    const secondHandId = harness.frames[1].hands[0].id;
    expect(secondHandId).not.toBe(firstHandId);
    // No handDisappear leaked across the stop/start boundary either.
    expect(harness.frames[1].events).toEqual([
      { type: 'handAppear', handId: secondHandId, timestamp: harness.frames[1].timestamp },
    ]);
  });
});

describe('createMediaPipeTrackingProvider onStream (Task 110, issue #141)', () => {
  it('emits the acquired camera stream once getUserMedia resolves, before the recognizer is ready', async () => {
    const harness = createHarness();
    const streams: (MediaStream | null)[] = [];
    harness.provider.onStream?.((stream) => streams.push(stream));

    harness.provider.start();
    await harness.flushMicrotasks();

    expect(streams).toHaveLength(1);
    expect(streams[0]).not.toBeNull();
  });

  it('emits null once stop() releases the stream', async () => {
    const harness = createHarness();
    const streams: (MediaStream | null)[] = [];
    harness.provider.onStream?.((stream) => streams.push(stream));

    harness.provider.start();
    await harness.flushMicrotasks();
    harness.provider.stop();

    expect(streams).toEqual([streams[0], null]);
  });

  it('never emits a stream if getUserMedia rejects', async () => {
    const harness = createHarness({ getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) });
    const streams: (MediaStream | null)[] = [];
    harness.provider.onStream?.((stream) => streams.push(stream));

    harness.provider.start();
    await harness.flushMicrotasks();

    expect(streams).toEqual([]);
  });

  it('a listener registered after stop() receives nothing retroactively (no replay)', async () => {
    const harness = createHarness();
    harness.provider.start();
    await harness.flushMicrotasks();
    harness.provider.stop();

    const streams: (MediaStream | null)[] = [];
    harness.provider.onStream?.((stream) => streams.push(stream));
    expect(streams).toEqual([]);
  });

  it('unsubscribing stops further stream notifications', async () => {
    const harness = createHarness();
    const streams: (MediaStream | null)[] = [];
    const unsubscribe = harness.provider.onStream?.((stream) => streams.push(stream));

    harness.provider.start();
    await harness.flushMicrotasks();
    unsubscribe?.();
    harness.provider.stop();

    expect(streams).toEqual([streams[0]]);
  });
});

describe('createMediaPipeTrackingProvider failure routing', () => {
  it('routes unsupported-browser conditions to onError without calling getUserMedia', () => {
    const harness = createHarness({ isSupported: () => false });
    harness.provider.start();

    expect(harness.errors).toHaveLength(1);
    expect(harness.errors[0].message).toMatch(/not supported/i);
    expect(harness.getUserMedia).not.toHaveBeenCalled();
  });

  it('issue #119: the real default isSupported() (no override) correctly detects a missing navigator.mediaDevices', () => {
    // Every other test in this file overrides `isSupported` directly via
    // deps, so `defaultIsSupported()` itself -- the function that actually
    // runs in production -- was never exercised. Stubs the real global
    // `navigator.mediaDevices` (not a deps override) to prove the default
    // detection genuinely works, independent of the real-browser mocking
    // difficulties `publishingAndRemix.spec.ts`'s e2e equivalent ran into
    // (a plain `Object.defineProperty(..., { value: undefined })` either
    // hangs the whole page if some other script tries to reassign it, or
    // -- once made writable -- lets that reassignment quietly restore a
    // working mediaDevices object and defeat the simulation).
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
    try {
      const getUserMedia = vi.fn();
      // Deliberately omits `isSupported` (unlike `createHarness`, which
      // always supplies one) so `resolveDeps` falls through to the real
      // `defaultIsSupported()`.
      const provider = createMediaPipeTrackingProvider({ getUserMedia });
      const errors: TrackingProviderError[] = [];
      provider.onError((error) => errors.push(error));

      provider.start();

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toMatch(/not supported/i);
      expect(getUserMedia).not.toHaveBeenCalled();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(navigator, 'mediaDevices', originalDescriptor);
      }
    }
  });

  it('routes a camera permission/hardware failure to onError', async () => {
    const cause = new Error('Permission denied');
    const harness = createHarness({ getUserMedia: vi.fn().mockRejectedValue(cause) });
    harness.provider.start();
    await harness.flushMicrotasks();

    expect(harness.errors).toHaveLength(1);
    expect(harness.errors[0].cause).toBe(cause);
    expect(harness.errors[0].message).toMatch(/camera/i);
  });

  it('routes a video playback failure to onError and releases the acquired camera stream', async () => {
    const harness = createHarness();
    const playError = new Error('NotAllowedError');
    (harness.video.play as ReturnType<typeof vi.fn>).mockRejectedValue(playError);

    harness.provider.start();
    await harness.flushMicrotasks();

    expect(harness.errors).toHaveLength(1);
    expect(harness.errors[0].cause).toBe(playError);
    for (const track of harness.tracks) expect(track.stop).toHaveBeenCalled();
  });

  it('routes a MediaPipe module load failure to onError', async () => {
    const loadError = new Error('network error');
    const harness = createHarness({ loadVisionTasksModule: vi.fn().mockRejectedValue(loadError) });
    harness.provider.start();
    await harness.flushMicrotasks();

    expect(harness.errors).toHaveLength(1);
    expect(harness.errors[0].cause).toBe(loadError);
    expect(harness.errors[0].message).toMatch(/module/i);
  });

  it('routes a recognizer/model creation failure to onError', async () => {
    const harness = createHarness();
    const modelError = new Error('model fetch failed');
    harness.createFromOptions.mockRejectedValue(modelError);
    harness.provider.start();
    await harness.flushMicrotasks();

    expect(harness.errors).toHaveLength(1);
    expect(harness.errors[0].cause).toBe(modelError);
    expect(harness.errors[0].message).toMatch(/model/i);
  });

  it('routes a per-frame inference failure to onError without crashing, and keeps ticking afterward', async () => {
    const harness = createHarness();
    const inferenceError = new Error('inference failed');
    harness.recognizeForVideo.mockImplementationOnce(() => {
      throw inferenceError;
    });
    harness.provider.start();
    await harness.flushMicrotasks();

    expect(() => harness.tick()).not.toThrow();
    expect(harness.errors).toHaveLength(1);
    expect(harness.errors[0].cause).toBe(inferenceError);
    expect(harness.frames).toHaveLength(0);

    // A later, healthy tick still works — one failed frame doesn't kill
    // the loop.
    harness.advanceClock(40);
    harness.recognizeForVideo.mockReturnValue(emptyResult());
    harness.tick();
    expect(harness.frames).toHaveLength(1);
  });
});

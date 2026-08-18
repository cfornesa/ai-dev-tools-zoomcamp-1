/**
 * Task 57 (issue #56): functional smoke tests that actually *run* the
 * exported camera module's script (`standaloneCameraSource.ts`) in a
 * jsdom sandbox with mocked `getUserMedia`/MediaPipe -- never a real
 * camera or network call -- exercising the lifecycle rules issue #56
 * requires: lazy start, visible+programmatic active state, full cleanup
 * on stop, per-category failure messages, demo controls staying usable
 * throughout, and no resource leaks across repeated enable/stop cycles.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SceneDocument } from '../api/projects';
import { generateHtmlExport } from './generateHtmlExport';

/** Every `DOMContentLoaded` listener registered by an `eval`'d script
 * during this test file's run, tracked so the `afterEach` below can
 * remove them -- otherwise each test's fresh `eval` of the same runtime/
 * camera scripts would leave its listener permanently attached to the
 * shared jsdom `document`, and the *next* test's `dispatchEvent` would
 * re-invoke every prior test's now-stale listener too (duplicate
 * controllers/UI, duplicate `getUserMedia` calls) -- a test-harness leak,
 * not a leak in the code under test. */
const trackedDOMContentLoadedListeners: EventListenerOrEventListenerObject[] = [];

afterEach(() => {
  trackedDOMContentLoadedListeners.forEach((listener) => {
    document.removeEventListener('DOMContentLoaded', listener);
  });
  trackedDOMContentLoadedListeners.length = 0;
  document.body.innerHTML = '';
});

function baseScene(): SceneDocument {
  return {
    schemaVersion: 1,
    id: 'scene-1',
    canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
    renderer: { preferred: 'p5' },
    layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
    shapes: [
      {
        id: 'shape-1',
        type: 'circle',
        layerId: 'layer-1',
        groupId: null,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
        style: { fill: '#ff0000', stroke: null, strokeWidth: 0 },
        radius: 40,
      },
    ],
    groups: [],
    bindings: [],
    graph: { nodes: [], connections: [] },
    accessibility: { reducedMotion: 'off' },
    randomness: { seed: 0, enabled: false },
  };
}

/** Installs a fake p5 global (same minimal shape the demo runtime test
 * uses) so the runtime script's DOMContentLoaded handler doesn't throw
 * when it tries to construct a `window.p5` instance. */
function installFakeP5() {
  class FakeP5 {
    setup?: () => void;
    draw?: () => void;
    constructor(sketch: (p: FakeP5) => void) {
      sketch(this);
      this.createCanvas();
      if (this.setup) this.setup();
    }
    createCanvas() {
      return { parent: () => {} };
    }
    pixelDensity() {}
    noSmooth() {}
    frameRate() {}
    millis() {
      return 0;
    }
    push() {}
    pop() {}
    translate() {}
    rotate() {}
    radians(deg: number) {
      return (deg * Math.PI) / 180;
    }
    scale() {}
    noFill() {}
    fill() {}
    noStroke() {}
    stroke() {}
    strokeWeight() {}
    background() {}
    circle() {}
    rect() {}
    line() {}
    beginShape() {}
    vertex() {}
    endShape() {}
    randomSeed() {}
    noiseSeed() {}
    isLooping() {
      return true;
    }
    loop() {}
    noLoop() {}
    CLOSE = 'close';
  }
  (window as unknown as { p5: unknown }).p5 = FakeP5;
}

/** Builds and executes the camera-inclusive export's runtime + camera
 * scripts inside this test's live jsdom `document`, exactly as a real
 * browser loading the file would, then dispatches `DOMContentLoaded`. */
function loadCameraExportIntoDocument(): void {
  const result = generateHtmlExport({
    scene: baseScene(),
    title: 'Camera Export Test',
    description: 'Exercises the embedded camera module end to end.',
    interactionMode: 'demo-camera',
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  const doc = new DOMParser().parseFromString(result.html, 'text/html');
  document.body.innerHTML = '';
  Array.from(doc.body.children).forEach((node) => {
    if (node.tagName.toLowerCase() !== 'script') {
      document.body.appendChild(node.cloneNode(true));
    }
  });
  const sceneDataScript = doc.getElementById('scene-data');
  const configScript = doc.getElementById('export-config');
  const sceneScriptEl = document.createElement('script');
  sceneScriptEl.type = 'application/json';
  sceneScriptEl.id = 'scene-data';
  sceneScriptEl.textContent = sceneDataScript?.textContent ?? '';
  document.body.appendChild(sceneScriptEl);
  const configScriptEl = document.createElement('script');
  configScriptEl.type = 'application/json';
  configScriptEl.id = 'export-config';
  configScriptEl.textContent = configScript?.textContent ?? '';
  document.body.appendChild(configScriptEl);

  installFakeP5();

  const inlineScripts = Array.from(doc.querySelectorAll('script')).filter(
    (s) => !s.id && !s.hasAttribute('src'),
  );
  expect(inlineScripts).toHaveLength(2);

  const originalAddEventListener = document.addEventListener.bind(document);
  const trackingAddEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    if (type === 'DOMContentLoaded') trackedDOMContentLoadedListeners.push(listener);
    originalAddEventListener(type, listener, options);
  }) as typeof document.addEventListener;
  document.addEventListener = trackingAddEventListener;
  try {
    // eslint-disable-next-line no-eval
    inlineScripts.forEach((s) => (0, eval)(s.textContent ?? ''));
  } finally {
    document.addEventListener = originalAddEventListener;
  }

  document.dispatchEvent(new Event('DOMContentLoaded'));
}

function cameraEnableButton(): HTMLButtonElement {
  const btn = document.querySelector('[data-testid="camera-enable"]');
  expect(btn).not.toBeNull();
  return btn as HTMLButtonElement;
}
function cameraStopButton(): HTMLButtonElement {
  const btn = document.querySelector('[data-testid="camera-stop"]');
  expect(btn).not.toBeNull();
  return btn as HTMLButtonElement;
}
function cameraStatusEl(): HTMLElement {
  const el = document.querySelector('[data-testid="camera-status"]');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}
function cameraErrorEl(): HTMLElement {
  const el = document.querySelector('[data-testid="camera-error"]');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

function expectDemoControlsUsable(): void {
  const demoButtons = document.getElementById('demo-controls-host')?.querySelectorAll('button');
  expect(demoButtons?.length ?? 0).toBeGreaterThan(0);
  demoButtons?.forEach((btn) => expect((btn as HTMLButtonElement).disabled).toBe(false));
}

type FakeGestureRecognizer = {
  recognizeForVideo: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

/** Installs `window.__exportCameraLoadVisionTasksModule` (the test seam
 * `standaloneCameraSource.ts` checks before falling back to a real dynamic
 * `import()` of the CDN bundle -- see that module's `loadModel`) so tests
 * can drive the model-load and inference path with a fully fake MediaPipe
 * module, never a real network request. Returns the list of every fake
 * recognizer instance `createFromOptions` has produced, in creation order,
 * so a test can assert exactly how many were created and that each was
 * closed the expected number of times. */
function installFakeMediaPipeModule(options: {
  failFilesetResolver?: boolean;
  failCreateRecognizer?: boolean;
}): FakeGestureRecognizer[] {
  const createdRecognizers: FakeGestureRecognizer[] = [];
  const loadVisionTasksModule = vi.fn().mockImplementation(() => {
    return Promise.resolve({
      FilesetResolver: {
        forVisionTasks: vi.fn().mockImplementation(() => {
          if (options.failFilesetResolver) return Promise.reject(new Error('fileset load failed'));
          return Promise.resolve({});
        }),
      },
      GestureRecognizer: {
        createFromOptions: vi.fn().mockImplementation(() => {
          if (options.failCreateRecognizer) {
            return Promise.reject(new Error('recognizer creation failed'));
          }
          const recognizer: FakeGestureRecognizer = {
            recognizeForVideo: vi
              .fn()
              .mockReturnValue({ landmarks: [], gestures: [], handedness: [] }),
            close: vi.fn(),
          };
          createdRecognizers.push(recognizer);
          return Promise.resolve(recognizer);
        }),
      },
    });
  });
  (
    window as unknown as { __exportCameraLoadVisionTasksModule?: () => Promise<unknown> }
  ).__exportCameraLoadVisionTasksModule = loadVisionTasksModule;
  return createdRecognizers;
}

function clearFakeMediaPipeModule(): void {
  delete (window as unknown as { __exportCameraLoadVisionTasksModule?: unknown })
    .__exportCameraLoadVisionTasksModule;
}

/** Makes every `<video>` element report `readyState >= HAVE_CURRENT_DATA`
 * (2) -- `onAnimationFrame`'s throttled-inference guard requires this
 * before it will call `recognizeForVideo`, and jsdom's real `<video>`
 * elements never advance past `readyState === 0` on their own (no real
 * media pipeline). Restored via `restore()` so it doesn't leak into other
 * test files sharing the same jsdom environment. */
function mockVideoReadyState(readyState: number): { restore: () => void } {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'readyState');
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
    configurable: true,
    get: () => readyState,
  });
  return {
    restore: () => {
      if (descriptor) Object.defineProperty(HTMLMediaElement.prototype, 'readyState', descriptor);
    },
  };
}

/** A deterministic, manually-driven stand-in for
 * `window.requestAnimationFrame`/`cancelAnimationFrame`: `flush()` invokes
 * every currently-pending callback (and clears them first, matching a real
 * browser draining one frame's worth of callbacks), and `pendingCount()`
 * reports how many scheduled callbacks are still outstanding -- used to
 * assert `stop()` cancels the in-flight tick rather than leaving it to
 * fire later against torn-down state. */
function installDeterministicAnimationFrame(): {
  flush: () => void;
  pendingCount: () => number;
  requestSpy: ReturnType<typeof vi.fn>;
  cancelSpy: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const originalRequest = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  const requestSpy = vi.fn((cb: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  });
  const cancelSpy = vi.fn((id: number) => {
    pending.delete(id);
  });
  window.requestAnimationFrame = requestSpy as unknown as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = cancelSpy as unknown as typeof window.cancelAnimationFrame;
  return {
    flush: () => {
      const callbacks = Array.from(pending.values());
      pending.clear();
      callbacks.forEach((cb) => cb(performance.now()));
    },
    pendingCount: () => pending.size,
    requestSpy,
    cancelSpy,
    restore: () => {
      window.requestAnimationFrame = originalRequest;
      window.cancelAnimationFrame = originalCancel;
    },
  };
}

function resolvedStream(trackStop: ReturnType<typeof vi.fn>): MediaStream {
  return { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
}

describe('camera export runtime: lazy activation and pre-activation state', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });

  it('never calls getUserMedia or dynamically imports MediaPipe before Enable camera is clicked', () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    loadCameraExportIntoDocument();

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(cameraStatusEl().textContent).toBe('');
    expect(cameraStopButton().style.display).toBe('none');
    expect(cameraEnableButton().style.display).not.toBe('none');
  });

  it('renders the demo controls host fully populated, independent of camera state', () => {
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    });
    loadCameraExportIntoDocument();
    const demoHost = document.getElementById('demo-controls-host');
    expect(demoHost).not.toBeNull();
    expect(demoHost?.querySelector('button')).not.toBeNull();
  });
});

describe('camera export runtime: failure classification', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });

  it('shows the insecure-context message and never touches getUserMedia when window.isSecureContext is false', () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    const getUserMedia = vi.fn();
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    loadCameraExportIntoDocument();
    cameraEnableButton().dispatchEvent(new Event('click', { bubbles: true }));

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(cameraErrorEl().textContent).toMatch(/secure connection \(HTTPS\)/i);
    // Demo controls remain usable.
    expect(document.getElementById('demo-controls-host')?.querySelector('button')).not.toBeNull();
  });

  it('shows the unsupported-browser message when mediaDevices.getUserMedia is missing', () => {
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    });

    loadCameraExportIntoDocument();
    cameraEnableButton().dispatchEvent(new Event('click', { bubbles: true }));

    expect(cameraErrorEl().textContent).toMatch(/doesn't support the camera/i);
  });

  it('shows the permission-denied message for a NotAllowedError rejection', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    loadCameraExportIntoDocument();
    cameraEnableButton().dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() =>
      expect(cameraErrorEl().textContent).toMatch(/camera access was denied/i),
    );
  });

  it('shows the missing-device message for a NotFoundError rejection', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('none'), { name: 'NotFoundError' }));
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    loadCameraExportIntoDocument();
    cameraEnableButton().dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(cameraErrorEl().textContent).toMatch(/no camera was found/i));
  });

  it('keeps demo controls usable and offers Retry after a permission-denied failure', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    loadCameraExportIntoDocument();
    cameraEnableButton().dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(cameraErrorEl().textContent.length).toBeGreaterThan(0));

    expectDemoControlsUsable();
    // Retry is offered (button relabeled), not just a dead end.
    expect(cameraEnableButton().textContent).toBe('Retry');
  });

  it('shows the model-failure message and keeps demo controls usable when the MediaPipe module/model fails to load', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(resolvedStream(vi.fn()));
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    installFakeMediaPipeModule({ failFilesetResolver: true });

    try {
      loadCameraExportIntoDocument();
      cameraEnableButton().dispatchEvent(new Event('click', { bubbles: true }));

      await vi.waitFor(() =>
        expect(cameraErrorEl().textContent).toMatch(/hand-tracking model could not be loaded/i),
      );
      // The camera "Stop" control isn't left dangling in a starting state.
      expect(cameraStopButton().style.display).toBe('none');
      expect(cameraEnableButton().textContent).toBe('Retry');
      expectDemoControlsUsable();
    } finally {
      clearFakeMediaPipeModule();
    }
  });

  it('shows the tracking-failure message and keeps demo controls usable when inference throws mid-session', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(resolvedStream(vi.fn()));
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    const readyState = mockVideoReadyState(4);
    const raf = installDeterministicAnimationFrame();
    const recognizers = installFakeMediaPipeModule({});

    try {
      loadCameraExportIntoDocument();
      cameraEnableButton().dispatchEvent(new Event('click', { bubbles: true }));

      await vi.waitFor(() => expect(cameraStatusEl().textContent).toMatch(/camera is active/i));
      expect(recognizers).toHaveLength(1);

      // Make the next inference tick throw, then trigger it.
      recognizers[0].recognizeForVideo.mockImplementation(() => {
        throw new Error('inference blew up');
      });
      raf.flush();

      await vi.waitFor(() =>
        expect(cameraErrorEl().textContent).toMatch(/hand tracking stopped unexpectedly/i),
      );
      // The failed session's recognizer/stream/loop were torn down.
      expect(recognizers[0].close).toHaveBeenCalledTimes(1);
      expect(raf.pendingCount()).toBe(0);
      expect(cameraStopButton().style.display).toBe('none');
      expectDemoControlsUsable();
    } finally {
      readyState.restore();
      raf.restore();
      clearFakeMediaPipeModule();
    }
  });
});

describe('camera export runtime: cleanup and repeated cycles', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stop() releases the acquired MediaStreamTrack and does not leak while stalled mid-start', async () => {
    const stop1 = vi.fn();
    const stop2 = vi.fn();
    let call = 0;
    const getUserMedia = vi.fn().mockImplementation(() => {
      call += 1;
      const stopFn = call === 1 ? stop1 : stop2;
      const track = { stop: stopFn };
      return Promise.resolve({
        getTracks: () => [track],
      } as unknown as MediaStream);
    });
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    // jsdom doesn't implement real video playback. Deliberately leave
    // play() forever-pending so the pipeline stalls right after stream
    // acquisition -- this exercises getUserMedia/track acquisition and
    // stop()'s cleanup while starting (never reaching "active"). The
    // *genuinely active* case (recognizer created, inference loop running)
    // is covered separately below, with a real fake MediaPipe module.
    HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => new Promise(() => {}));
    HTMLMediaElement.prototype.pause = vi.fn();

    loadCameraExportIntoDocument();

    // Cycle 1: enable, then stop before it ever reaches "active".
    cameraEnableButton().dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    cameraStopButton().dispatchEvent(new Event('click', { bubbles: true }));
    expect(stop1).toHaveBeenCalledTimes(1);

    // Cycle 2: enable again -- must acquire a *fresh* stream, not reuse a
    // stale one, and must not have any leftover listeners causing a second
    // status update to double-fire (status text isn't asserted here, just
    // that a second, independent getUserMedia call happens cleanly).
    cameraEnableButton().dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    cameraStopButton().dispatchEvent(new Event('click', { bubbles: true }));
    expect(stop2).toHaveBeenCalledTimes(1);

    // Neither cycle's track.stop was called more than once (no duplicate
    // cleanup calls from leaked listeners/timers).
    expect(stop1).toHaveBeenCalledTimes(1);
    expect(stop2).toHaveBeenCalledTimes(1);
  });

  it('genuinely reaches "active" (recognizer created, loop running) twice via Enable→Stop→Enable→Stop, with no duplicate recognizers, listeners, or leftover animation frames', async () => {
    const trackStops = [vi.fn(), vi.fn()];
    let getUserMediaCall = 0;
    const getUserMedia = vi.fn().mockImplementation(() => {
      const stopFn = trackStops[getUserMediaCall];
      getUserMediaCall += 1;
      return Promise.resolve(resolvedStream(stopFn));
    });
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
    const readyState = mockVideoReadyState(4);
    const raf = installDeterministicAnimationFrame();
    const recognizers = installFakeMediaPipeModule({});

    // A probe on top of the actual status-listener registration mechanism
    // (window.__exportCameraTestHooks.controller.onStatus, exposed by
    // standaloneCameraSource.ts purely for tests) -- counts exactly how
    // many times "active" fires. The camera module registers its render()
    // listener exactly once at DOMContentLoaded time (module-scope, not
    // per-click), so this must read exactly 1 per Enable click across both
    // cycles, never more -- a growing count would mean a second listener
    // got registered somewhere and both are now firing.
    let activeCount = 0;

    try {
      loadCameraExportIntoDocument();
      const hooks = (
        window as unknown as {
          __exportCameraTestHooks: { controller: { onStatus: (l: (s: string) => void) => void } };
        }
      ).__exportCameraTestHooks;
      hooks.controller.onStatus((status) => {
        if (status === 'active') activeCount += 1;
      });

      // --- Cycle 1 ---
      cameraEnableButton().dispatchEvent(new Event('click', { bubbles: true }));
      await vi.waitFor(() => expect(cameraStatusEl().textContent).toMatch(/camera is active/i));
      expect(recognizers).toHaveLength(1);
      expect(raf.requestSpy).toHaveBeenCalledTimes(1);
      expect(activeCount).toBe(1);

      // Drive one real inference tick to prove the loop is genuinely
      // running (not just that status flipped optimistically), then it
      // must reschedule itself for the next frame.
      raf.flush();
      expect(recognizers[0].recognizeForVideo).toHaveBeenCalledTimes(1);
      expect(raf.pendingCount()).toBe(1);

      cameraStopButton().dispatchEvent(new Event('click', { bubbles: true }));
      expect(trackStops[0]).toHaveBeenCalledTimes(1);
      expect(recognizers[0].close).toHaveBeenCalledTimes(1);
      // The pending next-frame callback scheduled just before Stop was
      // cancelled, not left to fire later against torn-down state.
      expect(raf.pendingCount()).toBe(0);

      // --- Cycle 2 ---
      cameraEnableButton().dispatchEvent(new Event('click', { bubbles: true }));
      await vi.waitFor(() => expect(cameraStatusEl().textContent).toMatch(/camera is active/i));

      // A genuinely fresh recognizer was created -- not cycle 1's reused.
      expect(recognizers).toHaveLength(2);
      expect(recognizers[1]).not.toBe(recognizers[0]);
      // 3 total requestAnimationFrame calls so far: cycle 1's initial
      // schedule-on-active, cycle 1's flush-triggered reschedule (then
      // cancelled by Stop), and cycle 2's initial schedule-on-active.
      expect(raf.requestSpy).toHaveBeenCalledTimes(3);
      expect(activeCount).toBe(2);

      raf.flush();
      // Only the current (cycle 2) recognizer receives this tick's
      // inference call -- cycle 1's recognizer/loop is fully retired, not
      // still ticking alongside the new one.
      expect(recognizers[1].recognizeForVideo).toHaveBeenCalledTimes(1);
      expect(recognizers[0].recognizeForVideo).toHaveBeenCalledTimes(1);

      cameraStopButton().dispatchEvent(new Event('click', { bubbles: true }));
      expect(trackStops[1]).toHaveBeenCalledTimes(1);
      expect(recognizers[1].close).toHaveBeenCalledTimes(1);
      expect(raf.pendingCount()).toBe(0);

      // Final tally across both full cycles: exactly 2 recognizers were
      // ever created, each closed exactly once (never twice, never left
      // open); exactly 2 tracks were ever acquired, each stopped exactly
      // once; no extra animation frame ever got scheduled beyond the one
      // per cycle's single flushed tick.
      expect(recognizers).toHaveLength(2);
      recognizers.forEach((r) => expect(r.close).toHaveBeenCalledTimes(1));
      trackStops.forEach((s) => expect(s).toHaveBeenCalledTimes(1));
      expect(raf.cancelSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

      expectDemoControlsUsable();
    } finally {
      readyState.restore();
      raf.restore();
      clearFakeMediaPipeModule();
    }
  });

  it('does not call getUserMedia again while already starting (duplicate-click guard)', () => {
    const getUserMedia = vi.fn().mockImplementation(() => new Promise(() => {}));
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    loadCameraExportIntoDocument();
    const enableBtn = cameraEnableButton();
    enableBtn.dispatchEvent(new Event('click', { bubbles: true }));
    enableBtn.dispatchEvent(new Event('click', { bubbles: true }));
    enableBtn.dispatchEvent(new Event('click', { bubbles: true }));

    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});

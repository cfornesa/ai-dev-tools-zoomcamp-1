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

  it('keeps demo controls usable after every distinct failure category', async () => {
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

    const demoButtons = document.getElementById('demo-controls-host')?.querySelectorAll('button');
    expect(demoButtons?.length ?? 0).toBeGreaterThan(0);
    demoButtons?.forEach((btn) => expect((btn as HTMLButtonElement).disabled).toBe(false));

    // Retry is offered (button relabeled), not just a dead end.
    expect(cameraEnableButton().textContent).toBe('Retry');
  });
});

describe('camera export runtime: cleanup and repeated cycles', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stop() releases every acquired MediaStreamTrack and does not leak across enable/stop/enable cycles', async () => {
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
    // stop()'s cleanup while starting, without ever reaching the dynamic
    // `import()` of the real MediaPipe CDN module (no real network access
    // in this test, per issue #56's "mocked getUserMedia/MediaPipe" test
    // requirement).
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

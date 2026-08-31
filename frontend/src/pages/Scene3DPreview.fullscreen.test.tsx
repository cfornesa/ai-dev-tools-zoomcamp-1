import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Scene3DDocument } from './scene3dTypes';

/**
 * Issue #288: "Expand piece to fullscreen" in the shared
 * `Scene3DPreview.tsx`. Mirrors `Scene3DPreview.orbitControls.test.tsx`'s
 * approach of mocking `THREE.WebGLRenderer` to succeed (jsdom has no real
 * WebGL) so the actual component logic runs, plus jsdom's Fullscreen API
 * gap the same way `EditorWorkspace.fullscreen.test.tsx` mocks it.
 */

let resizeObserverCallback: ResizeObserverCallback | null = null;
const setSizeSpy = vi.fn();

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => {
  class FakeOrbitControls {
    target = { set: vi.fn() };
    enableDamping = false;
    listenToKeyEvents = vi.fn();
    update = vi.fn();
    dispose = vi.fn();
  }
  return { OrbitControls: FakeOrbitControls };
});

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    domElement = document.createElement('canvas');
    setSize(width: number, height: number, updateStyle?: boolean) {
      setSizeSpy(width, height, updateStyle);
    }
    getSize(target: { set: (x: number, y: number) => unknown }) {
      return target.set(320, 240);
    }
    render() {}
    dispose() {}
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

const Scene3DPreview = (await import('./Scene3DPreview')).default;

function baseScene(overrides: Partial<Scene3DDocument> = {}): Scene3DDocument {
  return {
    schemaVersion: 1,
    documentType: 'scene3d',
    id: 'scene3d-test',
    scene: { backgroundColor: '#101018' },
    camera: {
      position: { x: 0, y: 0, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
      near: 0.1,
      far: 1000,
    },
    lights: [{ id: 'sun', type: 'ambient', color: '#ffffff', intensity: 1 }],
    groups: [],
    objects: [],
    randomness: { seed: 1, enabled: false },
    ...overrides,
  };
}

function mockFullscreenApi() {
  let current: Element | null = null;
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => current,
  });
  const requestFullscreen = vi.fn(function (this: Element) {
    current = this;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  const exitFullscreen = vi.fn(() => {
    current = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });
  Element.prototype.requestFullscreen =
    requestFullscreen as unknown as typeof Element.prototype.requestFullscreen;
  document.exitFullscreen = exitFullscreen as unknown as typeof document.exitFullscreen;
  return { requestFullscreen, exitFullscreen };
}

beforeEach(() => {
  setSizeSpy.mockClear();
  resizeObserverCallback = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Scene3DPreview "Expand piece to fullscreen" (issue #288)', () => {
  it('toggles real fullscreen on the preview container and reflects it via aria-pressed/label', async () => {
    const mocks = mockFullscreenApi();
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();

    const button = screen.getByRole('button', { name: 'Expand piece to fullscreen' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);

    expect(mocks.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('stays in sync when fullscreen is exited via Escape/browser chrome', async () => {
    mockFullscreenApi();
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Expand piece to fullscreen' }));
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();

    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => null,
      });
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    expect(screen.getByRole('button', { name: 'Expand piece to fullscreen' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('is offered even in the AI-proposal preview (showScreenshotButton=false)', () => {
    mockFullscreenApi();
    render(<Scene3DPreview scene={baseScene()} showScreenshotButton={false} />);

    expect(screen.getByRole('button', { name: 'Expand piece to fullscreen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take screenshot' })).not.toBeInTheDocument();
  });

  it('resizes the renderer when the container size changes (the same path a fullscreen transition drives)', () => {
    mockFullscreenApi();
    const { container } = render(<Scene3DPreview scene={baseScene()} />);
    setSizeSpy.mockClear();

    // Issue #299: the canvas is sized from the fixed-height
    // `.scene3d-preview-canvas-frame` box, not the outer `.scene3d-preview`
    // (which must stay auto-height so it never clips/overlaps its own
    // button row and gesture-control panel -- see Scene3DPreview.tsx's own
    // doc comment) -- so this is the element resize-observed for sizing.
    const previewEl = container.querySelector(
      '[data-testid="scene3d-preview-canvas-frame"]',
    ) as HTMLElement;
    Object.defineProperty(previewEl, 'clientWidth', { configurable: true, value: 1920 });
    Object.defineProperty(previewEl, 'clientHeight', { configurable: true, value: 1080 });

    expect(resizeObserverCallback).not.toBeNull();
    act(() => {
      resizeObserverCallback!([], {} as ResizeObserver);
    });

    expect(setSizeSpy).toHaveBeenCalledWith(1920, 1080, false);
  });
});

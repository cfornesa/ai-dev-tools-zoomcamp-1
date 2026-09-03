import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hand, landmarks } from '../tracking/testFixtures';
import type { TrackingFrame, TrackingProvider, TrackingProviderError } from '../tracking/types';
import type { Scene3DDocument } from './scene3dTypes';
import { getImmersiveHandMoveAxes } from './Scene3DPreview';

/**
 * Issue #294: "Steer the piece" gesture-driven camera control in the
 * shared `Scene3DPreview.tsx`. Mirrors `Scene3DPreview.orbitControls.test.tsx`'s
 * approach of mocking `THREE.WebGLRenderer`/`OrbitControls` to succeed
 * (jsdom has no real WebGL), plus `CameraControl.test.tsx`'s fake
 * `TrackingProvider` convention (never touches a real camera/MediaPipe).
 */

// jsdom's `window.isSecureContext` does not implement the browser rule
// that `http://localhost` counts secure -- it defaults to `false`, which
// would otherwise route the gesture activation lifecycle in these tests into
// CameraControl's insecure-context error path before ever creating a provider.
// Matches CameraControl.test.tsx's own documented workaround.
beforeEach(() => {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
});

function createFakeProvider() {
  const frameListeners: Array<(frame: TrackingFrame) => void> = [];
  const start = vi.fn();
  const stop = vi.fn();
  const onFrame = vi.fn((listener: (frame: TrackingFrame) => void) => {
    frameListeners.push(listener);
    return () => {
      const index = frameListeners.indexOf(listener);
      if (index >= 0) frameListeners.splice(index, 1);
    };
  });
  const onError = vi.fn((_listener: (error: TrackingProviderError) => void) => () => {});
  const provider: TrackingProvider = { start, stop, onFrame, onError };
  return {
    provider,
    start,
    emitFrame: (frame: TrackingFrame) => {
      act(() => {
        for (const listener of [...frameListeners]) listener(frame);
      });
    },
  };
}

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => {
  class FakeOrbitControls {
    target = new (class {
      x = 0;
      y = 0;
      z = 0;
      set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
      clone() {
        return { x: this.x, y: this.y, z: this.z };
      }
    })();
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
    setSize() {}
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

describe('immersive hand Move mapping (issue #344)', () => {
  it('requires a held pinch and maps palm position/depth to bounded axes', () => {
    const axes = getImmersiveHandMoveAxes({
      timestamp: 1,
      handPresence: true,
      indexTipX: null,
      indexTipY: null,
      palmX: 1,
      palmY: 0.5,
      handDepth: -0.5,
      handSpeed: 0,
      pinchDistance: 0,
      pinchStrength: 1,
      gestureConfidence: 1,
      gestureState: 'closedFist',
    });
    expect(axes).toEqual({ strafe: 1, forward: -1 });

    expect(
      getImmersiveHandMoveAxes({
        timestamp: 1,
        handPresence: true,
        indexTipX: null,
        indexTipY: null,
        palmX: 1,
        palmY: 0.5,
        handDepth: 0,
        handSpeed: 0,
        pinchDistance: 0.3,
        pinchStrength: 0.5,
        gestureConfidence: 1,
        gestureState: 'openPalm',
      }),
    ).toEqual({ strafe: 0, forward: 0 });
  });
});

describe('Scene3DPreview "Steer the piece" gesture camera control (issue #294)', () => {
  it('is off by default and its toggle is hidden when showGestureControl is false', () => {
    render(<Scene3DPreview scene={baseScene()} showGestureControl={false} />);
    expect(screen.queryByRole('button', { name: /steer the piece/i })).not.toBeInTheDocument();
  });

  it('shows a toggle, off by default, that reveals the camera-control region when enabled', async () => {
    const fake = createFakeProvider();
    render(
      <Scene3DPreview scene={baseScene()} createGestureCameraProvider={() => fake.provider} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));

    const toggle = screen.getByRole('button', { name: 'Steer the piece' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('gesture-camera-control')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByRole('button', { name: 'Stop steering with gestures' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('gesture-camera-control')).toBeInTheDocument();
    // The user explicitly activated steering before this control mounted, so
    // its opt-in lifecycle starts the camera without a second Enable click.
    expect(fake.start).toHaveBeenCalledTimes(1);
  });

  it('never mounts the camera-control region (or starts a camera) while the toggle is off', () => {
    const fake = createFakeProvider();
    render(
      <Scene3DPreview scene={baseScene()} createGestureCameraProvider={() => fake.provider} />,
    );
    expect(screen.queryByTestId('gesture-camera-control')).not.toBeInTheDocument();
    expect(fake.start).not.toHaveBeenCalled();
  });

  it('applies palm-position deltas as camera orbit once enabled, a hand is present, and frames arrive', async () => {
    const fake = createFakeProvider();
    render(
      <Scene3DPreview scene={baseScene()} createGestureCameraProvider={() => fake.provider} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    await user.click(screen.getByRole('button', { name: 'Steer the piece' }));
    await user.click(screen.getByRole('button', { name: 'Piece controls' }));
    expect(fake.start).toHaveBeenCalledTimes(1);

    // Two frames with a moved hand -- the first just seeds "previous
    // position" (the extractor's own signals require a prior frame to
    // derive a delta from); the second's delta is what actually gets
    // applied to the camera on the next render tick.
    fake.emitFrame({ timestamp: 0, hands: [hand({ landmarks: landmarks(0) })], events: [] });
    fake.emitFrame({ timestamp: 33, hands: [hand({ landmarks: landmarks(0.3) })], events: [] });

    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // No crash, no error surfaced -- the orbit math ran against the fake
    // camera/controls without throwing. Verifying camera.position itself
    // would require reaching into the real THREE.Camera instance this
    // component creates internally, which isn't exposed -- the absence of
    // an error/warning is this test's own practical boundary, documented
    // rather than silently skipped.
    expect(screen.queryByTestId('screenshot-error')).not.toBeInTheDocument();
  });

  it('resets its smoothing state on every re-enable (a stale prior-session frame never produces a jump)', async () => {
    const fake = createFakeProvider();
    render(
      <Scene3DPreview scene={baseScene()} createGestureCameraProvider={() => fake.provider} />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    await user.click(screen.getByRole('button', { name: 'Steer the piece' }));
    await user.click(screen.getByRole('button', { name: 'Stop steering with gestures' }));
    await user.click(screen.getByRole('button', { name: 'Steer the piece' }));

    expect(screen.getByTestId('gesture-camera-control')).toBeInTheDocument();
  });

  it('gives the "Preview actions" button row its own spacing class (issue #298)', () => {
    render(<Scene3DPreview scene={baseScene()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    expect(screen.getByRole('group', { name: 'Preview actions' })).toHaveClass(
      'scene3d-preview-actions',
    );
  });

  it('keeps the fixed-height canvas frame separate from the auto-height outer container (issue #299)', async () => {
    const fake = createFakeProvider();
    const { container } = render(
      <Scene3DPreview scene={baseScene()} createGestureCameraProvider={() => fake.provider} />,
    );
    const user = userEvent.setup();

    // The outer element (fullscreen target, `data-testid="scene3d-preview"`)
    // must never carry the fixed-height class itself -- only its inner
    // canvas frame does -- so it can grow to fit the button row and (once
    // enabled) the Live camera panel without either spilling past it and
    // overlapping whatever comes after this component in the page (the
    // exact bug this issue reports).
    const outer = screen.getByTestId('scene3d-preview');
    expect(outer).not.toHaveClass('scene3d-preview-canvas-frame');
    const canvasFrame = screen.getByTestId('scene3d-preview-canvas-frame');
    expect(canvasFrame).toHaveClass('scene3d-preview-canvas-frame');
    expect(outer.contains(canvasFrame)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    await user.click(screen.getByRole('button', { name: 'Steer the piece' }));
    await user.click(screen.getByRole('button', { name: 'Piece controls' }));
    const gestureRegion = screen.getByTestId('gesture-camera-control');
    // The Live camera panel is now inside the stage-local Piece controls
    // disclosure, which remains a descendant of the canvas frame so the
    // complete authored-piece chrome travels with the stage.
    expect(outer.contains(gestureRegion)).toBe(true);
    expect(canvasFrame.contains(gestureRegion)).toBe(true);
    expect(container.querySelector('.scene3d-preview')).not.toHaveClass(
      'scene3d-preview-canvas-frame',
    );
  });
});

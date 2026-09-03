import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CameraStatus } from '../components/CameraControl';
import {
  DEFAULT_CAMERA_OVERLAY_SETTINGS,
  setCameraOverlayMirrored,
  setCameraOverlayOpacity,
} from '../editor/cameraOverlaySettings';
import type { TrackingFrame } from '../tracking/types';
import type { Scene3DDocument } from './scene3dTypes';

/**
 * Issue #297: the "Steer the piece" camera-feed overlay + opacity/mirror
 * controls, reusing the exact same shared `cameraOverlaySettings.ts` store
 * `EditorWorkspace.cameraOverlay.test.tsx` covers for 2D. `CameraControl`
 * is mocked as a controllable status/stream stub -- matching that file's
 * own boundary-mocking convention -- since its own permission/MediaPipe
 * state machine is already covered by `CameraControl.test.tsx`, and #294's
 * orbit/zoom gesture mapping is already covered by
 * `Scene3DPreview.gestureControl.test.tsx`.
 */

const { onStatusChangeRef, onStreamChangeRef } = vi.hoisted(() => ({
  onStatusChangeRef: { current: null as ((status: CameraStatus) => void) | null },
  onStreamChangeRef: { current: null as ((stream: MediaStream | null) => void) | null },
}));

vi.mock('../components/CameraControl', () => ({
  default: ({
    onStatusChange,
    onStreamChange,
  }: {
    onStatusChange?: (status: CameraStatus) => void;
    onStreamChange?: (stream: MediaStream | null) => void;
    onFrame?: (frame: TrackingFrame) => void;
  }) => {
    onStatusChangeRef.current = onStatusChange ?? null;
    onStreamChangeRef.current = onStreamChange ?? null;
    return <div data-testid="fake-camera-control">Camera stub</div>;
  },
}));

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

function setCameraStatus(status: CameraStatus) {
  act(() => {
    onStatusChangeRef.current?.(status);
  });
}

function setCameraStream(stream: MediaStream | null) {
  act(() => {
    onStreamChangeRef.current?.(stream);
  });
}

function fakeStream(): MediaStream {
  return {} as MediaStream;
}

beforeEach(() => {
  vi.clearAllMocks();
  onStatusChangeRef.current = null;
  onStreamChangeRef.current = null;
  // Module-singleton store persisted via localStorage -- reset both before
  // every test, matching `EditorWorkspace.cameraOverlay.test.tsx`'s own
  // convention for the exact same shared store.
  window.localStorage.clear();
  setCameraOverlayOpacity(DEFAULT_CAMERA_OVERLAY_SETTINGS.opacity);
  setCameraOverlayMirrored(DEFAULT_CAMERA_OVERLAY_SETTINGS.mirrored);
});

describe('Scene3DPreview camera-feed overlay + opacity/mirror controls (issue #297)', () => {
  async function enableGestureControl() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    await user.click(screen.getByRole('button', { name: 'Steer the piece' }));
  }

  it('renders no overlay video or controls while idle/starting, even once a stream exists', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    await enableGestureControl();

    setCameraStream(fakeStream());
    setCameraStatus('starting');

    expect(screen.queryByTestId('scene3d-camera-overlay-video')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Camera overlay opacity')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Mirror camera overlay')).not.toBeInTheDocument();
  });

  it('shows the camera-feed overlay, opacity slider, and mirror toggle once active', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    await enableGestureControl();

    setCameraStream(fakeStream());
    setCameraStatus('active');

    expect(screen.getByTestId('scene3d-camera-overlay-video')).toBeInTheDocument();
    expect(screen.getByLabelText('Camera overlay opacity')).toBeInTheDocument();
    expect(screen.getByLabelText('Mirror camera overlay')).toBeInTheDocument();
  });

  it('reads/writes the same shared cameraOverlaySettings store the 2D editor uses', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    await enableGestureControl();
    setCameraStream(fakeStream());
    setCameraStatus('active');

    const opacitySlider = screen.getByLabelText('Camera overlay opacity') as HTMLInputElement;
    expect(opacitySlider.value).toBe(
      String(Math.round(DEFAULT_CAMERA_OVERLAY_SETTINGS.opacity * 100)),
    );

    fireEvent.change(opacitySlider, { target: { value: '80' } });
    expect(opacitySlider.value).toBe('80');

    const video = screen.getByTestId('scene3d-camera-overlay-video');
    expect(video).toHaveStyle({ opacity: '0.8' });

    const mirrorToggle = screen.getByLabelText('Mirror camera overlay') as HTMLInputElement;
    expect(mirrorToggle.checked).toBe(DEFAULT_CAMERA_OVERLAY_SETTINGS.mirrored);
    const user = userEvent.setup();
    await user.click(mirrorToggle);
    expect(mirrorToggle.checked).toBe(!DEFAULT_CAMERA_OVERLAY_SETTINGS.mirrored);
  });

  it('never shows the overlay/controls when showGestureControl is false', () => {
    render(<Scene3DPreview scene={baseScene()} showGestureControl={false} />);
    setCameraStatus('active');
    expect(screen.queryByTestId('scene3d-camera-overlay-video')).not.toBeInTheDocument();
  });
});

describe('Scene3DPreview independent camera preview (issue #342)', () => {
  it('shows camera separately from steering and exposes overlay controls', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    await user.click(screen.getByRole('button', { name: 'Piece controls' }));
    await user.click(screen.getByRole('button', { name: 'Show camera' }));
    expect(screen.getByRole('button', { name: 'Steer the piece' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByRole('button', { name: 'Camera theremin' })).not.toBeInTheDocument();

    setCameraStream(fakeStream());
    setCameraStatus('active');

    expect(screen.getByTestId('scene3d-camera-preview-video')).toBeInTheDocument();
    expect(screen.getByLabelText('Camera overlay opacity')).toBeInTheDocument();
    expect(screen.getByLabelText('Mirror camera overlay')).toBeInTheDocument();
  });

  it('hiding the preview removes the stream overlay without changing steering', async () => {
    render(<Scene3DPreview scene={baseScene()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open piece controls menu' }));
    await user.click(screen.getByRole('button', { name: 'Piece controls' }));
    await user.click(screen.getByRole('button', { name: 'Show camera' }));
    setCameraStream(fakeStream());
    setCameraStatus('active');
    await user.click(screen.getByRole('button', { name: 'Hide camera' }));

    expect(screen.queryByTestId('scene3d-camera-preview-video')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Steer the piece' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

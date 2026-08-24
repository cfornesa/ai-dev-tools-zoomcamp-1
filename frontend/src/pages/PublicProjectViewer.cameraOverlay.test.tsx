import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as projectsApi from '../api/projects';
import type { PublicProject } from '../api/projects';
import * as authModule from '../auth/useAuth';
import type { CameraStatus } from '../components/CameraControl';
import {
  DEFAULT_CAMERA_OVERLAY_SETTINGS,
  setCameraOverlayMirrored,
  setCameraOverlayOpacity,
} from '../editor/cameraOverlaySettings';
import PublicProjectViewer from './PublicProjectViewer';

/**
 * Task 119 (issue #152): the camera video overlay + opacity slider + mirror
 * toggle ported to the public project viewer, mirroring
 * `EditorWorkspace.cameraOverlay.test.tsx`'s coverage and mocking
 * boundary — `CameraControl` is stubbed as a controllable status/stream
 * source only (its own permission/MediaPipe state machine is already
 * covered elsewhere).
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
  }) => {
    onStatusChangeRef.current = onStatusChange ?? null;
    onStreamChangeRef.current = onStreamChange ?? null;
    return <div data-testid="fake-camera-control">Camera stub</div>;
  },
}));

vi.mock('../api/projects');
vi.mock('../auth/useAuth');

const mockedGetPublicProject = vi.mocked(projectsApi.getPublicProject);
const mockedUseAuth = vi.mocked(authModule.useAuth);

const BLANK_SCENE = {
  schemaVersion: 1,
  id: 'scene-blank',
  canvas: { width: 800, height: 600, backgroundColor: '#ffffff' },
  renderer: { preferred: 'p5' },
  layers: [{ id: 'layer-1', name: 'Layer 1', order: 0, visible: true, locked: false }],
  shapes: [],
  groups: [],
  bindings: [],
  graph: { nodes: [], connections: [] },
  accessibility: { reducedMotion: 'auto' },
  randomness: { seed: 0, enabled: false },
};

function basePublicProject(overrides: Partial<PublicProject> = {}): PublicProject {
  return {
    id: 'p1',
    owner: 'alice',
    title: 'Hand Follower',
    description: 'A hand-reactive circle.',
    tags: [],
    allow_public_remix: false,
    thumbnail_url: '/api/public/projects/p1/thumbnail.png',
    remix_provenance: null,
    current_version: {
      sequence: 1,
      scene_json: BLANK_SCENE,
      created_at: '2026-01-01T00:00:00Z',
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function renderViewer(id = 'p1') {
  return render(
    <MemoryRouter initialEntries={[`/p/${id}`]}>
      <Routes>
        <Route path="/gallery" element={<p>Gallery placeholder</p>} />
        <Route path="/p/:id" element={<PublicProjectViewer />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function loadViewer() {
  mockedGetPublicProject.mockResolvedValue(basePublicProject());
  renderViewer();
  await screen.findByRole('heading', { name: 'Hand Follower' });
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
  mockedUseAuth.mockReturnValue({ status: 'signed-out', user: null });
  onStatusChangeRef.current = null;
  onStreamChangeRef.current = null;
  // Same module-singleton store the editor's overlay test resets — see that
  // file's identical comment. Resetting it here too keeps both test files
  // isolated from each other and from run order within the same file.
  window.localStorage.clear();
  setCameraOverlayOpacity(DEFAULT_CAMERA_OVERLAY_SETTINGS.opacity);
  setCameraOverlayMirrored(DEFAULT_CAMERA_OVERLAY_SETTINGS.mirrored);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PublicProjectViewer camera video overlay (Task 119, issue #152)', () => {
  it('renders no overlay and no controls while idle', async () => {
    await loadViewer();
    expect(screen.queryByTestId('camera-overlay-video')).toBeNull();
    expect(screen.queryByLabelText('Camera overlay opacity')).toBeNull();
    expect(screen.queryByLabelText('Mirror camera overlay')).toBeNull();
  });

  it('renders no overlay while starting, even once the stream is available', async () => {
    await loadViewer();
    setCameraStatus('starting');
    setCameraStream(fakeStream());
    expect(screen.queryByTestId('camera-overlay-video')).toBeNull();
    expect(screen.queryByLabelText('Camera overlay opacity')).toBeNull();
  });

  it('renders the overlay and controls once active with a stream, defaulting to 50% opacity + mirrored', async () => {
    const stream = fakeStream();
    await loadViewer();
    setCameraStatus('starting');
    setCameraStream(stream);
    setCameraStatus('active');

    const canvas = screen.getByTestId('public-scene-canvas');
    const video = within(canvas).getByTestId('camera-overlay-video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.style.opacity).toBe('0.5');
    expect(video.style.transform).toBe('scaleX(-1)');
    expect(video.srcObject).toBe(stream);

    const slider = screen.getByLabelText('Camera overlay opacity') as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    expect(slider.value).toBe('50');
    expect((screen.getByLabelText('Mirror camera overlay') as HTMLInputElement).checked).toBe(true);
  });

  it('moving the slider updates the overlay opacity live', async () => {
    await loadViewer();
    setCameraStream(fakeStream());
    setCameraStatus('active');

    const slider = screen.getByLabelText('Camera overlay opacity') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '100' } });

    const video = screen.getByTestId('camera-overlay-video') as HTMLVideoElement;
    expect(video.style.opacity).toBe('1');
    expect(slider.getAttribute('aria-valuetext')).toBe('100%');

    fireEvent.change(slider, { target: { value: '0' } });
    expect(screen.getByTestId('camera-overlay-video').style.opacity).toBe('0');
  });

  it('mirror toggle flips the transform live with no re-mount', async () => {
    await loadViewer();
    setCameraStream(fakeStream());
    setCameraStatus('active');

    const mirrorToggle = screen.getByLabelText('Mirror camera overlay') as HTMLInputElement;
    const video = screen.getByTestId('camera-overlay-video') as HTMLVideoElement;
    expect(video.style.transform).toBe('scaleX(-1)');

    fireEvent.click(mirrorToggle);

    expect(mirrorToggle.checked).toBe(false);
    expect(screen.getByTestId('camera-overlay-video')).toBe(video);
    expect(video.style.transform).toBe('none');
  });

  it('removes the overlay and controls immediately on Stop (no frozen frame)', async () => {
    await loadViewer();
    setCameraStream(fakeStream());
    setCameraStatus('active');
    expect(screen.getByTestId('camera-overlay-video')).toBeInTheDocument();

    setCameraStream(null);
    setCameraStatus('stopped');

    expect(screen.queryByTestId('camera-overlay-video')).toBeNull();
    expect(screen.queryByLabelText('Camera overlay opacity')).toBeNull();
  });

  it('is not requested/rendered as a side effect of loading the page (never auto-starts)', async () => {
    await loadViewer();
    expect(onStatusChangeRef.current).not.toBeNull();
    expect(screen.queryByTestId('camera-overlay-video')).toBeNull();
  });

  describe('shared store with the editor (not forked)', () => {
    it('a preference set on this page persists to the same localStorage key the editor reads', async () => {
      await loadViewer();
      setCameraStream(fakeStream());
      setCameraStatus('active');

      fireEvent.change(screen.getByLabelText('Camera overlay opacity'), {
        target: { value: '75' },
      });
      fireEvent.click(screen.getByLabelText('Mirror camera overlay'));

      const { CAMERA_OVERLAY_SETTINGS_STORAGE_KEY, getSnapshot } =
        await import('../editor/cameraOverlaySettings');
      expect(getSnapshot()).toEqual({ opacity: 0.75, mirrored: false });
      expect(JSON.parse(window.localStorage.getItem(CAMERA_OVERLAY_SETTINGS_STORAGE_KEY)!)).toEqual(
        {
          opacity: 0.75,
          mirrored: false,
        },
      );
    });

    it('honors a preference already set by the editor (same store, read on mount)', async () => {
      // Simulates the editor having already set a preference in this same
      // browser: writing through the store's own setters (not a second,
      // hand-rolled localStorage.setItem) before the viewer ever mounts.
      setCameraOverlayOpacity(0.2);
      setCameraOverlayMirrored(false);

      await loadViewer();
      setCameraStream(fakeStream());
      setCameraStatus('active');

      expect(screen.getByLabelText('Camera overlay opacity')).toHaveProperty('value', '20');
      expect(screen.getByLabelText('Mirror camera overlay')).toHaveProperty('checked', false);
    });
  });
});
